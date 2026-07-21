import { initConfig, getLivekitURI } from "./config.js"

const startBtn = document.getElementById('startBtn')
const screen = document.getElementById('screen')
const submitDisplayName = document.getElementById('submitDisplayName')

await initConfig()

async function joinSession(name) {
  try {
    const identity = 'student-' + Math.random().toString(36).substring(2,9)
    const token = await fetch(`/token?role=student&identity=${identity}&name=${encodeURIComponent(name)}`).then(r => r.text())

    const room = new LivekitClient.Room()

    room.on(LivekitClient.RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === 'video') {
        track.attach(screen)
      }
    })

    await room.connect(getLivekitURI(), token)
  } catch (err) {
    console.error('Failed to disconnect', err)
  } finally {
    startBtn.disabled = true
  }
}

function showNamePanel() {
  const panel = document.getElementById('enterDisplayName')
  panel.classList.toggle('hidden')
}

startBtn.onclick = () => {
  showNamePanel()
}

const isWhitespace = str => str.trim().length === 0;

submitDisplayName.onclick = () => {
  const name = document.getElementById('name')
  if (!name.value || isWhitespace(name.value)) return
  joinSession(name)
}