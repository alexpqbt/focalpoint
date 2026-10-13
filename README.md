# Focalpoint

A self-contained, browser-based classroom screen broadcasting system designed
for students with visual difficulties. The host shares their screen once,
and multiple students can view it in real-time on their own devices
through a private local WiFi network, with no internet connection required.

## The Problem

Students with visual difficulties in a classroom cannot always read presentation
slides clearly from their seats. A projector throws one image on a wall at a
fixed size. This system puts the presentation directly in every student's hand,
at whatever zoom level they need.

## The Solution

Focalpoint turns any device with a browser into a personal window to the
presentation. The host shares their screen once. Every student sees it
instantly on their own phone, tablet, or laptop — zoomable, fullscreen, and
independent of what anyone else in the room is doing. Students can also send
short text messages back to the host, and the presenter can see who's
connected and disconnect a viewer if needed.

Each class is saved as a **room**. A room holds:

- **User Inputs** — labeled fields (e.g. First Name, Last Name) the viewer
  fills in on the join screen. The answers become the viewer's display name
  and are attached to their LiveKit participant as attributes.
- **Session Fields** — named values describing the class as a whole
  (e.g. Section = BSIT 4C, Subject = IT-ELEC 3, EDP Code = 124897). These
  appear as columns in the exported log.
- **Room size** — the maximum number of viewers (1 to 51).

After a session ends, the log (Date, Time Stamp, Status, one column per user
input, one column per session field) is saved to a local SQLite database and
listed in the sidebar. Clicking an entry opens a table with CSV and PDF
download buttons.

## How It Works

1. The host runs `launcher.py`. It starts every service and opens the
   host page automatically.
2. The host presses **Add Room**, sets the **User Inputs** and **Session
   Fields**, and presses **Save Customization**. Saved rooms are kept in the
   database and reused in later sessions.
3. The host opens the saved room and presses **Share Screen**. The room's
   config is sent to FastAPI and held for the session.
4. A QR code appears on screen.
5. Students connect to the classroom WiFi and scan the QR code. This opens
   the viewer page.
6. The viewer join screen shows one input per User Input label. The student
   fills them in and taps **Connect**.
7. The answers are joined into the display name and also sent to LiveKit as
   participant attributes, so the host sees them in the viewer list.
8. Students can pinch-to-zoom freely and send a text message to the host at
   any time.
9. When the host presses **End Session**, the log is saved to the database
   and listed under **Logs** in the sidebar.

No app installation required. No internet connection required. Any modern
mobile browser works.

## Architecture

```
Host's Laptop (localhost)
    ↓ screen capture via browser getDisplayMedia API
LiveKit SFU — receives one upstream stream, distributes to all viewers
    ↓
Student Devices (LAN IP) — any browser, pinch-to-zoom enabled
    ↓ text stream, viewer → host
Host sees message as an on-screen notification
```

FastAPI issues LiveKit access tokens, holds the current room config
(`/room-config`), polls participants (`/participants`), renders logs
(`/logs/snapshot`, `/logs/render`), and stores saved rooms and logs in SQLite
(`/rooms`, `/logs/saved`). Nginx serves the React build and reverse-proxies
API calls. All traffic stays on the local network — no internet, no STUN/TURN
servers.

## Tech Stack

| Component | Technology |
|---|---|
| SFU Server | LiveKit (open source, self-hosted binary) |
| Web Server | Nginx |
| Token / Admin API | FastAPI + Uvicorn |
| Storage | SQLite (Python `sqlite3`) |
| Python dependency management | uv |
| Screen Capture | Browser `getDisplayMedia` API |
| Frontend | React + React Router + Tailwind (Vite dev server) |
| Viewer/Host Client | React components using the LiveKit JS SDK |
| Log export | Server-side CSV and PDF (fpdf2) |
| Process orchestration | `launcher.py` |

## Prerequisites

