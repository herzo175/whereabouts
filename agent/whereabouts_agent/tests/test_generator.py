from types import SimpleNamespace

import pytest

from whereabouts_agent.contracts import (
    Board,
    CaseDraft,
    CriticOutput,
    GenerationRequest,
    ThemePlan,
)
from whereabouts_agent.generator import GeneratorRunners, generate_case

from .test_contracts import candidate


def request() -> GenerationRequest:
    return GenerationRequest.model_validate(
        {
            "date": "2026-08-17",
            "revision": 1,
            "caseNumber": 123,
            "recentThemes": [],
            "excludedTargetIds": ["candidate-24"],
        }
    )


def theme() -> ThemePlan:
    return ThemePlan.model_validate(
        {
            "title": "Historic market squares",
            "introduction": "Explore public squares whose markets shaped their cities over centuries.",
            "inclusionCriteria": "Named urban squares with documented market or civic significance.",
            "exclusions": ["Exclude modern shopping malls without a historic square identity."],
            "searchQueries": ["historic market square", "medieval city market", "civic plaza"],
        }
    )


def board() -> Board:
    return Board(
        theme=theme(),
        candidates=[candidate(i) for i in range(25)],
        targetPoiIds=[f"candidate-{i:02d}" for i in range(5)],
    )


def draft(board: Board) -> CaseDraft:
    return CaseDraft.model_validate(
        {
            "rounds": [
                {
                    "targetPoiId": target,
                    "clue": {
                        "text": "This clue identifies a market square through its history and civic role.",
                        "evidencePoiIds": [target],
                    },
                    "results": [
                        {
                            "poiId": candidate.id,
                            "similarityScore": 100 if candidate.id == target else 50,
                            "text": "Evidence about this candidate and its relationship to the theme.",
                            "evidencePoiIds": [candidate.id, target]
                            if candidate.id != target
                            else [target],
                        }
                        for candidate in board.candidates
                    ],
                }
                for target in board.target_poi_ids
            ]
        }
    )


def critic(board: Board, *, clue_pass: bool = True) -> CriticOutput:
    return CriticOutput.model_validate(
        {
            "themeVerdicts": [
                {
                    "poiId": candidate.id,
                    "status": "pass",
                    "explanation": "The candidate satisfies every stated theme criterion.",
                    "sourceIds": ["source-01"],
                }
                for candidate in board.candidates
            ],
            "clueVerdicts": [
                {
                    "roundId": f"round-{index + 1}",
                    "declaredTargetPoiId": target,
                    "resolvedPoiId": target if clue_pass else None,
                    "resolvedOffBoardAnswer": None if clue_pass else "An off-board place",
                    "status": "pass" if clue_pass else "fail",
                    "explanation": "The clue resolves to the declared board target.",
                }
                for index, target in enumerate(board.target_poi_ids)
            ],
            "relationshipVerdicts": [
                {
                    "roundId": f"round-{index + 1}",
                    "poiId": candidate.id,
                    "status": "pass",
                    "explanation": "The evidence supports this candidate relationship.",
                }
                for index in range(5)
                for candidate in board.candidates
            ],
        }
    )


class FakeRunner:
    def __init__(self, values):
        self.values = list(values)
        self.calls: list[type] = []

    async def run(self, prompt: str, output_type):
        self.calls.append(output_type)
        return self.values.pop(0)


@pytest.mark.asyncio
async def test_generate_case_uses_independent_critic_and_returns_intermediate_shape() -> None:
    board_value = board()
    planner = FakeRunner([SimpleNamespace(theme=theme(), board=board_value)])
    writer = FakeRunner([draft(board_value)])
    critic_runner = FakeRunner([critic(board_value)])

    result = await generate_case(
        request(),
        GeneratorRunners(planner=planner, writer=writer, critic=critic_runner),
    )

    assert len(result.board.candidates) == 25
    assert result.board.target_poi_ids == [f"candidate-{i:02d}" for i in range(5)]
    assert len(result.draft.rounds) == 5
    assert result.review.repairs == []
    assert len(critic_runner.calls) == 1


@pytest.mark.asyncio
async def test_generate_case_repairs_off_board_clue_resolution_once() -> None:
    board_value = board()
    planner = FakeRunner([SimpleNamespace(theme=theme(), board=board_value)])
    writer = FakeRunner([draft(board_value)])
    critic_runner = FakeRunner([critic(board_value, clue_pass=False), critic(board_value)])
    repair = FakeRunner([SimpleNamespace(theme=theme(), board=board_value, draft=draft(board_value))])

    result = await generate_case(
        request(),
        GeneratorRunners(planner=planner, writer=writer, critic=critic_runner, repair=repair),
    )

    assert len(result.review.repairs) == 1
    assert len(repair.calls) == 1
    assert len(critic_runner.calls) == 2


@pytest.mark.asyncio
async def test_generate_case_stops_after_two_failed_repairs() -> None:
    board_value = board()
    planner = FakeRunner([SimpleNamespace(theme=theme(), board=board_value)])
    writer = FakeRunner([draft(board_value)])
    critic_runner = FakeRunner([critic(board_value, clue_pass=False)] * 3)
    repair = FakeRunner(
        [
            SimpleNamespace(theme=theme(), board=board_value, draft=draft(board_value)),
            SimpleNamespace(theme=theme(), board=board_value, draft=draft(board_value)),
        ]
    )

    with pytest.raises(RuntimeError, match="two repair attempts"):
        await generate_case(
            request(),
            GeneratorRunners(planner=planner, writer=writer, critic=critic_runner, repair=repair),
        )
    assert len(repair.calls) == 2
    assert len(critic_runner.calls) == 3
