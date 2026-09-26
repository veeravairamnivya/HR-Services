import re
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from .pipeline import (
    CANDIDATE_SOURCES,
    CLIENT_STATUSES,
    INTERVIEW_MODES,
    INTERVIEW_RESULTS,
    POSITION_STATUSES,
    PRIORITIES,
    ROLES,
    STAGE_KEYS,
)

Role = Literal[ROLES]  # type: ignore[valid-type]
StageKey = Literal[STAGE_KEYS]  # type: ignore[valid-type]
Source = Literal[CANDIDATE_SOURCES]  # type: ignore[valid-type]
ClientStatus = Literal[CLIENT_STATUSES]  # type: ignore[valid-type]
PositionStatus = Literal[POSITION_STATUSES]  # type: ignore[valid-type]
Priority = Literal[PRIORITIES]  # type: ignore[valid-type]
InterviewMode = Literal[INTERVIEW_MODES]  # type: ignore[valid-type]
InterviewResult = Literal[INTERVIEW_RESULTS]  # type: ignore[valid-type]
WorkMode = Literal["onsite", "remote", "hybrid"]
EmploymentType = Literal["full_time", "contract", "contract_to_hire", "internship"]


URL_FIELDS = ("resume_url", "meeting_link", "website")


def _safe_url(value: str) -> str:
    """Links are rendered as hrefs, so only http(s) is allowed; a bare domain gets https://."""
    scheme = re.match(r"^([a-zA-Z][a-zA-Z0-9+.-]*):(?!\d)", value)  # "host:8080" is not a scheme
    if scheme is None:
        return f"https://{value}"
    if scheme.group(1).lower() not in ("http", "https"):
        raise ValueError("Only http(s) links are allowed")
    return value


class InputModel(BaseModel):
    """Base for request bodies: blank strings from forms/sheet cells are treated as empty values."""

    model_config = ConfigDict(str_strip_whitespace=True)

    @model_validator(mode="before")
    @classmethod
    def _blank_to_none(cls, data: Any) -> Any:
        if isinstance(data, dict):
            data = {k: (None if isinstance(v, str) and not v.strip() else v) for k, v in data.items()}
            for key in URL_FIELDS:
                if isinstance(data.get(key), str):
                    data[key] = _safe_url(data[key].strip())
        return data


class OutModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------- users & auth
class UserBrief(OutModel):
    id: int
    full_name: str
    email: str
    role: str


class UserOut(UserBrief):
    phone: str | None
    designation: str | None
    daily_target: int
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None


