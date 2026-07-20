import { initConfig, getServerIP, getLivekitURI, VIDEO_CFG } from "./config.js"

const shareBtn = document.getElementById('shareBtn')
const stopBtn = document.getElementById('stopBtn')
const hideBtn = document.getElementById('hideBtn')
const preview = document.getElementById('preview')
const canvas = document.getElementById('qrcode')
const statusLabel = document.getElementById('status')
const ipAddressLabel = document.getElementById('ipAddress')

let room = null
let presenterToken = null
let participantPollHandle = null

await initConfig()

const startSharing = async () => {
  shareBtn.disabled = true
  try {
    canvas.replaceChildren()
    presenterToken = await fetch('/token?role=presenter&identity=presenter').then(r => r.text())
    room = new LivekitClient.Room()
    await room.connect(getLivekitURI(), presenterToken)
    await room.localParticipant.setScreenShareEnabled(true, VIDEO_CFG)
    room.on(LivekitClient.RoomEvent.LocalTrackUnpublished, stopSharing)

    const pub = room.localParticipant.getTrackPublication('screen_share')
    if (!pub?.videoTrack) throw new Error('Screen share track unavailable')

    preview.srcObject = new MediaStream([pub.videoTrack.mediaStreamTrack])
    const viewerURL = `http://${getServerIP()}:8080/view`
    new QRCode(canvas, { text: viewerURL })
    ipAddressLabel.textContent = viewerURL 

    startParticipantPolling()
  } catch (err) {
    console.error('Failed to start sharing:', err)
    shareBtn.disabled = false
  }
}

const stopSharing = async () => {
  if (!room) return
  try {
    canvas.replaceChildren()
    await room.localParticipant.setScreenShareEnabled(false)
    await room.disconnect()
    preview.srcObject = null
    ipAddressLabel.textContent = null
    room = null
  } catch (err) {
    console.error('Failed to stop sharing:', err)
  } finally {
    shareBtn.disabled = false
    stopParticipantPolling()
  }
}

async function fetchParticipants() {
  const res = await fetch('/participants', {
    headers: { Authorization: `Bearer ${presenterToken}` },
  });
  if (!res.ok) {
    console.error('participant fetch failed', res.status);
    return;
  }
  const { count, participants } = await res.json();
  renderParticipants(participants, count);
}

function renderParticipants(participants, count) {
  document.getElementById('participant-count').textContent = count;
  const listEl = document.getElementById('participant-list');
  listEl.innerHTML = '';
  for (const p of participants) {
    const li = document.createElement('li');
    li.textContent = p.name || p.identity;
    const btn = document.createElement('button');
    btn.textContent = 'Disconnect';
    btn.addEventListener('click', () => disconnectParticipant(p.identity));
    li.appendChild(btn);
    listEl.appendChild(li);
  }
}

async function disconnectParticipant(identity) {
  const res = await fetch(`/participants/${encodeURIComponent(identity)}/remove`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${presenterToken}` },
  });
  if (!res.ok) {
    console.error('disconnect failed', identity, res.status);
    return;
  }
  fetchParticipants();
}

function startParticipantPolling() {
  fetchParticipants();
  participantPollHandle = setInterval(fetchParticipants, 3500);
}

function stopParticipantPolling() {
  if (participantPollHandle) {
    clearInterval(participantPollHandle)
    participantPollHandle = null
  }
  document.getElementById('participant-count').textContent = '0'
  document.getElementById('participant-list').innerHTML = ''
  presenterToken = null
}

shareBtn.onclick = startSharing
stopBtn.onclick = stopSharing