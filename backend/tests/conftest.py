import os
import tempfile

import pytest

_db_dir = tempfile.mkdtemp()
# Set TEST_DATABASE_URL to run the suite against PostgreSQL.
os.environ["HR_DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", f"sqlite:///{_db_dir}/test.db")
os.environ["HR_SEED_DEMO_DATA"] = "false"

from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import DEFAULT_ADMIN_EMAIL, DEFAULT_PASSWORD  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    with TestClient(app) as c:  # lifespan creates tables and the default admin
        yield c


def login(client, email, password) -> dict:
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture()
def admin(client):
    return login(client, DEFAULT_ADMIN_EMAIL, DEFAULT_PASSWORD)


@pytest.fixture()
def setup(client, admin):
    """A client, a recruiter assigned to one position, and a second unassigned recruiter."""
    r1 = client.post("/api/users", headers=admin, json={
        "full_name": "Rita Recruiter", "email": "rita@example.com", "password": "secret123", "role": "recruiter"})
    r2 = client.post("/api/users", headers=admin, json={
        "full_name": "Omar Other", "email": "omar@example.com", "password": "secret123", "role": "recruiter"})
    assert r1.status_code == r2.status_code == 201
    c = client.post("/api/clients", headers=admin, json={"name": "Acme Corp", "industry": "IT", "contact_email": ""})
    assert c.status_code == 201, c.text
    p = client.post("/api/positions", headers=admin, json={
        "client_id": c.json()["id"], "title": "Backend Engineer", "openings": 2, "priority": "high",
        "min_experience": 2, "max_experience": 5, "recruiter_ids": [r1.json()["id"]]})
    assert p.status_code == 201, p.text
    return {
        "client": c.json(),
        "position": p.json(),
        "rita": login(client, "rita@example.com", "secret123"),
        "rita_id": r1.json()["id"],
        "omar": login(client, "omar@example.com", "secret123"),
    }
