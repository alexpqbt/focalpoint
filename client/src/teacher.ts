import type { SignalMessage } from "./signal";

const videoElem = document.getElementById("video") as HTMLMediaElement
const startBtn = document.getElementById("start")!
const stopBtn = document.getElementById("stop")!

const displayMediaOptions = {
  video: true,
  audio: false
}

const server = import.meta.env.VITE_SIGNALING_SERVER
const testRoom = "room_1"
const wsConnection = `${server}/ws/${testRoom}`

let mediaStream: MediaStream

async function startCapture() {
  try {
    mediaStream = videoElem.srcObject = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions)
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

async function makeCall() {
  const socket = new WebSocket(wsConnection)
  const configuration: RTCConfiguration = { 'iceServers': [] }
  const peersMap = new Map<string, RTCPeerConnection>


  socket.addEventListener("message", async (event: MessageEvent<string>) => {
    const message: SignalMessage = JSON.parse(event.data)
    if (message.type == "answer") {
      const remoteDescription = {
        type: message.type,
        sdp: message.sdp!,
      }

      const studentConnection = peersMap.get(message.target_id!)
      if (!studentConnection) return
      await studentConnection.setRemoteDescription(remoteDescription)
    }

    if (message.type == "peers-joined") {
      const notif = {
        type: message.type,
        peer_id: message.peer_id,
      }

      const studentConnection = new RTCPeerConnection(configuration)

      if (!mediaStream) return

      const tracks = mediaStream.getTracks()
      tracks.forEach((track) => studentConnection.addTrack(track, mediaStream))

      peersMap.set(notif.peer_id, studentConnection)

      studentConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const iceMsg: SignalMessage = {
            type: "ice-candidate",
            candidate: JSON.stringify(event.candidate),
            target_id: message.peer_id,
          }
          socket.send(JSON.stringify(iceMsg))
        }
      }

      const offer = await studentConnection.createOffer()
      studentConnection.setLocalDescription(offer)

      const sendPacket: SignalMessage = {
        type: "offer",
        sdp: offer.sdp!,
        target_id: notif.peer_id,
      }
      socket.send(JSON.stringify(sendPacket))
    }

    if (message.type == "ice-candidate") {
      try {
        const candidate = new RTCIceCandidate(JSON.parse(message.candidate))
        const studentConnection = peersMap.get(message.target_id!)
        if (!studentConnection) return

        await studentConnection.addIceCandidate(candidate)
      }
      catch (e) {
        console.error("ICE candidate error, skibidi dead", e);
      }
    }

  })

  socket.addEventListener("open", async () => {
    console.log("Oh yeh it's open baby")
    try {
      const join =
      {
        type: "join",
        role: "teacher",
      }

      socket.send(JSON.stringify(join))
    }
    catch (e: any) {
      console.error("Oh my days, failed to send join and offer request.", e)
    }
  }, { once: true })


}

startBtn.addEventListener("click", () => {
  startCapture()
})

stopBtn.addEventListener("click", () => {
  stopCapture()
})

videoElem.addEventListener("play", () => makeCall())
