"""Initial admin account and optional demo data so the app is useful on first run."""

import random
from datetime import date, datetime, time, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import get_settings
from .models import Attendance, Candidate, Client, InterviewRound, Position, StageHistory, User
from .pipeline import CANDIDATE_SOURCES, PROGRESS_STAGES, stage_rank
from .database import utcnow
from .security import hash_password
from .services.timeutil import local_today

DEFAULT_ADMIN_EMAIL = "admin@talentbridge.com"
DEFAULT_PASSWORD = "Admin@123"
DEMO_PASSWORD = "Recruit@123"

FIRST = "Aarav Vivaan Aditya Arjun Sai Reyansh Krishna Ishaan Rohan Kabir Ananya Diya Aadhya Saanvi Myra Kavya Priya Sneha Meera Nisha Rahul Vikram Karthik Deepak Suresh Lakshmi Divya Pooja Harini Swathi Farhan Imran Joseph Neha Rakesh Manoj Gayathri Varun Akash Tanvi".split()
LAST = "Sharma Iyer Reddy Nair Menon Gupta Patel Kumar Singh Rao Das Joshi Pillai Mehta Verma Krishnan Banerjee Chatterjee Naidu Shetty Kapoor Bose Rajan Subramanian Varma".split()
COMPANIES = "Infosys TCS Wipro Accenture Cognizant HCL Capgemini Deloitte Zoho Freshworks Flipkart Swiggy Amazon Oracle IBM Mindtree Mphasis LTIMindtree".split()
CITIES = ["Bengaluru", "Chennai", "Hyderabad", "Pune", "Mumbai", "Noida", "Gurugram", "Kochi", "Coimbatore"]

CLIENTS = [
    ("Nimbus Technologies", "IT Services", "Ravi Shankar", "Bengaluru", "active", 8.33),
    ("Orion Healthcare", "Healthcare", "Dr. Kavitha Rao", "Chennai", "active", 10.0),
    ("Vertex FinServ", "Banking & Finance", "Amit Khanna", "Mumbai", "active", 8.0),
    ("BluePeak Retail", "Retail & E-commerce", "Sunita Menon", "Hyderabad", "active", 7.5),
    ("Quantum Logistics", "Logistics", "Harish Gowda", "Pune", "active", 9.0),
    ("Greenleaf Pharma", "Pharmaceuticals", "Neelam Arora", "Hyderabad", "prospect", 8.5),
]

POSITIONS = [
    (0, "Senior Python Developer", "Engineering", "Python, FastAPI, PostgreSQL, AWS", (5, 8), (18, 28), 3, "critical"),
    (0, "React Frontend Engineer", "Engineering", "React, Next.js, TypeScript, Tailwind", (3, 6), (12, 20), 2, "high"),
    (0, "DevOps Engineer", "Platform", "Kubernetes, Terraform, CI/CD, AWS", (4, 7), (15, 24), 1, "medium"),
    (1, "Staff Nurse", "Clinical", "ICU, Patient Care, BLS", (2, 5), (3.5, 6), 6, "high"),
    (1, "Medical Coder", "Operations", "ICD-10, CPT, HCC", (1, 4), (3, 5.5), 4, "medium"),
    (2, "Relationship Manager", "Sales", "Wealth Management, HNI Clients, NISM", (3, 7), (8, 14), 5, "high"),
    (2, "Credit Risk Analyst", "Risk", "Credit Risk, SAS, SQL, Basel", (2, 5), (9, 15), 2, "medium"),
    (3, "Store Manager", "Retail Ops", "Retail Operations, P&L, Team Handling", (5, 10), (6, 10), 4, "medium"),
    (3, "Category Manager", "Merchandising", "Category Management, Vendor Negotiation", (4, 8), (14, 22), 1, "low"),
    (4, "Warehouse Supervisor", "Operations", "WMS, Inventory, Team Handling", (3, 6), (4, 7), 3, "high"),
    (4, "Fleet Operations Lead", "Operations", "Fleet Management, Route Planning", (4, 8), (7, 11), 1, "medium"),
    (5, "Regulatory Affairs Associate", "Regulatory", "CTD, USFDA, Dossier Preparation", (2, 5), (6, 10), 2, "medium"),
]

RECRUITERS = [
    ("Priya Venkatesh", "priya@talentbridge.com", "Senior Recruiter", 6),
    ("Karthik Raman", "karthik@talentbridge.com", "Recruiter", 5),
    ("Sneha Kulkarni", "sneha@talentbridge.com", "Recruiter", 5),
    ("Farhan Siddiqui", "farhan@talentbridge.com", "Associate Recruiter", 4),
]


