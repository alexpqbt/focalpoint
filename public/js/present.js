import { SERVER_IP, WSS_URI, VIDEO_CFG } from "./config.js"

const shareBtn = document.getElementById('shareBtn')
const stopBtn = document.getElementById('stopBtn')
const hideBtn = document.getElementById('hideBtn')
const preview = document.getElementById('preview')
const canvas = document.getElementById('qrcode')
const statusLabel = document.getElementById('status')
const ipAddressLabel = document.getElementById('ipAddress')

let room = null

const startSharing = async () => {
  shareBtn.disabled = true
  try {
    canvas.replaceChildren()
    const token = await fetch('/token?role=presenter&identity=presenter').then(r => r.text())
    room = new LivekitClient.Room()
    await room.connect(WSS_URI, token)
    await room.localParticipant.setScreenShareEnabled(true, VIDEO_CFG)
    room.on(LivekitClient.RoomEvent.LocalTrackUnpublished, stopSharing)

    const pub = room.localParticipant.getTrackPublication('screen_share')
    if (!pub?.videoTrack) throw new Error('Screen share track unavailable')

    preview.srcObject = new MediaStream([pub.videoTrack.mediaStreamTrack])
    const viewerURL = `https://${SERVER_IP}/view.html`
    new QRCode(canvas, { text: viewerURL })
    ipAddressLabel.textContent = viewerURL 
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
  }
}

shareBtn.onclick = startSharing
stopBtn.onclick = stopSharing