import type { SignalMessage } from "./signal";

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


const server = import.meta.env.VITE_SIGNALING_SERVER

async function joinRoom(roomId: string) {
  const wsConnection = `${server}/ws/${roomId}`;
  const socket = new WebSocket(wsConnection);
  const configuration: RTCConfiguration = { 'iceServers': [] };

  socket.addEventListener('open', async () => {
    console.log("Websocket is open. You may now join");
    try {
      const join =
      {
        type: "join",
        role: "student",
      }
      socket.send(JSON.stringify(join));
    }
    catch (e: any) {
      console.error("Oh my days, failed to send join and offer request.", e);
    }

  });

  socket.addEventListener('message', async (event: MessageEvent<string>) => {
    const message: SignalMessage = JSON.parse(event.data);

    if (message.type === "offer") {

      const teacherConnection = new RTCPeerConnection(configuration);

      await teacherConnection.setRemoteDescription({ type: "offer", sdp: message.sdp });

      const answer = await teacherConnection.createAnswer();
      teacherConnection.setLocalDescription(answer);

      const remoteDescription: SignalMessage =
      {
        type: "answer",
        sdp: answer.sdp!,
        target_id: message.target_id,
      };

      socket.send(JSON.stringify(remoteDescription));
    }
  });

}