class UserCreate(InputModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    role: Role = "recruiter"
    phone: str | None = None
    designation: str | None = None
    daily_target: int = Field(default=5, ge=0, le=100)


class UserUpdate(InputModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=6, max_length=128)
    role: Role | None = None
    phone: str | None = None
    designation: str | None = None
    daily_target: int | None = Field(default=None, ge=0, le=100)
    is_active: bool | None = None


class ProfileUpdate(InputModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = None
    designation: str | None = None


class PasswordChange(InputModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


class LoginRequest(InputModel):
    email: EmailStr
    password: str


class AttendanceOut(OutModel):
    id: int
    user_id: int
    user: UserBrief | None = None
    work_date: date
    login_at: datetime
    last_seen_at: datetime
    logout_at: datetime | None
    status: str
    work_summary: str | None
    hours_worked: float = 0


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut
    attendance: AttendanceOut | None = None


class CheckoutRequest(InputModel):
    work_summary: str | None = None


# ---------------------------------------------------------------- clients
class ClientBase(InputModel):
    name: str = Field(min_length=2, max_length=200)
    industry: str | None = None
    contact_person: str | None = None
    contact_email: EmailStr | None = None
    contact_phone: str | None = None
    location: str | None = None
    website: str | None = None
    status: ClientStatus = "active"
    fee_percentage: float | None = Field(default=None, ge=0, le=100)
    payment_terms_days: int | None = Field(default=None, ge=0, le=365)
    notes: str | None = None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(ClientBase):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    status: ClientStatus | None = None


class ClientBrief(OutModel):
    id: int
    name: str
    industry: str | None = None


class ClientOut(OutModel):
    id: int
    name: str
    industry: str | None
    contact_person: str | None
    contact_email: str | None
    contact_phone: str | None
    location: str | None
    website: str | None
    status: str
    fee_percentage: float | None
    payment_terms_days: int | None
    notes: str | None
    created_at: datetime
    total_positions: int = 0
    open_positions: int = 0
    total_openings: int = 0
    total_candidates: int = 0
    offers: int = 0
    joined: int = 0


# ---------------------------------------------------------------- positions
class PositionBase(InputModel):
    client_id: int
    title: str = Field(min_length=2, max_length=200)
    job_code: str | None = Field(default=None, max_length=50)
    department: str | None = None
    location: str | None = None
    work_mode: WorkMode = "onsite"
    employment_type: EmploymentType = "full_time"
    min_experience: float | None = Field(default=None, ge=0, le=60)
    max_experience: float | None = Field(default=None, ge=0, le=60)
    min_budget: float | None = Field(default=None, ge=0)
    max_budget: float | None = Field(default=None, ge=0)
    openings: int = Field(default=1, ge=1, le=1000)
    skills: str | None = None
    description: str | None = None
    priority: Priority = "medium"
    status: PositionStatus = "open"
    target_date: date | None = None
    recruiter_ids: list[int] = []


class PositionCreate(PositionBase):
    pass


class PositionUpdate(PositionBase):
    client_id: int | None = None
    title: str | None = Field(default=None, min_length=2, max_length=200)
    work_mode: WorkMode | None = None
    employment_type: EmploymentType | None = None
    openings: int | None = Field(default=None, ge=1, le=1000)
    priority: Priority | None = None
    status: PositionStatus | None = None
    recruiter_ids: list[int] | None = None


class PositionOut(OutModel):
    id: int
    client_id: int
    client: ClientBrief
    title: str
    job_code: str | None
    department: str | None
    location: str | None
    work_mode: str
    employment_type: str
    min_experience: float | None
    max_experience: float | None
    min_budget: float | None
    max_budget: float | None
    openings: int
    skills: str | None
    description: str | None
    priority: str
    status: str
    target_date: date | None
    created_at: datetime
    recruiters: list[UserBrief] = []
    candidate_count: int = 0
    interview_count: int = 0
    offer_count: int = 0
    joined_count: int = 0
    stage_counts: dict[str, int] = {}
    days_open: int = 0


# ---------------------------------------------------------------- interviews & history
class InterviewCreate(InputModel):
    round_number: int | None = Field(default=None, ge=1, le=10)
    round_name: str | None = None
    scheduled_at: datetime | None = None
    mode: InterviewMode = "video"
    interviewer: str | None = None
    meeting_link: str | None = None
    feedback: str | None = None


class InterviewUpdate(InputModel):
    round_number: int | None = Field(default=None, ge=1, le=10)
    round_name: str | None = None
    scheduled_at: datetime | None = None
    mode: InterviewMode | None = None
    interviewer: str | None = None
    meeting_link: str | None = None
    result: InterviewResult | None = None
    feedback: str | None = None


class InterviewOut(OutModel):
    id: int
    candidate_id: int
    round_number: int
    round_name: str | None
    scheduled_at: datetime | None
    mode: str
    interviewer: str | None
    meeting_link: str | None
    result: str
    feedback: str | None
    created_at: datetime


class StageHistoryOut(OutModel):
    id: int
    candidate_id: int
    from_stage: str | None
    to_stage: str
    note: str | None
    changed_by: UserBrief | None
    changed_at: datetime


# ---------------------------------------------------------------- candidates
class CandidateFields(InputModel):
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    current_company: str | None = None
    current_designation: str | None = None
    total_experience: float | None = Field(default=None, ge=0, le=60)
    relevant_experience: float | None = Field(default=None, ge=0, le=60)
    current_ctc: float | None = Field(default=None, ge=0)
    expected_ctc: float | None = Field(default=None, ge=0)
    offered_ctc: float | None = Field(default=None, ge=0)
    notice_period_days: int | None = Field(default=None, ge=0, le=365)
    current_location: str | None = None
    preferred_location: str | None = None
    skills: str | None = None
    source: Source | None = None
    resume_url: str | None = None
    joining_date: date | None = None
    remarks: str | None = None


class CandidateCreate(CandidateFields):
    full_name: str = Field(min_length=2, max_length=150)
    stage: StageKey = "sourced"
    recruiter_id: int | None = None


class CandidateUpdate(CandidateFields):
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    stage: StageKey | None = None
    stage_note: str | None = None
    recruiter_id: int | None = None


class StageChange(InputModel):
    stage: StageKey
    note: str | None = None


class BulkStageChange(StageChange):
    candidate_ids: list[int] = Field(min_length=1, max_length=500)


class PositionBrief(OutModel):
    id: int
    title: str
    status: str
    client: ClientBrief


class CandidateOut(OutModel):
    id: int
    position_id: int
    full_name: str
    email: str | None
    phone: str | None
    current_company: str | None
    current_designation: str | None
    total_experience: float | None
    relevant_experience: float | None
    current_ctc: float | None
    expected_ctc: float | None
    offered_ctc: float | None
    notice_period_days: int | None
    current_location: str | None
    preferred_location: str | None
    skills: str | None
    source: str | None
    resume_url: str | None
    stage: str
    stage_updated_at: datetime
    joining_date: date | None
    remarks: str | None
    recruiter_id: int | None
    recruiter: UserBrief | None
    created_at: datetime
    updated_at: datetime
    next_interview: InterviewOut | None = None
    interview_count: int = 0


class CandidateListItem(CandidateOut):
    position: PositionBrief


class CandidateDetail(CandidateListItem):
    interviews: list[InterviewOut] = []
    history: list[StageHistoryOut] = []


class DuplicateMatch(OutModel):
    id: int
    full_name: str
    email: str | None
    phone: str | None
    stage: str
    position: PositionBrief
    recruiter: UserBrief | None
    created_at: datetime


class ImportResult(BaseModel):
    created: int
    skipped: int
    errors: list[str]


class Page(BaseModel):
    total: int
    items: list[Any]