def seed(db: Session, demo: bool = True) -> None:
    if db.scalar(select(func.count()).select_from(User)):
        return
    admin = User(
        full_name="Admin",
        email=DEFAULT_ADMIN_EMAIL,
        hashed_password=hash_password(DEFAULT_PASSWORD),
        role="admin",
        designation="Director",
    )
    db.add(admin)
    db.flush()
    if demo:
        _seed_demo(db, admin)
    db.commit()


def _utc(day: date, hour: int, minute: int = 0) -> datetime:
    tz = get_settings().tz
    return datetime.combine(day, time(hour, minute), tzinfo=tz)


def _seed_demo(db: Session, admin: User) -> None:
    rng = random.Random(42)
    today = local_today()
    now = utcnow()
    demo_hash = hash_password(DEMO_PASSWORD)
    manager = User(
        full_name="Lakshmi Narayanan",
        email="manager@talentbridge.com",
        hashed_password=demo_hash,
        role="manager",
        designation="Delivery Manager",
    )
    recruiters = [
        User(full_name=n, email=e, hashed_password=demo_hash, role="recruiter", designation=d, daily_target=t)
        for n, e, d, t in RECRUITERS
    ]
    db.add_all([manager, *recruiters])
    db.flush()

    # Attendance for the last 30 days (Mon-Sat).
    for user in [manager, *recruiters]:
        for back in range(30, -1, -1):
            day = today - timedelta(days=back)
            if day.weekday() == 6 or rng.random() < 0.08:
                continue
            login = _utc(day, 9, rng.randint(0, 59))
            if login > now:
                continue
            late = login.timetz().replace(tzinfo=None) > time(9, 45)
            db.add(
                Attendance(
                    user_id=user.id,
                    work_date=day,
                    login_at=login,
                    last_seen_at=min(login + timedelta(hours=8, minutes=rng.randint(0, 90)), now),
                    logout_at=login + timedelta(hours=8, minutes=rng.randint(0, 90)) if back else None,
                    status="late" if late else "present",
                    work_summary=rng.choice(
                        [
                            "Sourced profiles on Naukri and LinkedIn, screened candidates.",
                            "Scheduled interviews and followed up on feedback.",
                            "Coordinated offer discussions with client HR.",
                            "Screening calls and shortlisting for priority roles.",
                        ]
                    ),
                )
            )

    clients = []
    for i, (name, industry, contact, city, status, fee) in enumerate(CLIENTS):
        slug = name.split()[0].lower()
        client = Client(
            name=name,
            industry=industry,
            contact_person=contact,
            contact_email=f"hr@{slug}.example.com",
            contact_phone=f"+91 98{rng.randint(10000000, 99999999)}",
            location=city,
            website=f"https://www.{slug}.example.com",
            status=status,
            fee_percentage=fee,
            payment_terms_days=rng.choice([30, 45, 60]),
            notes="Key account. Weekly sync every Monday." if i == 0 else None,
            created_by_id=admin.id,
            created_at=_utc(today - timedelta(days=170 - i * 12), 11),
        )
        clients.append(client)
    db.add_all(clients)
    db.flush()

    for idx, (ci, title, dept, skills, exp, budget, openings, priority) in enumerate(POSITIONS):
        created = today - timedelta(days=rng.randint(25, 160))
        position = Position(
            client_id=clients[ci].id,
            title=title,
            job_code=f"TB-{2026}-{idx + 101}",
            department=dept,
            location=clients[ci].location,
            work_mode=rng.choice(["onsite", "hybrid", "onsite", "remote"]),
            employment_type="full_time",
            min_experience=exp[0],
            max_experience=exp[1],
            min_budget=budget[0],
            max_budget=budget[1],
            openings=openings,
            skills=skills,
            description=f"We are hiring a {title} for {clients[ci].name}. Key skills: {skills}.",
            priority=priority,
            status="on_hold" if idx == 8 else "open",
            target_date=today + timedelta(days=rng.randint(10, 60)),
            created_by_id=manager.id,
            created_at=_utc(created, 10),
            recruiters=rng.sample(recruiters, k=2),
        )
        db.add(position)
        db.flush()
        for _ in range(rng.randint(6, 14)):
            _seed_candidate(db, rng, position, created, today)
        db.flush()
        joined = sum(c.stage == "joined" for c in position.candidates)
        if joined >= position.openings:
            position.openings = joined + (1 if idx % 3 else 0)
            if joined >= position.openings:
                position.status = "filled"


