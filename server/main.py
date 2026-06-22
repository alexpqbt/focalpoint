from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from livekit import api
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

API_KEY = os.environ.get("API_KEY", "fallback_key")
API_SECRET = os.environ.get("API_SECRET", "fallback_secret")
ROOM_NAME = os.environ.get("ROOM_NAME", "classroom")

@app.get("/token", response_class=PlainTextResponse)
async def get_token(
    role: str = Query(default="student"),
    identity: str = Query(default="student-guest"),
):
    can_publish = role == "presenter"

    token = api.AccessToken(API_KEY, API_SECRET) \
                .with_identity(identity) \
                .with_name(identity) \
                .with_grants(api.VideoGrants(
                    room_join=True,
                    room=ROOM_NAME,
                    can_publish=can_publish,
                    can_subscribe=True,
                ))
    return token.to_jwt()

