from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, BeforeValidator
from typing import List, Optional, Annotated, Any
import uuid
import jwt
import requests
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
JWT_SECRET = os.environ.get('JWT_SECRET', 'change-me-dev-secret')
JWT_ALGO = 'HS256'
JWT_EXPIRE_DAYS = 30

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------- Models ----------
PyObjectId = Annotated[str, BeforeValidator(str)]


class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    google_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class GoogleAuthRequest(BaseModel):
    code: str


class DocumentMeta(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    page_count: int = 0
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class DocumentSave(BaseModel):
    id: Optional[str] = None
    name: str
    page_count: int = 0
    state: Any = None  # annotation + structure state (client managed)


# ---------- Auth helpers ----------
def create_token(user_id: str) -> str:
    payload = {
        'sub': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Missing token')
    token = authorization.split(' ', 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail='Invalid token')
    user = await db.users.find_one({'id': payload['sub']}, {'_id': 0})
    if not user:
        raise HTTPException(status_code=401, detail='User not found')
    return user


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "PDF Studio API"}


@api_router.post("/auth/google")
async def auth_google(body: GoogleAuthRequest):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail='Google OAuth not configured on server')
    # Exchange authorization code for tokens (popup auth-code flow uses redirect_uri 'postmessage')
    try:
        token_res = requests.post('https://oauth2.googleapis.com/token', data={
            'code': body.code,
            'client_id': GOOGLE_CLIENT_ID,
            'client_secret': GOOGLE_CLIENT_SECRET,
            'redirect_uri': 'postmessage',
            'grant_type': 'authorization_code',
        }, timeout=15)
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f'Token exchange failed: {e}')
    if token_res.status_code != 200:
        logger.error('Google token exchange error: %s', token_res.text)
        raise HTTPException(status_code=401, detail='Google authentication failed')
    tokens = token_res.json()
    access_token = tokens.get('access_token')
    userinfo_res = requests.get('https://www.googleapis.com/oauth2/v3/userinfo',
                                headers={'Authorization': f'Bearer {access_token}'}, timeout=15)
    if userinfo_res.status_code != 200:
        raise HTTPException(status_code=401, detail='Failed to fetch user info')
    info = userinfo_res.json()

    google_id = info['sub']
    existing = await db.users.find_one({'google_id': google_id})
    if existing:
        user = User(**{k: existing[k] for k in User.model_fields if k in existing})
    else:
        user = User(google_id=google_id, email=info.get('email', ''),
                    name=info.get('name', info.get('email', 'User')),
                    picture=info.get('picture'))
        await db.users.insert_one(user.model_dump())
    return {'token': create_token(user.id), 'user': user.model_dump()}


@api_router.get("/auth/me")
async def me(current=Depends(get_current_user)):
    return current


@api_router.get("/documents", response_model=List[DocumentMeta])
async def list_documents(current=Depends(get_current_user)):
    docs = await db.documents.find({'user_id': current['id']}, {'_id': 0, 'state': 0}).sort('updated_at', -1).to_list(200)
    return docs


@api_router.get("/documents/{doc_id}")
async def get_document(doc_id: str, current=Depends(get_current_user)):
    doc = await db.documents.find_one({'id': doc_id, 'user_id': current['id']}, {'_id': 0})
    if not doc:
        raise HTTPException(status_code=404, detail='Not found')
    return doc


@api_router.post("/documents")
async def save_document(body: DocumentSave, current=Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    doc_id = body.id or str(uuid.uuid4())
    doc = {
        'id': doc_id,
        'user_id': current['id'],
        'name': body.name,
        'page_count': body.page_count,
        'state': body.state,
        'updated_at': now,
    }
    await db.documents.update_one({'id': doc_id, 'user_id': current['id']},
                                  {'$set': doc}, upsert=True)
    return {'id': doc_id, 'updated_at': now}


@api_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, current=Depends(get_current_user)):
    await db.documents.delete_one({'id': doc_id, 'user_id': current['id']})
    return {'ok': True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
