from sqlalchemy.orm import Session

from ..database import utcnow
from ..models import Candidate, InterviewRound, StageHistory, User
from ..pipeline import ROUND_SELECTED_STAGE, stage_rank


def change_stage(db: Session, candidate: Candidate, new_stage: str, user: User | None, note: str | None = None) -> bool:
    """Move a candidate to a new stage, recording history. Returns False if nothing changed."""
    if candidate.stage == new_stage and candidate.id is not None:
        return False
    old_stage = candidate.stage if candidate.id is not None else None
    candidate.stage = new_stage
    candidate.stage_updated_at = utcnow()
    candidate.max_stage_rank = max(candidate.max_stage_rank or 0, stage_rank(new_stage))
    db.add(
        StageHistory(
            candidate=candidate,
            from_stage=old_stage,
            to_stage=new_stage,
            note=note,
            changed_by_id=user.id if user else None,
        )
    )
    return True


def apply_interview_outcome(db: Session, interview: InterviewRound, user: User) -> None:
    """Keep the candidate's stage in sync with the interview round workflow."""
    candidate = interview.candidate
    label = interview.round_name or f"Round {interview.round_number}"
    if interview.result == "selected":
        target = ROUND_SELECTED_STAGE.get(interview.round_number)
        if target and stage_rank(target) > stage_rank_or_zero(candidate.stage):
            change_stage(db, candidate, target, user, f"{label}: selected")
        elif target is None and stage_rank_or_zero(candidate.stage) < stage_rank("hr_discussion"):
            change_stage(db, candidate, "hr_discussion", user, f"{label}: selected")
    elif interview.result == "rejected":
        change_stage(db, candidate, "rejected", user, f"{label}: rejected")
    elif interview.result == "on_hold":
        change_stage(db, candidate, "on_hold", user, f"{label}: on hold")


def on_interview_scheduled(db: Session, interview: InterviewRound, user: User) -> None:
    candidate = interview.candidate
    # Only move forward; later rounds keep the "Round N Selected" stage and show up as the next interview.
    if stage_rank_or_zero(candidate.stage) < stage_rank("interview_scheduled"):
        label = interview.round_name or f"Round {interview.round_number}"
        change_stage(db, candidate, "interview_scheduled", user, f"{label} scheduled")


def stage_rank_or_zero(key: str) -> int:
    try:
        return stage_rank(key)
    except KeyError:
        return 0
