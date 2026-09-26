from tests.conftest import login


def test_login_records_attendance(client, admin):
    r = client.get("/api/auth/me", headers=admin)
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["role"] == "admin"
    assert body["attendance"]["status"] in ("present", "late")


def test_bad_credentials_and_missing_token(client):
    assert client.post("/api/auth/login", json={"email": "admin@talentbridge.com", "password": "nope"}).status_code == 401
    assert client.get("/api/clients").status_code == 401


def test_recruiter_cannot_manage_clients(client, setup):
    r = client.post("/api/clients", headers=setup["rita"], json={"name": "Nope Ltd"})
    assert r.status_code == 403
    assert client.get("/api/clients", headers=setup["rita"]).status_code == 200


def test_deactivated_user_cannot_login(client, admin, setup):
    client.patch(f"/api/users/{setup['rita_id']}", headers=admin, json={"is_active": False})
    r = client.post("/api/auth/login", json={"email": "rita@example.com", "password": "secret123"})
    assert r.status_code == 403


def test_check_out_with_summary(client, setup):
    r = client.post("/api/attendance/check-out", headers=setup["rita"], json={"work_summary": "Sourced 10 profiles"})
    assert r.status_code == 200
    assert r.json()["logout_at"] is not None
    history = client.get("/api/attendance/me", headers=setup["rita"]).json()
    assert history[0]["work_summary"] == "Sourced 10 profiles"


def test_change_password(client, setup):
    r = client.post("/api/auth/change-password", headers=setup["rita"],
                    json={"current_password": "secret123", "new_password": "newpass99"})
    assert r.status_code == 204
    login(client, "rita@example.com", "newpass99")
