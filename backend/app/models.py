from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base, UTCDateTime, utcnow

position_recruiters = Table(
    "position_recruiters",
    Base.metadata,
    Column("position_id", ForeignKey("positions.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="recruiter")
    phone: Mapped[str | None] = mapped_column(String(30))
    designation: Mapped[str | None] = mapped_column(String(120))
    daily_target: Mapped[int] = mapped_column(Integer, default=5)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    positions: Mapped[list["Position"]] = relationship(
        secondary=position_recruiters, back_populates="recruiters"
    )


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    industry: Mapped[str | None] = mapped_column(String(120))
    contact_person: Mapped[str | None] = mapped_column(String(120))
    contact_email: Mapped[str | None] = mapped_column(String(255))
    contact_phone: Mapped[str | None] = mapped_column(String(30))
    location: Mapped[str | None] = mapped_column(String(200))
    website: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="active")
    fee_percentage: Mapped[float | None] = mapped_column(Float)
    payment_terms_days: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    positions: Mapped[list["Position"]] = relationship(
        back_populates="client", cascade="all, delete-orphan", passive_deletes=True
    )


class Position(Base):
    __tablename__ = "positions"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    job_code: Mapped[str | None] = mapped_column(String(50), unique=True)
    department: Mapped[str | None] = mapped_column(String(120))
    location: Mapped[str | None] = mapped_column(String(200))
    work_mode: Mapped[str] = mapped_column(String(20), default="onsite")
    employment_type: Mapped[str] = mapped_column(String(20), default="full_time")
    min_experience: Mapped[float | None] = mapped_column(Float)
    max_experience: Mapped[float | None] = mapped_column(Float)
    min_budget: Mapped[float | None] = mapped_column(Float)  # LPA
    max_budget: Mapped[float | None] = mapped_column(Float)  # LPA
    openings: Mapped[int] = mapped_column(Integer, default=1)
    skills: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)
    target_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    client: Mapped[Client] = relationship(back_populates="positions")
    recruiters: Mapped[list[User]] = relationship(secondary=position_recruiters, back_populates="positions")
    candidates: Mapped[list["Candidate"]] = relationship(
        back_populates="position", cascade="all, delete-orphan", passive_deletes=True
    )


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(primary_key=True)
    position_id: Mapped[int] = mapped_column(ForeignKey("positions.id", ondelete="CASCADE"), index=True)
    recruiter_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    full_name: Mapped[str] = mapped_column(String(150))
    email: Mapped[str | None] = mapped_column(String(255), index=True)
    phone: Mapped[str | None] = mapped_column(String(30), index=True)
    current_company: Mapped[str | None] = mapped_column(String(200))
    current_designation: Mapped[str | None] = mapped_column(String(150))
    total_experience: Mapped[float | None] = mapped_column(Float)
    relevant_experience: Mapped[float | None] = mapped_column(Float)
    current_ctc: Mapped[float | None] = mapped_column(Float)  # LPA
    expected_ctc: Mapped[float | None] = mapped_column(Float)  # LPA
    offered_ctc: Mapped[float | None] = mapped_column(Float)  # LPA
    notice_period_days: Mapped[int | None] = mapped_column(Integer)
    current_location: Mapped[str | None] = mapped_column(String(150))
    preferred_location: Mapped[str | None] = mapped_column(String(150))
    skills: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str | None] = mapped_column(String(30))
    resume_url: Mapped[str | None] = mapped_column(String(500))
    stage: Mapped[str] = mapped_column(String(30), default="sourced", index=True)
    max_stage_rank: Mapped[int] = mapped_column(Integer, default=1)
    stage_updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    joining_date: Mapped[date | None] = mapped_column(Date)
    remarks: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    position: Mapped[Position] = relationship(back_populates="candidates")
    recruiter: Mapped[User | None] = relationship()
    interviews: Mapped[list["InterviewRound"]] = relationship(
        back_populates="candidate",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="InterviewRound.round_number",
    )
    history: Mapped[list["StageHistory"]] = relationship(
        back_populates="candidate",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="StageHistory.changed_at.desc()",
    )


class InterviewRound(Base):
    __tablename__ = "interview_rounds"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), index=True)
    round_number: Mapped[int] = mapped_column(Integer, default=1)
    round_name: Mapped[str | None] = mapped_column(String(120))
    scheduled_at: Mapped[datetime | None] = mapped_column(UTCDateTime, index=True)
    mode: Mapped[str] = mapped_column(String(20), default="video")
    interviewer: Mapped[str | None] = mapped_column(String(150))
    meeting_link: Mapped[str | None] = mapped_column(String(500))
    result: Mapped[str] = mapped_column(String(20), default="pending")
    feedback: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    candidate: Mapped[Candidate] = relationship(back_populates="interviews")


class StageHistory(Base):
    __tablename__ = "stage_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), index=True)
    from_stage: Mapped[str | None] = mapped_column(String(30))
    to_stage: Mapped[str] = mapped_column(String(30), index=True)
    note: Mapped[str | None] = mapped_column(Text)
    changed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    changed_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)

    candidate: Mapped[Candidate] = relationship(back_populates="history")
    changed_by: Mapped[User | None] = relationship()


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("user_id", "work_date", name="uq_attendance_user_day"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    work_date: Mapped[date] = mapped_column(Date, index=True)
    login_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    logout_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    status: Mapped[str] = mapped_column(String(20), default="present")  # present | late
    work_summary: Mapped[str | None] = mapped_column(Text)

    user: Mapped[User] = relationship()