def _seed_candidate(db: Session, rng: random.Random, position: Position, opened: date, today: date) -> None:
    recruiter = rng.choice(position.recruiters)
    first, last = rng.choice(FIRST), rng.choice(LAST)
    lo, hi = position.min_experience or 1, position.max_experience or 8
    exp = round(rng.uniform(lo, hi + 1), 1)
    ctc = round(rng.uniform(position.min_budget or 4, position.max_budget or 12) * rng.uniform(0.6, 0.95), 1)
    added = opened + timedelta(days=int(rng.random() ** 1.3 * max((today - opened).days, 1)))
    candidate = Candidate(
        position_id=position.id,
        recruiter_id=recruiter.id,
        full_name=f"{first} {last}",
        email=f"{first.lower()}.{last.lower()}{rng.randint(1, 999)}@example.com",
        phone=f"9{rng.randint(100000000, 999999999)}",
        current_company=rng.choice(COMPANIES),
        current_designation=position.title.replace("Senior ", "").replace("Lead", "Executive"),
        total_experience=exp,
        relevant_experience=round(exp * rng.uniform(0.6, 1), 1),
        current_ctc=ctc,
        expected_ctc=round(ctc * rng.uniform(1.15, 1.45), 1),
        notice_period_days=rng.choice([0, 15, 30, 30, 60, 60, 90]),
        current_location=rng.choice(CITIES),
        preferred_location=position.location,
        skills=position.skills,
        source=rng.choice(CANDIDATE_SOURCES[:6]),
        created_at=min(_utc(added, rng.randint(10, 17), rng.randint(0, 59)), utcnow() - timedelta(minutes=5)),
        remarks=rng.choice([None, "Good communication", "Immediate joiner", "Negotiable on CTC", "Strong fundamentals"]),
        stage="sourced",
        max_stage_rank=1,
    )
    db.add(candidate)
    db.flush()

    # Walk the pipeline to a random final stage, spreading transitions between creation and now.
    target_rank = rng.choices(range(1, 12), weights=[14, 12, 14, 12, 9, 7, 5, 6, 5, 4, 5])[0]
    exit_stage = rng.choices([None, "rejected", "dropped", "on_hold"], weights=[62, 25, 7, 6])[0]
    if target_rank >= stage_rank("joined"):
        exit_stage = None
    pending = None if exit_stage is None else ("rejected" if exit_stage == "rejected" else "on_hold")
    path = [s.key for s in PROGRESS_STAGES[1:] if s.rank <= target_rank]
    if exit_stage:
        path.append(exit_stage)
    window = (utcnow() - timedelta(minutes=10) - candidate.created_at).total_seconds()
    gap = min(timedelta(days=4).total_seconds(), window / (len(path) + 1)) if path else 0

    moment = candidate.created_at
    history = [StageHistory(candidate_id=candidate.id, from_stage=None, to_stage="sourced", note="Candidate added",
                            changed_by_id=recruiter.id, changed_at=moment)]
    current = "sourced"
    round_no = 0
    for key in path:
        moment = moment + timedelta(seconds=gap * rng.uniform(0.6, 1.0))
        rank = stage_rank(key)
        if key == "interview_scheduled":
            round_no = 1
            _add_round(db, candidate, 1, moment, gap, "selected" if target_rank > 4 else pending, rng, today)
        elif key in ("round1_selected", "round2_selected") and rank < target_rank:
            round_no += 1
            _add_round(db, candidate, round_no, moment, gap, "selected" if rank + 1 < target_rank else pending, rng, today)
        note = "Not a fit for the role" if key == "rejected" else None
        history.append(StageHistory(candidate_id=candidate.id, from_stage=current, to_stage=key, note=note,
                                    changed_by_id=recruiter.id, changed_at=moment))
        current = key
    db.add_all(history)
    candidate.stage = current
    candidate.max_stage_rank = target_rank
    candidate.stage_updated_at = moment
    candidate.updated_at = moment
    if current in ("offer_released", "offer_accepted", "joined"):
        candidate.offered_ctc = candidate.expected_ctc
    if current == "joined":
        candidate.joining_date = (moment + timedelta(days=rng.randint(7, 30))).date()


def _add_round(db, candidate, number, moment, gap, result, rng, today) -> None:
    # Held between being scheduled and the next pipeline move, during office hours.
    held = (moment + timedelta(seconds=gap * 0.5)).astimezone(get_settings().tz)
    scheduled = _utc(held.date(), rng.randint(10, 17), rng.choice([0, 30]))
    scheduled = min(scheduled, utcnow() - timedelta(hours=2))
    if result is None:
        # Pending rounds land around today so the calendar has upcoming interviews.
        scheduled = _utc(today + timedelta(days=rng.randint(-1, 6)), rng.randint(10, 17), rng.choice([0, 30]))
    db.add(
        InterviewRound(
            candidate_id=candidate.id,
            round_number=number,
            round_name={1: "Technical Round 1", 2: "Technical Round 2", 3: "Managerial Round"}.get(number),
            scheduled_at=scheduled,
            mode=rng.choice(["video", "video", "phone", "in_person"]),
            interviewer=rng.choice(["Ravi Shankar", "Anil Kumar", "Deepa S", "Client Panel"]),
            result=result or "pending",
            feedback="Good problem solving and communication." if result == "selected" else None,
        )
    )


