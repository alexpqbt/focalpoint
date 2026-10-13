from fastapi import FastAPI, Query, Depends, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, StreamingResponse
from livekit import api
import os
from dotenv import load_dotenv
from networking import get_local_ip
import log_session
from pydantic import BaseModel
import json
import db
from paths import BASE

load_dotenv(BASE / ".env")

app = FastAPI()
db.init()

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
    answers: str | None = None,
):
    if role == "presenter":
        client_ip = request.headers.get("x-real-ip", request.client.host)
        if client_ip not in ("127.0.0.1", "::1"):
            raise HTTPException(status_code=403, detail="Presenter access is restricted to this machine")

    can_publish = role == "presenter"
    is_admin = role == "presenter"
    name = name if name else identity

    attributes = {}
    if role != "presenter" and answers:
        try:
            raw = json.loads(answers)
        except ValueError:
            raise HTTPException(status_code=400, detail="answers must be valid JSON")
        if not isinstance(raw, dict):
            raise HTTPException(status_code=400, detail="answers must be an object")
        for label in room_config["user_inputs"]:
            value = raw.get(label)
            if isinstance(value, str) and value.strip():
                attributes[label] = value.strip()[:50]

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
    if attributes:
        token = token.with_attributes(attributes)
    return token.to_jwt()

@app.get("/config")
def get_config():
    return {
        "livekit_uri": os.environ.get("LIVEKIT_URL"),
        "server_ip": get_local_ip()
    }

room_config = {"user_inputs": [], "fields": []}

class SessionField(BaseModel):
    name: str
    value: str = ""

class RoomConfig(BaseModel):
    user_inputs: list[str]
    fields: list[SessionField] = []

@app.post("/room-config")
async def set_room_config(cfg: RoomConfig, request: Request):
    client_ip = request.headers.get("x-real-ip", request.client.host)
    if client_ip not in ("127.0.0.1", "::1"):
        raise HTTPException(status_code=403, detail="Host access is restricted to this machine")

    labels = [l.strip() for l in cfg.user_inputs if l.strip()]
    if len(labels) > 5 or any(len(l) > 30 for l in labels):
        raise HTTPException(status_code=400, detail="Max 5 inputs, 30 characters each")
    if len({l.lower() for l in labels}) != len(labels):
        raise HTTPException(status_code=400, detail="Duplicate labels")

    fields = [
        {"name": f.name.strip(), "value": f.value.strip()}
        for f in cfg.fields
        if f.name.strip()
    ]
    if len(fields) > 6 or any(len(f["name"]) > 30 or len(f["value"]) > 50 for f in fields):
        raise HTTPException(status_code=400, detail="Max 6 fields; names 30 characters, values 50")
    if len({f["name"].lower() for f in fields}) != len(fields):
        raise HTTPException(status_code=400, detail="Duplicate field names")

    room_config["user_inputs"] = labels
    room_config["fields"] = fields
    return room_config

