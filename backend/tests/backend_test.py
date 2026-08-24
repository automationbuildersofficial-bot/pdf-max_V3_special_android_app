"""Backend API tests for PDF Studio (auth + documents)."""
import os

import jwt
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
backend_env = dotenv_values("/app/backend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
JWT_SECRET = backend_env.get("JWT_SECRET")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- root ----------
class TestRoot:
    def test_root(self, api):
        r = api.get(f"{BASE_URL}/api/", timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("message") == "PDF Studio API"


# ---------- auth ----------
class TestAuth:
    def test_me_no_header(self, api):
        r = api.get(f"{BASE_URL}/api/auth/me", timeout=30)
        assert r.status_code == 401
        assert r.json().get("detail") == "Missing token"

    def test_me_malformed_header(self, api):
        r = api.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "token abc"}, timeout=30)
        assert r.status_code == 401

    def test_me_invalid_token(self, api):
        r = api.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "Bearer garbage.token.xyz"}, timeout=30)
        assert r.status_code == 401
        assert r.json().get("detail") == "Invalid token"

    def test_me_valid_token_unknown_user(self, api):
        """Signed token for a non-existent user must be rejected with 401 User not found."""
        assert JWT_SECRET, "JWT_SECRET missing from backend/.env"
        tok = jwt.encode({"sub": "no-such-user-id"}, JWT_SECRET, algorithm="HS256")
        r = api.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {tok}"}, timeout=30)
        assert r.status_code == 401
        assert r.json().get("detail") == "User not found"

    def test_google_not_configured(self, api):
        """Expected in this env: OAuth creds intentionally empty -> clean 500."""
        r = api.post(f"{BASE_URL}/api/auth/google", json={"code": "dummy-code"}, timeout=30)
        assert r.status_code == 500, r.text
        assert "not configured" in r.json().get("detail", "")

    def test_google_validation_error(self, api):
        r = api.post(f"{BASE_URL}/api/auth/google", json={}, timeout=30)
        assert r.status_code == 422


# ---------- documents (all gated) ----------
class TestDocumentsAuthGating:
    def test_list_documents_unauth(self, api):
        r = api.get(f"{BASE_URL}/api/documents", timeout=30)
        assert r.status_code == 401

    def test_get_document_unauth(self, api):
        r = api.get(f"{BASE_URL}/api/documents/abc", timeout=30)
        assert r.status_code == 401

    def test_save_document_unauth(self, api):
        r = api.post(f"{BASE_URL}/api/documents", json={"name": "TEST_doc", "page_count": 1}, timeout=30)
        assert r.status_code == 401

    def test_delete_document_unauth(self, api):
        r = api.delete(f"{BASE_URL}/api/documents/abc", timeout=30)
        assert r.status_code == 401


# ---------- documents CRUD with a seeded user + real JWT ----------
@pytest.fixture(scope="module")
def seeded_user():
    """Insert a TEST_ user directly into Mongo so the JWT flow can be exercised without Google."""
    import asyncio
    import uuid

    from motor.motor_asyncio import AsyncIOMotorClient

    mongo_url = backend_env.get("MONGO_URL")
    db_name = backend_env.get("DB_NAME")
    if not mongo_url or not db_name:
        pytest.skip("MONGO_URL/DB_NAME missing")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "google_id": "TEST_google_" + uid,
        "email": "TEST_qa@example.com",
        "name": "TEST QA",
        "picture": None,
        "created_at": "2026-01-01T00:00:00+00:00",
    }

    async def _setup():
        c = AsyncIOMotorClient(mongo_url)
        await c[db_name].users.insert_one(dict(doc))
        c.close()

    async def _teardown():
        c = AsyncIOMotorClient(mongo_url)
        await c[db_name].users.delete_many({"id": uid})
        await c[db_name].documents.delete_many({"user_id": uid})
        c.close()

    asyncio.run(_setup())
    yield doc
    asyncio.run(_teardown())


@pytest.fixture(scope="module")
def auth_client(api, seeded_user):
    assert JWT_SECRET, "JWT_SECRET missing"
    tok = jwt.encode({"sub": seeded_user["id"]}, JWT_SECRET, algorithm="HS256")
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {tok}"})
    return s


class TestDocumentsCRUD:
    def test_me_returns_user_without_mongo_id(self, auth_client, seeded_user):
        r = auth_client.get(f"{BASE_URL}/api/auth/me", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == seeded_user["email"]
        assert data["id"] == seeded_user["id"]
        assert "_id" not in data

    def test_create_then_get_and_list(self, auth_client):
        payload = {"name": "TEST_doc_one", "page_count": 3, "state": {"pages": [1, 2, 3]}}
        r = auth_client.post(f"{BASE_URL}/api/documents", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body["id"], str) and body["id"]
        doc_id = body["id"]

        g = auth_client.get(f"{BASE_URL}/api/documents/{doc_id}", timeout=30)
        assert g.status_code == 200, g.text
        gd = g.json()
        assert gd["name"] == "TEST_doc_one"
        assert gd["page_count"] == 3
        assert gd["state"] == {"pages": [1, 2, 3]}
        assert "_id" not in gd

        li = auth_client.get(f"{BASE_URL}/api/documents", timeout=30)
        assert li.status_code == 200
        ids = [d["id"] for d in li.json()]
        assert doc_id in ids
        assert all("state" not in d for d in li.json())

    def test_update_persists(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/documents", json={"name": "TEST_orig", "page_count": 1}, timeout=30)
        doc_id = r.json()["id"]
        u = auth_client.post(
            f"{BASE_URL}/api/documents",
            json={"id": doc_id, "name": "TEST_updated", "page_count": 9, "state": {"v": 2}},
            timeout=30,
        )
        assert u.status_code == 200
        assert u.json()["id"] == doc_id
        g = auth_client.get(f"{BASE_URL}/api/documents/{doc_id}", timeout=30).json()
        assert g["name"] == "TEST_updated"
        assert g["page_count"] == 9
        assert g["state"] == {"v": 2}

    def test_delete_then_404(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/documents", json={"name": "TEST_del", "page_count": 1}, timeout=30)
        doc_id = r.json()["id"]
        d = auth_client.delete(f"{BASE_URL}/api/documents/{doc_id}", timeout=30)
        assert d.status_code == 200
        assert d.json() == {"ok": True}
        g = auth_client.get(f"{BASE_URL}/api/documents/{doc_id}", timeout=30)
        assert g.status_code == 404

    def test_get_unknown_document_404(self, auth_client):
        g = auth_client.get(f"{BASE_URL}/api/documents/does-not-exist", timeout=30)
        assert g.status_code == 404

    def test_create_validation_error(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/documents", json={"page_count": 1}, timeout=30)
        assert r.status_code == 422
