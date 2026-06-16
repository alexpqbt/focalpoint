# Focalpoint

A self-contained, browser-based classroom screen broadcasting system designed 
for students with visual difficulties. The presenter shares their screen once, 
and up to 50 students can view it in real-time on their own devices — with 
full pinch-to-zoom support — through a private local WiFi network, 
with no internet connection required.

## The Problem

Students with visual difficulties in a classroom cannot always read presentation 
slides clearly from their seats. A projector throws one image on a wall at a 
fixed size. This system puts the presentation directly in every student's hand, 
at whatever zoom level they need.

## The Solution

Focalpoint turns any device with a browser into a personal window to the presentation. The presenter shares their screen once. Every student sees it instantly on their own phone, tablet, or laptop — zoomable, fullscreen, and completely independent of what anyone else in the room is doing.

## How It Works

1. The presenter connects their laptop via HDMI to the system (production) 
   or runs the system on their own laptop (prototype)
2. The presenter opens the presenter page in their browser and clicks 
   **Start Sharing**
3. A QR code appears on screen
4. Students connect to the classroom WiFi and scan the QR code
5. Students tap **Start Viewing** and see the presentation live on their phone
6. Students can pinch-to-zoom freely and independently

No app installation required. Any modern mobile browser works.

## Architecture

```
Presenter's Laptop
    ↓ (screen capture via browser getDisplayMedia API)
LiveKit SFU — receives one upstream stream
    ↓ (distributes to all connected viewers)
50 Student Devices — any browser, pinch-to-zoom enabled
```

All traffic stays on a local network. No internet required. 
No STUN/TURN servers needed.

## Tech Stack

| Component | Technology |
|---|---|
| SFU Server | LiveKit (open source) |
| Web Server | Nginx |
| Token Server | FastAPI + Uvicorn |
| Screen Capture | Browser getDisplayMedia API |
| Viewer Client | HTML + JavaScript + LiveKit JS SDK |
| Containerization | Docker + Docker Compose |

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [mkcert](https://github.com/FiloSottile/mkcert) for local HTTPS certificates

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/alexpqbt/focalpoint.git
cd focalpoint
```

### 2. Install mkcert and generate certificates

```bash
# Install mkcert (Linux)
sudo apt install mkcert
mkcert -install

# Generate certificate for your local IP
# Replace 192.168.1.100 with your actual local IP address
mkcert 192.168.1.100 localhost 127.0.0.1

# Move certificates into the certs folder
mv 192.168.1.100+2.pem certs/cert.pem
mv 192.168.1.100+2-key.pem certs/key.pem
```

Find your local IP address:
- Linux/Mac: `ip a` or `ifconfig`
- Windows: `ipconfig`

### 3. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
API_KEY=your_api_key_here
API_SECRET=your_api_secret_here
ROOM_NAME=classroom
```

Use any string you want for the key and secret. 
They just need to match between the token server and LiveKit.

### 4. Configure LiveKit

```bash
cp livekit.yaml.example livekit.yaml
```

Open `livekit.yaml` and fill in:
- Your local IP address under `node_ip`
- Your API key and secret under `keys` — must match what you set in `.env`

### 5. Update the server IP in the frontend

Open `public/js/config.js` and replace 
`192.168.1.100` with your actual local IP address. 

### 6. Start everything

```bash
docker compose up --build
```

First run takes a few minutes while Docker downloads images and 
builds the token server. Subsequent runs are fast.

## Usage

### Presenter

1. Open `https://192.168.1.100/` in your browser
2. Accept the certificate warning (one time only)
3. Click **Start Sharing**
4. Select the window or screen you want to share
5. A QR code appears — display it to students

### Students

1. Connect to the classroom WiFi network
2. Scan the QR code with your phone camera
3. Accept the certificate warning (one time only)
4. Tap **Start Viewing**
5. Pinch to zoom freely

## Stopping the System

```bash
docker compose down
```

## Moving to a New Machine

1. Copy the project folder to the new machine
2. Install Docker
3. Find the new machine's local IP address
4. Regenerate certificates with mkcert for the new IP
5. Update the IP in `config.js`, and `livekit.yaml`
6. Run `docker compose up --build`

## Troubleshooting

**Students cannot reach the presenter page**
Check that the router does not have client isolation enabled. 
This setting prevents devices on the same network from talking to each other. 
Turn it off.

**iOS Safari shows a connection error**
Accept the certificate warning when you first visit the page. 
Safari requires this one-time step for self-signed certificates on local networks.

**Token server returns 401 Unauthorized**
Your API key and secret in `.env` do not match the keys in `livekit.yaml`. 
They must be identical.

**Docker takes forever to start**
This usually happens if the UDP port range is being mapped. 
Check your `docker-compose.yml` and remove any `50000-60000` port mappings.

**Video is not appearing on student devices**
Make sure the presenter has selected a window and the stream is active. 
Students must tap the Start Viewing button after the presenter has started sharing.

## Scope and Limitations

This prototype is validated with up to 20 simultaneous connected devices. 
The architecture is designed and capacity-verified for 50 concurrent viewers 
based on WebRTC SFU distribution and local 802.11ac network capacity analysis.

The prototype captures the presenter's screen via the browser 
`getDisplayMedia` API. The proposed production version uses an HDMI-to-USB 
capture card connected to a Raspberry Pi 5, allowing the presenter to use 
their own laptop independently.

HTTPS is required for WebRTC to function on iOS Safari. This prototype uses 
a self-signed certificate generated with mkcert. Production deployment would 
use a properly signed certificate or a persistent self-signed certificate 
installed on managed devices.

## License

This project is licensed under the GNU General Public License v3.0. 
See [LICENSE](LICENSE) for details.

Any modifications to this project must also be released under GPL v3.0. 
Attribution to the original author is required.

## Acknowledgements

This project is built entirely on open source software:

- [LiveKit](https://livekit.io) — WebRTC SFU server
- [Nginx](https://nginx.org) — Web server
- [FastAPI](https://fastapi.tiangolo.com) — Token server framework
- [Docker](https://docker.com) — Containerization

## Author

Built as a capstone research project exploring low-cost, 
open source assistive technology for visually impaired students 
in Philippine university classrooms.
