from fastapi import FastAPI, Query, Depends, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, StreamingResponse
from livekit import api
import os
from dotenv import load_dotenv
from networking import get_local_ip
import log_session

load_dotenv("../.env")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = os.environ.get("LIVEKIT_API_KEY", "fallback_key")
API_SECRET = os.environ.get("LIVEKIT_API_SECRET", "fallback_secret")
ROOM_NAME = os.environ.get("LIVEKIT_ROOM_NAME", "classroom")
os.environ["LIVEKIT_URL"] = f"ws://{get_local_ip()}:7880"

@app.get("/token", response_class=PlainTextResponse)
async def get_token(
    request: Request,
    role: str = Query(default="student"),
    identity: str = Query(default="student-guest"),
    name: str | None = None,
):
    if role == "presenter":
        client_ip = request.headers.get("x-real-ip", request.client.host)
        if client_ip not in ("127.0.0.1", "::1"):
            raise HTTPException(status_code=403, detail="Presenter access is restricted to this machine")

    can_publish = role == "presenter"
    is_admin = role == "presenter"
    name = name if name else identity

    token = api.AccessToken(API_KEY, API_SECRET) \
                .with_identity(identity) \
                .with_name(name) \
                .with_grants(api.VideoGrants(
                    room_join=True,
                    room=ROOM_NAME,
                    can_publish=can_publish,
                    can_subscribe=True,
                    room_admin=is_admin,
                ))
    return token.to_jwt()

@app.get("/config")
def get_config():
    return {
        "livekit_uri": os.environ.get("LIVEKIT_URL"),
        "server_ip": get_local_ip()
    }

async def verify_admin(authorization: str = Header(...)) -> None:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ")
    verifier = api.TokenVerifier(API_KEY, API_SECRET)
    try:
        claims = verifier.verify(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    if not claims.video.room_admin:
        raise HTTPException(status_code=403, detail="roomAdmin grant required")

@app.get("/participants")
async def list_participants(_: None = Depends(verify_admin)):
    async with api.LiveKitAPI() as lkapi:
        res = await lkapi.room.list_participants(
            api.ListParticipantsRequest(room=ROOM_NAME)
        )
    participants = [
        {"identity": p.identity, "name": p.name, "joined_at": p.joined_at}
        for p in res.participants
        if p.identity != 'presenter' or p.name != 'presenter'
    ]
    log_session.record_events(participants)
    return {"count": len(participants), "participants": participants}

@app.post("/participants/{identity}/remove")
async def remove_participant(identity: str, _: None = Depends(verify_admin)):
    async with api.LiveKitAPI() as lkapi:
        try:
            await lkapi.room.remove_participant(
                api.RoomParticipantIdentity(room=ROOM_NAME, identity=identity)
            )
        except Exception as e:
            raise HTTPException(status_code=404, detail=str(e))
    return {"status": "removed", "identity": identity}

@app.get("/logs/export")
async def export_logs(format: str = Query(default="csv"), _: None = Depends(verify_admin)):
    if format == "csv":
        return StreamingResponse(
            iter([log_session.to_csv_bytes()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=log_session.csv"},
        )

    if format == "pdf":
        return StreamingResponse(
            iter([log_session.to_pdf_bytes()]),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=log_session.pdf"},
        )

    raise HTTPException(status_code=400, detail="format must be csv or pdf")

@app.post("/logs/reset")
async def reset_logs(_: None = Depends(verify_admin)):
    log_session.reset()
    return {"status": "reset"}