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

1. The host starts Focalpoint by double-clicking `Focalpoint.exe` (packaged
   build) or by running `launcher.py` (development). A small window appears
   and starts every service. When it reads **The app is running.**, the host
   page opens automatically in the default browser.
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
10. When the class is over, the host closes the Focalpoint window, which stops
    every service.

No app installation required for students. No internet connection required.
Any modern mobile browser works.

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
(`/rooms`, `/logs/saved`). FastAPI listens on `127.0.0.1:5000` only. Nginx
serves the React build on port 8080 and reverse-proxies API calls, so it is
the only web entry point from the network. All traffic stays on the local
network — no internet, no STUN/TURN servers.

The launcher runs FastAPI inside its own process (uvicorn in a thread) and
starts LiveKit and Nginx as child processes. On Windows, all children are
placed in a Job Object, so they are terminated by the operating system if the
launcher exits for any reason, including a crash or being killed from Task
Manager.

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
| Process orchestration | `launcher.py` (Tkinter status window, Windows Job Object) |
| Packaging | PyInstaller (onedir), driven by `build.py` |

## Platform

Windows only. The launcher uses Windows Job Objects, and the bundled LiveKit
and Nginx binaries are the Windows builds.

## Prerequisites

**To run the packaged build:** nothing. No Python, uv, or Node is required on
the host machine.

**To develop or build from source:**

