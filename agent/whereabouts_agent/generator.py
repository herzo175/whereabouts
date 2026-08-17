from __future__ import annotations

import asyncio
import json
import os
import sys
from dataclasses import dataclass
from typing import Any, Protocol, TypeVar

from pydantic import BaseModel
from pydantic_ai import Agent
from pydantic_ai.capabilities import WebFetch, WebSearch
from pydantic_ai.models.openrouter import OpenRouterModel

from .contracts import (
    Board,
    CaseDraft,
    CriticOutput,
    GenerationRequest,
    GenerationResult,
    PlannedBoard,
    RepairBundle,
    RepairRecord,
    Review,
)

OutputT = TypeVar("OutputT", bound=BaseModel)


class Runner(Protocol):
    async def run(self, prompt: str, output_type: type[OutputT]) -> OutputT: ...


class PydanticRunner:
    def __init__(self, model: OpenRouterModel, instructions: str) -> None:
        self.model = model
        self.instructions = instructions

    async def run(self, prompt: str, output_type: type[OutputT]) -> OutputT:
        agent = Agent(
            self.model,
            output_type=output_type,
            instructions=self.instructions,
            capabilities=[
                WebSearch(local="duckduckgo"),
                WebFetch(local=True),
            ],
        )
        result = await agent.run(prompt)
        return result.output


@dataclass
class GeneratorRunners:
    planner: Runner
    writer: Runner
    critic: Runner
    repair: Runner | None = None


def default_runners() -> GeneratorRunners:
    if not os.environ.get("OPENROUTER_API_KEY", "").strip():
        raise RuntimeError("OPENROUTER_API_KEY is required")
    model_name = os.environ.get("WHEREABOUTS_MODEL", "openai/gpt-5.6-luna").strip()
    model = OpenRouterModel(model_name)
    return GeneratorRunners(
        planner=PydanticRunner(
            model,
            "Plan a narrow, coherent geography game board from general knowledge. "
            "Use web search or fetch only when needed to resolve uncertainty or obtain auditable citations.",
        ),
        writer=PydanticRunner(
            model,
            "Write a difficult but fair themed geography game. Every clue must resolve to its declared board target.",
        ),
        critic=PydanticRunner(
            model,
            "Act as an independent adversarial critic. Resolve clues before looking at declared answers and fail tangential theme matches.",
        ),
        repair=PydanticRunner(
            model,
            "Repair only the supplied defects while preserving a coherent 25-candidate themed board.",
        ),
    )


def _board_prompt(request: GenerationRequest) -> str:
    return f"""Create one daily themed geography board for {request.date}.
Use your general knowledge first. Search or fetch only for facts you are uncertain about or citations you need to substantiate.
Return exactly 25 real, geographically distinct candidates and exactly five targets chosen from those candidates.
Every candidate must independently satisfy every inclusion rule; do not pad the board with merely adjacent landmarks.
For example, a railway-hotel theme may include station hotels and directly documented railway-hotel sites, never unrelated dams or generic attractions.
Provide accurate coordinates, one auditable source with a substantive extract, and one attributed/licensed image per final candidate.
Avoid these recent themes: {json.dumps([theme.model_dump(by_alias=True) for theme in request.recent_themes])}
Never choose these IDs as targets: {json.dumps(request.excluded_target_ids)}
The theme inside the board must exactly equal the top-level theme."""


def _writer_prompt(board: Board) -> str:
    return f"""Write the five-round case for this board: {board.model_dump_json(by_alias=True)}
Use targets in the exact targetPoiIds order. Each round must have exactly 25 results, one for every board candidate.
The clue must uniquely resolve to the declared target without naming it. Each evidencePoiIds value must be a board ID.
Set the target similarity score to 100 and write meaningful within-theme relationships for all alternatives."""


def _critic_prompt(board: Board, draft: CaseDraft) -> str:
    source_map = {
        candidate.id: f"source-{index + 1:02d}"
        for index, candidate in enumerate(board.candidates)
    }
    return f"""Independently audit this themed geography case.
Board: {board.model_dump_json(by_alias=True)}
Draft: {draft.model_dump_json(by_alias=True)}
Candidate source IDs by board order: {json.dumps(source_map)}
Return exactly one theme verdict per candidate, one clue verdict per round, and all 125 round/candidate relationship verdicts.
For each clue, solve it from clue text and evidence before comparing with targetPoiId. If the answer is off-board, set resolvedPoiId null, name resolvedOffBoardAnswer, and fail it.
Pass only candidates that meet every exact theme criterion and no exclusion. Fail unsupported or tangential associations."""


