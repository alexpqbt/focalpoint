const videoElem = document.getElementById("video") as HTMLMediaElement
const startBtn = document.getElementById("start")!
const stopBtn = document.getElementById("stop")!

const displayMediaOptions = {
  video: true,
  audio: false
}

async function startCapture() {
  try {
    videoElem.srcObject = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions)
  } catch (error) {
    console.error(error)
  }
}

function stopCapture() {
  let stream = videoElem.srcObject as MediaStream
  let tracks = stream.getTracks()

  tracks.forEach((track) => track.stop())
  videoElem.srcObject = null
}

startBtn.addEventListener("click", (e) => {
  startCapture()
})

stopBtn.addEventListener("click", (e) => {
  stopCapture()
})