- [uv](https://docs.astral.sh/uv/) for the Python server
- Node.js and pnpm for the frontend
- LiveKit server binary (`livekit-server.exe`) and Nginx (`nginx.exe`) for
  Windows, placed in `livekit/` and `nginx/` per the folder structure below
- Tkinter, which ships with the standard Python installer. Check with
  `uv run --project server python -c "import tkinter"`.

## Folder Structure

Source tree:

```
focalpoint/
├── .env.example
├── .gitignore
├── build.py
├── favicon.ico
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
│   │   ├── mime.types
│   │   └── nginx.conf         ← regenerated at every launch
│   └── nginx.exe
├── livekit/
│   ├── livekit-server.exe
│   └── livekit.yaml           ← generated at every launch
└── server/
    ├── db.py
    ├── focalpoint.db          ← generated at first launch
    ├── generate_configs.py
    ├── log_session.py
    ├── main.py
    ├── networking.py
    ├── paths.py               ← shared base paths (source and packaged)
    ├── pyproject.toml
    └── uv.lock
```

Packaged build (`dist/Focalpoint/`):

```
Focalpoint/
├── Focalpoint.exe
├── _internal/                 ← created by PyInstaller
├── frontend/dist/             ← copied by build.py
├── livekit/livekit-server.exe ← copied by build.py
├── nginx/
│   ├── nginx.exe              ← copied by build.py
│   ├── conf/                  ← copied by build.py
│   ├── logs/                  ← created at launch
│   └── temp/                  ← created at launch
├── server/focalpoint.db       ← created at first launch
├── .env                       ← created at first launch
└── focalpoint.log             ← created at first launch
```

## Setup (from source)

### 1. Clone the repository

```bash
git clone https://github.com/alexpqbt/focalpoint.git
cd focalpoint
```

### 2. Environment variables (optional)

The launcher creates `.env` on first run with randomly generated LiveKit
credentials and `LIVEKIT_ROOM_NAME=classroom`. You only need to create it
yourself to use fixed values:

```bash
cp .env.example .env
```

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

From the project root:

```bash
uv run --project server python launcher.py
```

The Python project lives in `server/`, so `--project server` is required when
running from the root. Without it, uv does not find the dependencies.

The launcher detects the machine's local IP, generates `livekit.yaml` and
`nginx.conf`, starts LiveKit, FastAPI, and Nginx in order — waiting for each
to become reachable before starting the next — and opens the host page
automatically. The database file `server/focalpoint.db` is created on first
launch. Output is printed to the terminal when running from source.

No manual IP editing in any file. No certificate generation. No per-machine
config files to keep in sync.

## Building the Executable

From the project root, with `uv`, `pnpm`, and the LiveKit and Nginx binaries
in place:

```bash
python build.py
```

`build.py` uses only the standard library and calls `uv` and `pnpm` itself. It
runs these steps and stops at the first failure:

1. Checks that `launcher.py`, `livekit-server.exe`, `nginx.exe`,
   `nginx/conf/mime.types`, and `favicon.ico` exist.
2. Builds the frontend with `pnpm build`.
3. Builds `dist/Focalpoint/Focalpoint.exe` with PyInstaller in onedir mode.
4. Copies `livekit-server.exe`, `nginx.exe`, `nginx/conf/`, and
   `frontend/dist/` next to the executable.

Options:

| Flag | Effect |
|---|---|
| `--windowed` | Builds without a console window. Use for the release build. |
| `--skip-frontend` | Skips `pnpm build` and reuses the current `frontend/dist`. |

The default build keeps a console window open, which is useful while
debugging. PyInstaller recreates `dist/Focalpoint/` on every build, so the
external files are copied again each time. `build/`, `dist/`, and
`Focalpoint.spec` are build output and are excluded from version control.

The build is onedir on purpose. A onefile build unpacks itself to a temporary
folder on every launch, which would break the persistent database and the
Nginx working directory.

To distribute, copy the whole `dist/Focalpoint/` folder, not only the `.exe`.

## Usage

### Host

1. Start Focalpoint. A small window appears with the status **Starting
   services...** and then **The app is running.** The host page opens
   automatically at `http://localhost:8080/`. The **Open host page** button
   reopens it if the tab was closed.
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
9. Close the Focalpoint window to stop the system. Press **End Session**
   first, because closing the window discards a session that was not ended.

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

## First Run on a New Machine

- **Windows Firewall.** The first launch triggers a firewall prompt. Allow
  access on **private networks**, or students' devices cannot connect. If the
  prompt was dismissed, allow `Focalpoint.exe`, `livekit-server.exe`, and
  `nginx.exe` manually. The ports in use are TCP 8080 (web), TCP 7880 and
  7881 (LiveKit signaling and TCP media fallback), and UDP 50000 to 60000
  (LiveKit media). Video fails silently when the UDP range is blocked.
- **Install location.** The app writes its database, `.env`, generated
  configs, and logs inside its own folder. Place the folder somewhere the
  user can write to, such as Documents or the desktop. `C:\Program Files`
  is not writable for standard users and breaks startup.
- **Antivirus.** The executable is not code-signed, and unsigned PyInstaller
  executables are sometimes flagged. If this happens, add an exception for the
  folder.

## Session Logs

While a session runs, the server records each viewer's join and leave, along
with their answers. Saved logs have this table layout:

| Date | Time Stamp | Status | *one column per User Input* | *one column per Field* |
|---|---|---|---|---|

Status is **Entered** or **Left**. Times use the clock and timezone of the
machine running FastAPI. CSV and PDF files are generated by the server from the
saved table, so past sessions download exactly like current ones.

## Data Storage and Privacy

All data is stored on the host machine, inside the Focalpoint folder:

- `server/focalpoint.db` (SQLite): saved rooms (class details and join form
  settings) and saved session logs, including **students' names and the
  answers they entered**.
- `.env`: the generated LiveKit key and secret.
- `focalpoint.log` (packaged build only): service output and errors.
- `nginx/logs/`: Nginx access and error logs, which include the IP addresses
  of connected devices.

Nothing is sent to the internet. The database is not encrypted and the system
has no login, so anyone with access to the host machine or its files can read
it. Keep the host machine secured, and back up or delete `focalpoint.db`
according to your institution's rules on student data. The file is excluded
from version control through `.gitignore` and should not be committed or
shared.

## Stopping the System

- **Packaged build or launcher window:** close the Focalpoint window. Shutdown
  can take a few seconds while Nginx and LiveKit exit, and the window may
  appear frozen during that time.
- **Launcher from source:** close the window. Ctrl+C in the terminal is not
  a reliable way to stop it.

The launcher stops Nginx with its documented shutdown command, stops FastAPI,
and terminates LiveKit. If the launcher is killed without cleaning up, such as
by Task Manager or a crash, Windows terminates its child processes
automatically, and the ports are released.

Only one copy can run at a time. Starting a second copy shows "Focalpoint is
already running" and exits.

## Moving to a New Machine

**Packaged build:**

1. Copy the whole `Focalpoint` folder to the new machine.
2. Optionally copy `server/focalpoint.db` from the old folder to bring saved
   rooms and logs along.
3. Run `Focalpoint.exe` and allow the firewall prompt.

**From source:**

1. Copy the project folder to the new machine.
2. Install `uv`, run `uv sync` inside `server/`.
3. Install Node.js, run `pnpm install && pnpm build` inside `frontend/`.
4. Optionally copy `server/focalpoint.db` to bring saved rooms and logs along.
5. Run `uv run --project server python launcher.py`.

The local IP is detected automatically at launch — no config files need editing.
The source build and the packaged build keep separate databases.

## Troubleshooting

**Nothing happens when starting `Focalpoint.exe`, or the window closes
immediately**
Open `focalpoint.log` in the Focalpoint folder. The traceback is written
there. Startup failures also appear in an error dialog. If you are
debugging, build without `--windowed` and run the executable from a terminal.

**"Focalpoint is already running"**
Another copy is open, possibly minimized. Close it first. If no window is
visible, end `Focalpoint.exe` in Task Manager.

**A service did not become ready on port 5000, 7880, or 8080**
Another program is using the port, or a previous instance was not stopped.
Check with `netstat -ano | findstr LISTENING | findstr ":5000 :7880 :8080"`.
For Nginx, read `nginx/logs/error.log`.

**Students cannot reach the host page**
Check that the router does not have client isolation enabled. This setting
prevents devices on the same network from talking to each other. Turn it off.
Then check Windows Firewall as described in **First Run on a New Machine**.

**Token server / `/participants` returns 401 or 403**
The bearer token sent to the endpoint is missing, invalid, or lacks the
`roomAdmin` grant — this happens automatically for host tokens, so a 403
here usually means a non-host token was used against an admin endpoint.
A 403 on `/room-config`, `/rooms`, `/logs/snapshot`, `/logs/saved`, or
`/logs/render` means the request did not come from `127.0.0.1` — those
endpoints are host-only. Confirm the host browser is on the same machine as
FastAPI and is opened at `localhost`, not the LAN IP.

**Video or messaging is not working**
Wait for the window to read **The app is running.** before opening the
browser. Check the browser console (not just service logs) — frontend
errors are not surfaced anywhere else.

**Video is not appearing on student devices**
Confirm the host has selected a window and the stream is active.
Students must tap **Connect** after the host has started sharing. If the host
sees the stream but students do not, the UDP range 50000 to 60000 is
probably blocked by the firewall.

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
row whose length doesn't match the column count). A 500 in the packaged build
means a module was missing from the bundle, and `focalpoint.log` names it.

**Rooms or logs are missing from the sidebar**
The list is loaded from `/rooms` and `/logs/saved`. Check the browser's
Network tab for failed requests. The packaged build and the source build use
different `server/focalpoint.db` files, and a copy of the folder started from a
different location uses its own file. A session in which no viewer joined is
never saved as a log.

## Known Limitations

- **Windows only.**
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
  when the host presses **End Session**. Closing the Focalpoint window,
  closing the browser, or stopping the launcher mid-session loses that
  session's log.
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
- **`focalpoint.log` is never trimmed.** The packaged build appends to it on
  every launch, so it grows over time. Delete it when it gets large.
- **The executable is unsigned.** Antivirus software may flag it, and Windows
  SmartScreen may show a warning on first run.
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

The packaged build also contains LiveKit and Nginx binaries, which have their
own licenses. Include their license files in the distributed folder alongside
`LICENSE`.

## Acknowledgements

This project is built entirely on open source software:

- [LiveKit](https://livekit.io) — WebRTC SFU server
- [Nginx](https://nginx.org) — Web server
- [FastAPI](https://fastapi.tiangolo.com) — Token and admin server framework
- [SQLite](https://www.sqlite.org) — Local storage for rooms and logs
- [uv](https://docs.astral.sh/uv/) — Python package and project management
- [PyInstaller](https://pyinstaller.org) — Executable packaging
- [pnpm](https://pnpm.io/) — Node package manager
- [React](https://react.dev) — Frontend UI
- [Vite](https://vite.dev) — Frontend build tool
- [Tailwind CSS](https://tailwindcss.com) — Frontend styling
- [fpdf2](https://py-pdf.github.io/fpdf2/) — Server-side PDF generation

## Author

Built as a capstone research project exploring low-cost, open source
assistive technology for visually impaired students in Philippine university
classrooms.