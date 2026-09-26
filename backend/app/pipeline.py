"""Recruitment pipeline definition shared by models, services and the API."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Stage:
    key: str
    label: str
    rank: int  # progress rank; 0 for exit stages that do not represent progress
    color: str
    is_exit: bool = False


PIPELINE: tuple[Stage, ...] = (
    Stage("sourced", "Sourced", 1, "slate"),
    Stage("screening", "Screening", 2, "sky"),
    Stage("shortlisted", "Shortlisted", 3, "blue"),
    Stage("interview_scheduled", "Interview Scheduled", 4, "indigo"),
    Stage("round1_selected", "Round 1 Selected", 5, "violet"),
    Stage("round2_selected", "Round 2 Selected", 6, "purple"),
    Stage("round3_selected", "Round 3 Selected", 7, "fuchsia"),
    Stage("hr_discussion", "HR Discussion", 8, "pink"),
    Stage("offer_released", "Offer Released", 9, "amber"),
    Stage("offer_accepted", "Offer Accepted", 10, "lime"),
    Stage("joined", "Joined", 11, "emerald"),
    Stage("on_hold", "On Hold", 0, "yellow", is_exit=True),
    Stage("rejected", "Rejected", 0, "red", is_exit=True),
    Stage("dropped", "Dropped / Backed Out", 0, "stone", is_exit=True),
)

STAGES: dict[str, Stage] = {s.key: s for s in PIPELINE}
STAGE_KEYS: tuple[str, ...] = tuple(STAGES)
PROGRESS_STAGES: tuple[Stage, ...] = tuple(s for s in PIPELINE if not s.is_exit)


def stage_rank(key: str) -> int:
    return STAGES[key].rank


def stage_label(key: str) -> str:
    stage = STAGES.get(key)
    return stage.label if stage else key


# Stage a candidate moves to when an interview round result is recorded as "selected".
ROUND_SELECTED_STAGE = {1: "round1_selected", 2: "round2_selected", 3: "round3_selected"}

CANDIDATE_SOURCES = ("naukri", "linkedin", "indeed", "referral", "internal_db", "job_portal", "walk_in", "other")
INTERVIEW_MODES = ("video", "phone", "in_person")
INTERVIEW_RESULTS = ("pending", "selected", "rejected", "on_hold", "no_show")
POSITION_STATUSES = ("open", "on_hold", "closed", "filled")
PRIORITIES = ("low", "medium", "high", "critical")
CLIENT_STATUSES = ("active", "prospect", "inactive")
ROLES = ("admin", "manager", "recruiter")
