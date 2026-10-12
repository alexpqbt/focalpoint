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

Before sharing, the host can also define:

- **User Inputs** — labeled fields (e.g. First Name, Last Name) the viewer
  fills in on the join screen. The answers become the viewer's display name
  and are attached to their LiveKit participant as attributes.
- **Session Fields** — named values describing the session as a whole
  (e.g. Section = BSIT 4C, Subject = IT-ELEC 3, EDP Code = 124897). These
  appear as columns in the exported log.

After a session ends, the log (Date, Time Stamp, Status, one column per user
input, one column per session field) is saved and listed in the sidebar.
Clicking an entry opens a table with CSV and PDF download buttons.

## How It Works

1. The host runs `launcher.py`. It starts every service and opens the
   host page automatically.
2. The host opens **Customize** on a room, sets **User Inputs** and
   **Session Fields** (or picks a saved room), and clicks **Share Screen**.
   The config is sent to FastAPI and stored for the session.
3. A QR code appears on screen.
4. Students connect to the classroom WiFi and scan the QR code.
5. The viewer join screen shows one input per User Input label. The student
   fills them in and taps **Start Viewing**.
6. The answers are joined into the display name and also sent to LiveKit as
   participant attributes, so the host sees them in the viewer list.
7. Students can pinch-to-zoom freely and send a text message to the host at
   any time.
8. When the host ends the session, the current log is captured, saved to
   browser localStorage, and listed under **Logs** in the sidebar.

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
(`/room-config`), polls participants (`/participants`), and renders logs
(`/logs/snapshot`, `/logs/render`). Nginx serves the React build and
reverse-proxies API calls. All traffic stays on the local network — no
internet, no STUN/TURN servers.

## Tech Stack

| Component | Technology |
|---|---|
| SFU Server | LiveKit (open source, self-hosted binary) |
| Web Server | Nginx |
| Token / Admin API | FastAPI + Uvicorn |
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
├── README
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
server on port 5000. Both modes are supported.

### 5. Run the launcher

```bash
uv run python launcher.py
```

This detects the machine's local IP, generates `livekit.yaml` and
`nginx.conf`, starts LiveKit, FastAPI, and Nginx in order — waiting for each
to become reachable before starting the next — and opens the host page
automatically.

No manual IP editing in any file. No certificate generation. No per-machine
config files to keep in sync.

## Usage

### Host

1. `launcher.py` opens the host page automatically at `http://localhost:8080/`.
2. Open **Customize** on the room you want. Set **User Inputs** (up to 5
   labels, 30 characters each) and **Session Fields** (up to 6, each with a
   name up to 30 characters and a value up to 50). Save the room if you want
   to reuse it.
3. Click **Share Screen** and select the window or screen to share. The
   config is sent to FastAPI first; if the server rejects it, sharing does
   not start.
4. A QR code appears — display it to students.
5. The participant panel shows a live count and list of connected viewers,
   with the answers each viewer submitted, and a **Disconnect** button per row.
6. Messages sent by students appear as brief on-screen notifications.
7. Click **End Session** when done. The log is captured, saved, and listed
   under **Logs** in the sidebar. Click an entry to open the table and
   download CSV or PDF.

### Students

1. Connect to the classroom WiFi network.
2. Scan the QR code with a phone camera — this opens the host page.
3. The join screen shows one input per User Input the host defined (or a
   single Name field if none). Fill them in and tap **Start Viewing**.
4. Pinch to zoom freely.
5. Tap **Send Message** to type a short note to the host.

## Stopping the System

Press `Ctrl+C` in the terminal running `launcher.py`. It stops Nginx via its
documented shutdown command and terminates LiveKit and FastAPI.

## Moving to a New Machine

1. Copy the project folder to the new machine.
2. Install `uv`, run `uv sync` inside `server/`.
3. Install Node.js, run `pnpm install && pnpm build` inside `frontend/`.
4. Run `uv run python launcher.py`.

The local IP is detected automatically at launch — no config files need editing.

## Troubleshooting

**Students cannot reach the host page**
Check that the router does not have client isolation enabled. This setting
prevents devices on the same network from talking to each other. Turn it off.

**Token server / `/participants` returns 401 or 403**
The bearer token sent to the endpoint is missing, invalid, or lacks the
`roomAdmin` grant — this happens automatically for host tokens, so a 403
here usually means a non-host token was used against an admin endpoint.
A 403 on `/room-config`, `/logs/snapshot`, or `/logs/render` means the
request did not come from `127.0.0.1` — those endpoints are host-only.
Confirm the host browser is on the same machine as FastAPI.

**Video or messaging is not working**
Make sure `launcher.py` reports all three services as ready before opening
the browser. Check the browser console (not just server logs) — frontend
errors are not currently surfaced to the terminal.

**Video is not appearing on student devices**
Confirm the host has selected a window and the stream is active.
Students must tap **Start Viewing** after the host has started sharing.

**CSV or PDF download fails from the Logs modal**
Open the browser console. The modal shows a red error box with the server's
response. A 403 means the request didn't reach FastAPI as localhost. A 400
means the table shape was rejected (too many columns, too many rows, or a
row whose length doesn't match the column count).

**Logs sidebar is empty after ending a session**
`saveLog` skips sessions with no rows. If no viewer ever joined, nothing is
saved. Also check that you're on the same origin you ended the session on —
`localhost:5173` (dev) and `localhost:8080` (built) have separate
localStorage.

## Known Limitations

- **No message persistence.** Messages from students are shown once as a
  notification and are not stored or logged anywhere.
- **No ban list.** Disconnecting a viewer clears their current connection
  only. A page refresh reconnects them immediately — there is no server-side
  tracking of removed identities. This is intentional, not a bug.
- **No SSL, by design.** All traffic is unencrypted on the local network.
  Acceptable for a classroom LAN with no internet exposure; not suitable for
  any deployment where the network isn't fully trusted.
- **Room config lives in server memory.** User Inputs and Session Fields
  reset when FastAPI restarts. The latest **Share Screen** wins; a host who
  shares twice overwrites the first config.
- **Fields are fixed at share time.** Viewers who joined under older labels
  keep their old attributes in the participant list.
- **Logs live in browser localStorage.** They are per-origin
  (`localhost:5173` and `localhost:8080` are separate) and disappear if site
  data is cleared. A server-side store (SQLite) was postponed.
- **A `left` event is recorded only when the host polls `/participants`**
  (every 3.5 seconds). Viewers still connected when the session ends only
  get an Entered row.
- **Exported times use the timezone of the machine running FastAPI.**
- **User Inputs are required for viewers, and labels are the keys for
  answers.** Renaming a label mid-session means older viewers' answers no
  longer match.
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