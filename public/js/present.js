import { initConfig, getServerIP, getLivekitURI, VIDEO_CFG } from "./config.js"
import './util/polyfill.js'

const shareBtn = document.getElementById('shareBtn')
const stopBtn = document.getElementById('stopBtn')
const hideBtn = document.getElementById('hideBtn')
const preview = document.getElementById('preview')
const canvas = document.getElementById('qrcode')
const statusLabel = document.getElementById('status')
const ipAddressLabel = document.getElementById('ipAddress')
const panelButton = document.getElementById('panelButton')
const exportCsvBtn = document.getElementById('exportCsvBtn')
const exportPdfBtn = document.getElementById('exportPdfBtn')

let room = null
let presenterToken = null
let participantPollHandle = null

await initConfig()

const startSharing = async () => {
  shareBtn.disabled = true
  exportCsvBtn.classList.add('hidden')
  exportPdfBtn.classList.add('hidden')
  try {
    canvas.replaceChildren()
    presenterToken = await fetch('/token?role=presenter&identity=presenter').then(r => r.text())

    await fetch('/logs/reset', {
      method: 'POST',
      headers: { Authorization: `Bearer: ${presenterToken}` }
    })

    room = new LivekitClient.Room()
    await room.connect(getLivekitURI(), presenterToken)
    await room.localParticipant.setScreenShareEnabled(true, VIDEO_CFG)
    room.on(LivekitClient.RoomEvent.LocalTrackUnpublished, stopSharing)
    receiveMessages()

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
    exportCsvBtn.classList.remove('hidden')
    exportPdfBtn.classList.remove('hidden')
  }
}

 const fetchParticipants = async () => {
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

const renderParticipants = (participants, count) => {
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

 const disconnectParticipant = async (identity) => {
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

const startParticipantPolling = () => {
  fetchParticipants();
  participantPollHandle = setInterval(fetchParticipants, 3500);
}

const stopParticipantPolling = () => {
  if (participantPollHandle) {
    clearInterval(participantPollHandle)
    participantPollHandle = null
  }
  document.getElementById('participant-count').textContent = '0'
  document.getElementById('participant-list').innerHTML = ''
}

const showParticipantPanel = () => {
  const listEl = document.getElementById('participants-panel');
  listEl.classList.toggle('hidden')
}

const receiveMessages = () => {
  room.registerTextStreamHandler('student-message',  async (reader, participantInfo) => {
    const text = await reader.readAll();
    const participant = room.remoteParticipants.get(participantInfo.identity)
    const senderName = participant?.name || participantInfo.identity
    showMessageToast(text, senderName)
  })
}

const showMessageToast = (text, senderName) => {
  const toast = document.createElement('div')
  toast.className = 'message-toast'

  const nameEl = document.createElement('strong')
  nameEl.textContent = senderName
  toast.appendChild(nameEl)
  toast.appendChild(document.createTextNode(`: ${text}`))

  document.getElementById('toast-container').appendChild(toast)
  setTimeout(() => toast.remove(), 5000)
}

const exportLog = async (format) => {
  const res = await fetch(`/logs/export?format=${format}`, {
    headers: { Authorization: `Bearer ${presenterToken}` },
  })
  if (!res.ok) {
    console.error('export failed', res.status)
    return
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `session_log.${format}`
  a.click()
  URL.revokeObjectURL(url)
}

shareBtn.onclick = startSharing
stopBtn.onclick = stopSharing
panelButton.onclick = showParticipantPanel
exportCsvBtn.onclick = () => exportLog('csv')
exportPdfBtn.onclick = () => exportLog('pdf')