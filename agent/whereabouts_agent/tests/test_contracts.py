from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from whereabouts_agent.contracts import (
    Board,
    Candidate,
    CaseDraft,
    GenerationRequest,
    Review,
    ThemePlan,
)


def candidate(index: int) -> dict:
    suffix = f"{index:02d}"
    return {
        "id": f"candidate-{suffix}",
        "name": f"Candidate {suffix}",
        "city": f"City {suffix}",
        "country": f"Country {suffix}",
        "wikipediaTitle": f"Candidate {suffix}",
        "themeClaim": "This place is a documented example of the daily theme.",
        "latitude": float(index),
        "longitude": float(index) + 0.5,
        "source": {
            "title": f"Source {suffix}",
            "url": "https://example.com/source",
            "retrievedAt": "2026-08-17T00:00:00Z",
            "extract": "A source extract with enough detail to support the candidate and its theme. It documents the place, location, history, and specific relationship to the daily theme.",
        },
        "image": {
            "url": "https://example.com/image.jpg",
            "alt": "A representative place",
            "attribution": "Example contributor",
            "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
        },
    }


def theme() -> dict:
    return {
        "title": "Historic market squares",
        "introduction": "Explore public squares whose markets shaped their cities over centuries.",
        "inclusionCriteria": "Named urban squares with documented market or civic significance.",
        "exclusions": ["Exclude modern shopping malls without a historic square identity."],
        "searchQueries": ["historic market square", "medieval city market", "civic plaza"],
    }


def board() -> Board:
    return Board(
        theme=ThemePlan.model_validate(theme()),
        candidates=[Candidate.model_validate(candidate(i)) for i in range(25)],
        target_poi_ids=[f"candidate-{i:02d}" for i in range(5)],
    )


def test_board_rejects_targets_not_on_board() -> None:
    values = board().model_dump(by_alias=True)
    values["targetPoiIds"][0] = "off-board"
    with pytest.raises(ValidationError, match="targets must exist on board"):
        Board.model_validate(values)


def test_candidate_rejects_extra_fields_and_invalid_coordinates() -> None:
    values = candidate(1)
    values["unexpected"] = True
    with pytest.raises(ValidationError):
        Candidate.model_validate(values)

    values = candidate(1)
    values["latitude"] = 91
    with pytest.raises(ValidationError):
        Candidate.model_validate(values)


def test_request_accepts_camel_case_cli_payload() -> None:
    request = GenerationRequest.model_validate(
        {
            "date": "2026-08-17",
            "revision": 1,
            "caseNumber": 123,
            "recentThemes": [],
            "excludedTargetIds": ["old-target"],
        }
    )
    assert request.case_number == 123
    assert request.excluded_target_ids == ["old-target"]


def test_draft_requires_five_complete_rounds() -> None:
    with pytest.raises(ValidationError):
        CaseDraft.model_validate({"rounds": []})


def test_review_uses_final_ts_shape() -> None:
    review = Review(
        schema_version=1,
        publication_date="2026-08-17",
        revision=1,
        theme_verdicts=[
            {
                "poiId": f"candidate-{i:02d}",
                "status": "pass",
                "explanation": "The candidate satisfies every stated inclusion rule.",
                "sourceIds": ["source-01"],
            }
            for i in range(25)
        ],
        clue_verdicts=[
            {
                "roundId": f"round-{i + 1}",
                "declaredTargetPoiId": f"candidate-{i:02d}",
                "resolvedPoiId": f"candidate-{i:02d}",
                "resolvedOffBoardAnswer": None,
                "status": "pass",
                "explanation": "The clue resolves to the declared board target.",
            }
            for i in range(5)
        ],
        repairs=[],
    )
    assert review.model_dump(by_alias=True)["schemaVersion"] == 1
