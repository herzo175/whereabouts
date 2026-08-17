from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator
from pydantic.alias_generators import to_camel


class Contract(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class RecentTheme(Contract):
    title: str = Field(min_length=3)
    inclusion_criteria: str = Field(min_length=20)


class GenerationRequest(Contract):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    revision: int = Field(gt=0)
    case_number: int = Field(gt=0)
    recent_themes: list[RecentTheme] = Field(default_factory=list)
    excluded_target_ids: list[str] = Field(default_factory=list)


class ThemePlan(Contract):
    title: str = Field(min_length=3)
    introduction: str = Field(min_length=20)
    inclusion_criteria: str = Field(min_length=20)
    exclusions: list[str] = Field(min_length=1)
    search_queries: list[str] = Field(min_length=3, max_length=12)


class SourceEvidence(Contract):
    title: str = Field(min_length=1)
    url: HttpUrl
    retrieved_at: str
    extract: str = Field(min_length=100)


class ImageEvidence(Contract):
    url: HttpUrl
    alt: str = Field(min_length=5)
    attribution: str = Field(min_length=3)
    license_url: HttpUrl


class Candidate(Contract):
    id: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    name: str = Field(min_length=2)
    city: str = Field(min_length=1)
    country: str = Field(min_length=2)
    wikipedia_title: str = Field(min_length=2)
    theme_claim: str = Field(min_length=20)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    source: SourceEvidence
    image: ImageEvidence


class Board(Contract):
    theme: ThemePlan
    candidates: list[Candidate] = Field(min_length=25, max_length=25)
    target_poi_ids: list[str] = Field(min_length=5, max_length=5)

    @model_validator(mode="after")
    def validate_board(self) -> Board:
        ids = [candidate.id for candidate in self.candidates]
        if len(ids) != len(set(ids)):
            raise ValueError("candidate IDs must be unique")
        coordinates = [(candidate.latitude, candidate.longitude) for candidate in self.candidates]
        if len(coordinates) != len(set(coordinates)):
            raise ValueError("candidate coordinates must be unique")
        if len(self.target_poi_ids) != len(set(self.target_poi_ids)):
            raise ValueError("targets must be unique")
        if any(target not in set(ids) for target in self.target_poi_ids):
            raise ValueError("targets must exist on board")
        return self


class Clue(Contract):
    text: str = Field(min_length=20)
    evidence_poi_ids: list[str] = Field(min_length=1)


class ScoredResult(Contract):
    poi_id: str = Field(min_length=1)
    similarity_score: float = Field(ge=0, le=100)
    text: str = Field(min_length=10)
    evidence_poi_ids: list[str] = Field(min_length=1)


class DraftRound(Contract):
    target_poi_id: str = Field(min_length=1)
    clue: Clue
    results: list[ScoredResult] = Field(min_length=25, max_length=25)


class CaseDraft(Contract):
    rounds: list[DraftRound] = Field(min_length=5, max_length=5)

    @model_validator(mode="after")
    def validate_rounds(self) -> CaseDraft:
        targets = [round_.target_poi_id for round_ in self.rounds]
        if len(targets) != len(set(targets)):
            raise ValueError("round targets must be unique")
        for round_ in self.rounds:
            result_ids = [result.poi_id for result in round_.results]
            if len(result_ids) != len(set(result_ids)):
                raise ValueError("round results must have unique candidate IDs")
        return self


class ThemeVerdict(Contract):
    poi_id: str
    status: Literal["pass", "fail"]
    explanation: str = Field(min_length=20)
    source_ids: list[str] = Field(min_length=1)


class ClueVerdict(Contract):
    round_id: str
    declared_target_poi_id: str
    resolved_poi_id: str | None
    resolved_off_board_answer: str | None
    status: Literal["pass", "fail"]
    explanation: str = Field(min_length=20)


class RelationshipVerdict(Contract):
    round_id: str
    poi_id: str
    status: Literal["pass", "fail"]
    explanation: str = Field(min_length=10)


class CriticOutput(Contract):
    theme_verdicts: list[ThemeVerdict] = Field(min_length=25, max_length=25)
    clue_verdicts: list[ClueVerdict] = Field(min_length=5, max_length=5)
    relationship_verdicts: list[RelationshipVerdict] = Field(min_length=125, max_length=125)


class RepairRecord(Contract):
    stage: str
    summary: str = Field(min_length=10)


class Review(Contract):
    schema_version: Literal[1]
    publication_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    revision: int = Field(gt=0)
    theme_verdicts: list[ThemeVerdict] = Field(min_length=25, max_length=25)
    clue_verdicts: list[ClueVerdict] = Field(min_length=5, max_length=5)
    repairs: list[RepairRecord]


class PlannedBoard(Contract):
    theme: ThemePlan
    board: Board


class RepairBundle(Contract):
    theme: ThemePlan
    board: Board
    draft: CaseDraft


class GenerationResult(Contract):
    theme: ThemePlan
    board: Board
    draft: CaseDraft
    review: Review
