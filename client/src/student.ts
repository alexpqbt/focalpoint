const videoElem = document.getElementById("video") as HTMLMediaElement
const params = new URLSearchParams(window.location.search)
const roomId = params.get("room")

if (roomId) {
  document.getElementById("room-selection")!.classList.add("hidden")
  document.getElementById("classroom-vid")!.classList.remove("hidden")
  document.getElementById("classroom-chat")!.classList.remove("hidden")
}

const displayMediaOptions = {
  video: true,
  audio: false
}

