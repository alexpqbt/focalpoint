import { initConfig, getLivekitURI } from "./config.js"
import './util/polyfill.js'

const startBtn = document.getElementById('startBtn')
const screen = document.getElementById('screen')
const submitDisplayNameBtn = document.getElementById('submitDisplayName')
const showMessagePanelBtn = document.getElementById('showMessagePanel')
const submitMessageBtn = document.getElementById('submitMessage')

let room = null

await initConfig()

const joinSession = async (name) => {
  try {
    screen.classList.toggle('hidden')
    showMessagePanelBtn.classList.toggle('hidden')
    const identity = 'student-' + Math.random().toString(36).substring(2,9)
    const token = await fetch(`/token?role=student&identity=${identity}&name=${encodeURIComponent(name)}`).then(r => r.text())

    room = new LivekitClient.Room()

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

const showNamePanel = () => {
  const panel = document.getElementById('enterDisplayName')
  panel.classList.toggle('hidden')
}

const showMessagePanel = () => {
  const panel = document.getElementById('messagePanel')
  panel.classList.toggle('hidden')
}

const isWhitespace = str => str.trim().length === 0;

const setViewerName = () => {
  const name = document.getElementById('name')
  if (!name.value || isWhitespace(name.value)) return
  joinSession(name.value)
}

const sendMessage = async () => {
  const message = document.getElementById('message')
  if (!message.value || isWhitespace(message.value)) return
  const info = await room.localParticipant.sendText(message.value, {
    topic: 'student-message',
  })
  console.log(`Sent text with stream ID: ${info.id}`);
  message.value = ''
} 

submitDisplayNameBtn.onclick = setViewerName 
startBtn.onclick = showNamePanel
showMessagePanelBtn.onclick = showMessagePanel
submitMessageBtn.onclick = sendMessage 