@app.get("/room-config")
async def get_room_config():
    return room_config

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
    async with api.LiveKitAPI(api_key = API_KEY, api_secret = API_SECRET) as lkapi:
        res = await lkapi.room.list_participants(
            api.ListParticipantsRequest(room=ROOM_NAME)
        )
    participants = [
        {
            "identity": p.identity,
            "name": p.name,
            "joined_at": p.joined_at,
            "attributes": dict(p.attributes),
        }
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
            iter([log_session.to_csv_bytes(room_config["user_inputs"], room_config["fields"])]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=log_session.csv"},
        )

    if format == "pdf":
        return StreamingResponse(
            iter([log_session.to_pdf_bytes(room_config["user_inputs"], room_config["fields"])]),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=log_session.pdf"},
        )

    raise HTTPException(status_code=400, detail="format must be csv or pdf")

@app.post("/logs/reset")
async def reset_logs(_: None = Depends(verify_admin)):
    log_session.reset()
    return {"status": "reset"}

class TableData(BaseModel):
    columns: list[str]
    rows: list[list[str]]

def require_localhost(request: Request) -> None:
    client_ip = request.headers.get("x-real-ip", request.client.host)
    if client_ip not in ("127.0.0.1", "::1"):
        raise HTTPException(status_code=403, detail="Host access is restricted to this machine")

@app.get("/logs/snapshot")
async def logs_snapshot(request: Request):
    require_localhost(request)
    return log_session.snapshot(room_config["user_inputs"], room_config["fields"])

@app.post("/logs/render")
async def logs_render(table: TableData, request: Request, format: str = Query(default="csv")):
    require_localhost(request)
    if len(table.columns) > 20 or len(table.rows) > 5000:
        raise HTTPException(status_code=400, detail="Table too large")
    if any(len(r) != len(table.columns) for r in table.rows):
        raise HTTPException(status_code=400, detail="Row length does not match columns")

    if format == "csv":
        return StreamingResponse(
            iter([log_session.csv_from_table(table.columns, table.rows)]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=log_session.csv"},
        )
    if format == "pdf":
        return StreamingResponse(
            iter([log_session.pdf_from_table(table.columns, table.rows)]),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=log_session.pdf"},
        )
    raise HTTPException(status_code=400, detail="format must be csv or pdf")

class SavedLogIn(BaseModel):
    columns: list[str]
    rows: list[list[str]]
    field_values: list[str] = []

@app.post("/logs/saved")
async def save_session_log(data: SavedLogIn, request: Request):
    require_localhost(request)
    if len(data.columns) > 20 or len(data.rows) > 5000:
        raise HTTPException(status_code=400, detail="Table too large")
    if any(len(r) != len(data.columns) for r in data.rows):
        raise HTTPException(status_code=400, detail="Row length does not match columns")
    if not data.rows:
        return {"saved": False}
    return {"saved": True, "entry": db.save_log(data.columns, data.rows, data.field_values)}

@app.get("/logs/saved")
async def list_saved_logs(request: Request):
    require_localhost(request)
    return db.list_logs()

class RoomIn(BaseModel):
    room_size: str = "51"
    fields: list[SessionField] = []
    user_inputs: list[str] = []

def clean_room(data: RoomIn):
    size = data.room_size.strip() or "51"
    if not size.isdigit() or not (1 <= int(size) <= 51):
        raise HTTPException(status_code=400, detail="Room size must be a number from 1 to 51")

    labels = [l.strip() for l in data.user_inputs if l.strip()]
    if len(labels) > 5 or any(len(l) > 30 for l in labels):
        raise HTTPException(status_code=400, detail="Max 5 inputs, 30 characters each")
    if len({l.lower() for l in labels}) != len(labels):
        raise HTTPException(status_code=400, detail="Duplicate user inputs")

    fields = [
        {"name": f.name.strip(), "value": f.value.strip()}
        for f in data.fields
        if f.name.strip()
    ]
    if len(fields) > 6 or any(len(f["name"]) > 30 or len(f["value"]) > 50 for f in fields):
        raise HTTPException(status_code=400, detail="Max 6 fields; names 30 characters, values 50")
    if len({f["name"].lower() for f in fields}) != len(fields):
        raise HTTPException(status_code=400, detail="Duplicate field names")

    return size, fields, labels

@app.get("/rooms")
async def list_rooms(request: Request):
    require_localhost(request)
    return db.list_rooms()

@app.post("/rooms")
async def create_room(data: RoomIn, request: Request):
    require_localhost(request)
    size, fields, labels = clean_room(data)
    return db.create_room(size, fields, labels)

@app.put("/rooms/{room_id}")
async def update_room(room_id: int, data: RoomIn, request: Request):
    require_localhost(request)
    size, fields, labels = clean_room(data)
    room = db.update_room(room_id, size, fields, labels)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    return room

@app.delete("/rooms/{room_id}")
async def delete_room(room_id: int, request: Request):
    require_localhost(request)
    if not db.delete_room(room_id):
        raise HTTPException(status_code=404, detail="Room not found")
    return {"status": "deleted", "id": room_id}