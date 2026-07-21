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

## How It Works

1. The host runs `launcher.py`. It starts every service and opens the
   host page automatically.
2. The host clicks **Start Sharing** and selects a window or screen.
3. A QR code appears on screen.
4. Students connect to the classroom WiFi and scan the QR code.
5. Students enter their name and tap **Start Viewing** to see the presentation live.
6. Students can pinch-to-zoom freely and independently, and send a text
   message to the host at any time.
7. The host can see a live participant count and list, and disconnect
   a viewer if needed.

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

FastAPI issues LiveKit access tokens and serves as the sole authenticated
path into the room for admin actions (participant list, disconnect). Nginx
serves static files and reverse-proxies API calls. All traffic stays on the
local network — no internet, no STUN/TURN servers.

## Tech Stack

| Component | Technology |
|---|---|
| SFU Server | LiveKit (open source, self-hosted binary) |
| Web Server | Nginx |
| Token / Admin API | FastAPI + Uvicorn |
| Python dependency management | uv |
| Screen Capture | Browser `getDisplayMedia` API |
| Viewer/Host Client | HTML + JavaScript + LiveKit JS SDK (CDN, no bundler) |
| Process orchestration | `launcher.py` |

## Prerequisites

- [uv](https://docs.astral.sh/uv/) for the Python token/admin server
- LiveKit server binary (`livekit-server.exe`) and Nginx (`nginx.exe`) for Windows,
  placed in `livekit/` and `nginx/` per the folder structure below

## Folder Structure

```
focalpoint/
│   .env
│   .env.example
│   launcher.py
│
├───livekit/
│       livekit-server.exe
│       livekit.yaml           ← generated at launch
│
├───nginx/
│   │   nginx.exe
│   ├───conf/
│   │       nginx.conf         ← generated at launch
│   └───logs/
│
├───public/
│   │   present.html
│   │   view.html
│   ├───css/
│   └───js/
│           polyfills.js
│           config.js
│           present.js
│           view.js
│
└───server/
        main.py
        networking.py
        generate_configs.py
        pyproject.toml
        uv.lock
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

### 4. Run the launcher

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
2. Click **Start Sharing** and select the window or screen to share.
3. A QR code appears — display it to students.
4. The participant panel shows a live count and list of connected viewers,
   each with a **Disconnect** button.
5. Messages sent by students appear as brief on-screen notifications.

### Students

1. Connect to the classroom WiFi network.
2. Scan the QR code with a phone camera — this opens `http://<HOST-IP>:8080/view`.
3. Enter a name and tap **Start Viewing**.
4. Pinch to zoom freely.
5. Tap **Send Message** to type a short note to the host.

## Stopping the System

Press `Ctrl+C` in the terminal running `launcher.py`. It stops Nginx via its
documented shutdown command and terminates LiveKit and FastAPI.

## Moving to a New Machine

1. Copy the project folder to the new machine.
2. Install `uv`, run `uv sync` inside `server/`.
3. Run `uv run python launcher.py`.

The local IP is detected automatically at launch — no config files need editing.

## Troubleshooting

**Students cannot reach the host page**
Check that the router does not have client isolation enabled. This setting
prevents devices on the same network from talking to each other. Turn it off.

**Token server / `/participants` returns 401 or 403**
The bearer token sent to the endpoint is missing, invalid, or lacks the
`roomAdmin` grant — this happens automatically for host tokens, so a 403
here usually means a non-host token was used against an admin endpoint.

**Video or messaging is not working**
Make sure `launcher.py` reports all three services as ready before opening
the browser. Check the browser console (not just server logs) — errors in
`present.js`/`view.js` are not currently surfaced to the terminal.

**Video is not appearing on student devices**
Confirm the host has selected a window and the stream is active.
Students must tap **Start Viewing** after the host has started sharing.

## Known Limitations

- **No message persistence.** Messages from students are shown once as a
  notification and are not stored or logged anywhere.
- **No ban list.** Disconnecting a viewer clears their current connection
  only. A page refresh reconnects them immediately — there is no server-side
  tracking of removed identities. This is intentional, not a bug.
- **No SSL, by design.** All traffic is unencrypted on the local network.
  Acceptable for a classroom LAN with no internet exposure; not suitable for
  any deployment where the network isn't fully trusted.
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

## Author

Built as a capstone research project exploring low-cost, open source
assistive technology for visually impaired students in Philippine university
classrooms.