- [uv](https://docs.astral.sh/uv/) for the Python token/admin server
- Node.js and pnpm for the frontend (dev mode; the build is served by Nginx)
- LiveKit server binary (`livekit-server.exe`) and Nginx (`nginx.exe`) for Windows,
  placed in `livekit/` and `nginx/` per the folder structure below

## Folder Structure

```
focalpoint/
├── .env.example
├── launcher.py
├── README.md
├── LICENSE
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   ├── presenter/
│   │   │   ├── util/
│   │   │   ├── viewer/
│   │   │   └── config.js
│   │   ├── Apps.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── nginx/
│   ├── conf/
│   │   └── nginx.conf
│   └── nginx.exe
├── livekit/
│   ├── livekit-server.exe
│   └── livekit.yaml.example
└── server/
    ├── db.py
    ├── focalpoint.db          ← generated at first launch
    ├── generate_configs.py
    ├── log_session.py
    ├── main.py
    ├── networking.py
    ├── pyproject.toml
    └── uv.lock
```

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/alexpqbt/focalpoint.git
cd focalpoint
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

```env
LIVEKIT_API_KEY=your_api_key_here
LIVEKIT_API_SECRET=your_api_secret_here
LIVEKIT_ROOM_NAME=classroom
```

Use any string for the key and secret — they only need to match between the
token server and LiveKit, and the launcher keeps them in sync automatically.

### 3. Install Python dependencies

```bash
cd server
uv sync
cd ..
```

### 4. Install frontend dependencies and build

```bash
cd frontend
pnpm install
pnpm build
cd ..
```

`launcher.py` serves `frontend/dist` through Nginx on port 8080. If you want
to work on the frontend with hot reload, run `pnpm dev` in `frontend/` and
open `http://localhost:5173` instead — Vite proxies API calls to the FastAPI
server on port 5000. Both modes are supported and share the same database.

### 5. Run the launcher

```bash
uv run python launcher.py
```

This detects the machine's local IP, generates `livekit.yaml` and
`nginx.conf`, starts LiveKit, FastAPI, and Nginx in order — waiting for each
to become reachable before starting the next — and opens the host page
automatically. The database file `server/focalpoint.db` is created on first
launch.

No manual IP editing in any file. No certificate generation. No per-machine
config files to keep in sync.

## Usage

### Host

1. `launcher.py` opens the host page automatically at `http://localhost:8080/`.
2. Press **Add Room**. The new room is a draft and is saved only when you
   press **Save Customization**; closing the modal discards it. Set:
   - **Room size** (1 to 51).
   - **Fields** (up to 6): each has a name (up to 30 characters) and a value
     (up to 50). The values are repeated on every row of the log.
   - **User Inputs** (up to 5 labels, 30 characters each). Without any, students
     see a single Name input.
3. To change a saved room, open it and press **Customize**. To remove it,
   press **Delete**. Deleting a room does not delete its past logs.
4. Open the saved room and press **Share Screen**, then select the window or
   screen to share. Unsaved changes must be saved first. The config is sent to
   FastAPI before sharing starts; if the server rejects it, sharing does not
   start.
5. A QR code appears — display it to students.
6. The participant panel shows a live count and list of connected viewers,
   with one column per User Input and a **Remove** button per row.
7. Messages sent by students appear as brief on-screen notifications.
8. Press **End Session** when done. The log is saved and listed under **Logs**
   in the sidebar. Click an entry to open its table and download it as CSV or
   PDF. Sessions in which no viewer joined are not saved.

### Students

1. Connect to the classroom WiFi network.
2. Scan the QR code with a phone camera — this opens the viewer page at
   `http://<HOST-IP>:8080/view`.
3. The join screen shows one input per User Input the host defined, or a
   single Name field if none. Every input is required. Fill them in and tap
   **Connect**. The answers are joined with spaces into the display name
   (for example `Mary Ann Cruz`).
4. Pinch to zoom freely.
5. Tap **Send Message** to type a short note to the host.

Students must open the viewer page after the host presses **Share Screen**. A
page that was already open keeps the old join form until it is reloaded.

## Session Logs

While a session runs, the server records each viewer's join and leave, along
with their answers. Saved logs have this table layout:

| Date | Time Stamp | Status | *one column per User Input* | *one column per Field* |
|---|---|---|---|---|

Status is **Entered** or **Left**. Times use the clock and timezone of the
machine running FastAPI. CSV and PDF files are generated by the server from the
saved table, so past sessions download exactly like current ones.

## Data Storage and Privacy

All data is stored on the host machine in `server/focalpoint.db` (SQLite).
It contains:

- Saved rooms: class details and join form settings.
- Saved session logs, including **students' names and the answers they
  entered**.

Nothing is sent to the internet. The database is not encrypted and the system
has no login, so anyone with access to the host machine or its files can read
it. Keep the host machine secured, and back up or delete `focalpoint.db`
according to your institution's rules on student data. The file is excluded
from version control through `.gitignore` and should not be committed or
shared.

## Stopping the System

Press `Ctrl+C` in the terminal running `launcher.py`. It stops Nginx via its
documented shutdown command and terminates LiveKit and FastAPI.

## Moving to a New Machine

1. Copy the project folder to the new machine.
2. Install `uv`, run `uv sync` inside `server/`.
3. Install Node.js, run `pnpm install && pnpm build` inside `frontend/`.
4. Optionally copy `server/focalpoint.db` to bring saved rooms and logs along.
5. Run `uv run python launcher.py`.

The local IP is detected automatically at launch — no config files need editing.

## Troubleshooting

**Students cannot reach the host page**
Check that the router does not have client isolation enabled. This setting
prevents devices on the same network from talking to each other. Turn it off.

**Token server / `/participants` returns 401 or 403**
The bearer token sent to the endpoint is missing, invalid, or lacks the
`roomAdmin` grant — this happens automatically for host tokens, so a 403
here usually means a non-host token was used against an admin endpoint.
A 403 on `/room-config`, `/rooms`, `/logs/snapshot`, `/logs/saved`, or
`/logs/render` means the request did not come from `127.0.0.1` — those
endpoints are host-only. Confirm the host browser is on the same machine as
FastAPI and is opened at `localhost`, not the LAN IP.

**Video or messaging is not working**
Make sure `launcher.py` reports all three services as ready before opening
the browser. Check the browser console (not just server logs) — frontend
errors are not currently surfaced to the terminal.

**Video is not appearing on student devices**
Confirm the host has selected a window and the stream is active.
Students must tap **Connect** after the host has started sharing.

**Students see the wrong join form**
The viewer page was opened before the host pressed **Share Screen**, or the
room was changed afterward. Reload the viewer page.

**"Save your customization before sharing"**
The room has unsaved edits, or it is a new draft. Press **Save Customization**,
then **Share Screen**.

**CSV or PDF download fails from the Logs modal**
Open the browser console. The modal shows a red error box with the server's
response. A 403 means the request didn't reach FastAPI as localhost. A 400
means the table shape was rejected (too many columns, too many rows, or a
row whose length doesn't match the column count).

**Rooms or logs are missing from the sidebar**
The list is loaded from `/rooms` and `/logs/saved`. Check the browser's
Network tab for failed requests. If the server was run from a different
folder or machine, it may be using a different `server/focalpoint.db`.
A session in which no viewer joined is never saved as a log.

## Known Limitations

- **No message persistence.** Messages from students are shown once as a
  notification and are not stored or logged anywhere.
- **No ban list.** Disconnecting a viewer clears their current connection
  only. A page refresh reconnects them immediately — there is no server-side
  tracking of removed identities. This is intentional, not a bug.
- **No SSL, by design.** All traffic is unencrypted on the local network.
  Acceptable for a classroom LAN with no internet exposure; not suitable for
  any deployment where the network isn't fully trusted.
- **The active room config lives in server memory.** User Inputs and Session
  Fields in use by viewers reset when FastAPI restarts, and the host must press
  **Share Screen** again. The latest **Share Screen** wins; a host who shares
  twice overwrites the first config. Saved rooms are not affected.
- **Join forms are fixed at share time.** Viewers who joined under older
  labels keep their old attributes in the participant list.
- **The running session is held in memory.** It is written to the database
  when the host presses **End Session**. Closing the browser or stopping the
  launcher mid-session loses that session's log.
- **A `left` event is recorded only when the host polls `/participants`**
  (every 3.5 seconds). Viewers still connected when the session ends only
  get an Entered row.
- **Exported times use the timezone of the machine running FastAPI.**
- **User Inputs are required for viewers, and labels are the keys for
  answers.** Renaming a label mid-session means older viewers' answers no
  longer match.
- **Logs and rooms live on the host machine only.** Copy
  `server/focalpoint.db` to keep them when moving machines. There is no
  interface for deleting a saved log, and the database is not encrypted.
- **Confirmed incompatible: iOS 12 and earlier (e.g. iPhone 6/6 Plus).**
  Plain HTTP and the LiveKit token endpoint work fine, but the WebSocket
  handshake to LiveKit's signaling server fails at the browser networking
  layer (WebSocket close code 1005, no server-side rejection). Likely a
  WebKit-level limitation on this OS version, not fixable in application
  code.

## License

This project is licensed under the GNU General Public License v3.0.
See [LICENSE](LICENSE) for details.

Any modifications to this project must also be released under GPL v3.0.
Attribution to the original author is required.

## Acknowledgements

This project is built entirely on open source software:

- [LiveKit](https://livekit.io) — WebRTC SFU server
- [Nginx](https://nginx.org) — Web server
- [FastAPI](https://fastapi.tiangolo.com) — Token and admin server framework
- [SQLite](https://www.sqlite.org) — Local storage for rooms and logs
- [uv](https://docs.astral.sh/uv/) — Python package and project management
- [pnpm](https://pnpm.io/) — Node package manager
- [React](https://react.dev) — Frontend UI
- [Vite](https://vite.dev) — Frontend build tool
- [Tailwind CSS](https://tailwindcss.com) — Frontend styling
- [fpdf2](https://py-pdf.github.io/fpdf2/) — Server-side PDF generation

## Author

Built as a capstone research project exploring low-cost, open source
assistive technology for visually impaired students in Philippine university
classrooms.