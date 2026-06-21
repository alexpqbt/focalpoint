import { SERVER_IP, WSS_URI } from "./config.js"

const startBtn = document.getElementById('startBtn')
const screen = document.getElementById('screen')

startBtn.onclick = async () => {
  try {
    const identity = 'student-' + Math.random().toString(36).substring(2,9)
    const token = await fetch(`/token?role=student&identity=${identity}`).then(r => r.text())

    const room = new LivekitClient.Room()

    room.on(LivekitClient.RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === 'video') {
        track.attach(screen)
      }
    })

    await room.connect(WSS_URI, token)
  } catch (err) {
    console.error('Failed to disconnect', err)
  } finally {
    startBtn.disabled = true
  }
}