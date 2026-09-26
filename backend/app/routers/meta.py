from fastapi import APIRouter

from ..pipeline import (
    CANDIDATE_SOURCES,
    CLIENT_STATUSES,
    INTERVIEW_MODES,
    INTERVIEW_RESULTS,
    PIPELINE,
    POSITION_STATUSES,
    PRIORITIES,
    ROLES,
)

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("")
def meta():
    """Lookup values (pipeline stages, sources, statuses) used to build forms and the tracker sheet."""
    return {
        "stages": [
            {"key": s.key, "label": s.label, "rank": s.rank, "color": s.color, "is_exit": s.is_exit} for s in PIPELINE
        ],
        "sources": CANDIDATE_SOURCES,
        "client_statuses": CLIENT_STATUSES,
        "position_statuses": POSITION_STATUSES,
        "priorities": PRIORITIES,
        "interview_modes": INTERVIEW_MODES,
        "interview_results": INTERVIEW_RESULTS,
        "roles": ROLES,
    }