def _validate_case_shape(request: GenerationRequest, board: Board, draft: CaseDraft) -> None:
    ids = {candidate.id for candidate in board.candidates}
    if any(target in set(request.excluded_target_ids) for target in board.target_poi_ids):
        raise ValueError("planner chose an excluded target")
    if [round_.target_poi_id for round_ in draft.rounds] != board.target_poi_ids:
        raise ValueError("draft target order does not match board targets")
    for round_ in draft.rounds:
        if {result.poi_id for result in round_.results} != ids:
            raise ValueError("draft results must cover every board candidate exactly once")
        evidence = set(round_.clue.evidence_poi_ids)
        evidence.update(
            item for result in round_.results for item in result.evidence_poi_ids
        )
        if not evidence <= ids:
            raise ValueError("draft evidence references an off-board candidate")


def _critic_failures(board: Board, critic: CriticOutput) -> list[str]:
    failures: list[str] = []
    candidate_ids = {candidate.id for candidate in board.candidates}
    theme_ids = [verdict.poi_id for verdict in critic.theme_verdicts]
    if set(theme_ids) != candidate_ids or len(theme_ids) != len(set(theme_ids)):
        failures.append("critic did not cover every candidate exactly once")
    failures.extend(
        f"theme:{verdict.poi_id}:{verdict.explanation}"
        for verdict in critic.theme_verdicts
        if verdict.status != "pass"
    )
    expected_rounds = {f"round-{index + 1}" for index in range(5)}
    if {verdict.round_id for verdict in critic.clue_verdicts} != expected_rounds:
        failures.append("critic did not cover every round exactly once")
    for index, target in enumerate(board.target_poi_ids):
        round_id = f"round-{index + 1}"
        verdict = next(
            (item for item in critic.clue_verdicts if item.round_id == round_id),
            None,
        )
        if (
            verdict is None
            or verdict.status != "pass"
            or verdict.declared_target_poi_id != target
            or verdict.resolved_poi_id != target
            or verdict.resolved_off_board_answer is not None
        ):
            failures.append(f"clue:{round_id}:does not resolve to declared board target")
    expected_relationships = {
        (f"round-{round_index + 1}", candidate.id)
        for round_index in range(5)
        for candidate in board.candidates
    }
    actual_relationships = {
        (verdict.round_id, verdict.poi_id)
        for verdict in critic.relationship_verdicts
    }
    if actual_relationships != expected_relationships:
        failures.append("critic did not cover all 125 relationships")
    failures.extend(
        f"relationship:{verdict.round_id}:{verdict.poi_id}:{verdict.explanation}"
        for verdict in critic.relationship_verdicts
        if verdict.status != "pass"
    )
    return failures


async def generate_case(
    request: GenerationRequest,
    runners: GeneratorRunners | None = None,
) -> GenerationResult:
    active = runners or default_runners()
    planned = await active.planner.run(_board_prompt(request), PlannedBoard)
    if planned.board.theme != planned.theme:
        raise ValueError("board theme does not match planned theme")
    board = planned.board
    theme = planned.theme
    draft = await active.writer.run(_writer_prompt(board), CaseDraft)
    repairs: list[RepairRecord] = []

    for attempt in range(3):
        _validate_case_shape(request, board, draft)
        critic = await active.critic.run(_critic_prompt(board, draft), CriticOutput)
        failures = _critic_failures(board, critic)
        if not failures:
            review = Review(
                schema_version=1,
                publication_date=request.date,
                revision=request.revision,
                theme_verdicts=critic.theme_verdicts,
                clue_verdicts=critic.clue_verdicts,
                repairs=repairs,
            )
            return GenerationResult(
                theme=theme,
                board=board,
                draft=draft,
                review=review,
            )
        if attempt == 2:
            raise RuntimeError("case still failed critic after two repair attempts")
        if active.repair is None:
            raise RuntimeError("critic requested repair but no repair runner is configured")
        repairs.append(
            RepairRecord(
                stage=f"repair-{attempt + 1}",
                summary="; ".join(failures)[:2_000],
            )
        )
        repaired = await active.repair.run(
            f"Repair these failures: {json.dumps(failures)}\nTheme: {theme.model_dump_json(by_alias=True)}\nBoard: {board.model_dump_json(by_alias=True)}\nDraft: {draft.model_dump_json(by_alias=True)}",
            RepairBundle,
        )
        theme, board, draft = repaired.theme, repaired.board, repaired.draft
        if board.theme != theme:
            raise ValueError("repaired board theme does not match repaired theme")

    raise AssertionError("unreachable")


async def generate_from_json(payload: str) -> str:
    request = GenerationRequest.model_validate_json(payload)
    result = await generate_case(request)
    return result.model_dump_json(by_alias=True)


def main() -> None:
    try:
        payload = sys.stdin.read()
        if not payload.strip():
            raise ValueError("expected one JSON generation request on stdin")
        output = asyncio.run(generate_from_json(payload))
        sys.stdout.write(output)
        sys.stdout.write("\n")
    except Exception as error:
        print(f"whereabouts agent failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
