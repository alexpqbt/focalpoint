import type { SignalMessage } from "./signal";

const videoElem = document.getElementById("video") as HTMLMediaElement;
const startBtn = document.getElementById("start")!;
const stopBtn = document.getElementById("stop")!;

const displayMediaOptions = {
  video: true,
  audio: false
};

const server = import.meta.env.VITE_SIGNALING_SERVER;
const testRoom = "room_1";
const wsConnection = `${server}/ws/${testRoom}`;

let mediaStream: MediaStream;
const configuration: RTCConfiguration = { iceServers: [] };
const peersMap = new Map<string, RTCPeerConnection>();

async function startCapture() {
  try {
    mediaStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
    videoElem.srcObject = mediaStream;
  } catch (error) {
    console.error("Screen capture failed:", error);
  }
}

function stopCapture() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    videoElem.srcObject = null;
  }
}

async function makeCall() {
  const socket = new WebSocket(wsConnection);

  socket.addEventListener("message", async (event: MessageEvent<string>) => {
    const message: SignalMessage = JSON.parse(event.data);

    if (message.type === "answer") {
      const studentConnection = peersMap.get(message.target_id!);
      if (studentConnection) {
        await studentConnection.setRemoteDescription({
          type: "answer",
          sdp: message.sdp,
        });
      }
    }

    if (message.type === "peers-joined") {
      if (!mediaStream) {
        console.error("No media stream available to share.");
        return;
      }

      const studentConnection = new RTCPeerConnection(configuration);
      peersMap.set(message.peer_id, studentConnection);

      studentConnection.onconnectionstatechange = () => {
        if (["disconnected", "failed", "closed"].includes(studentConnection.connectionState)) {
          console.log(`Student ${message.peer_id} disconnected.`);
          studentConnection.close();
          peersMap.delete(message.peer_id);
        }
      };

      studentConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const iceMsg: SignalMessage = {
            type: "ice-candidate",
            candidate: JSON.stringify(event.candidate),
            target_id: message.peer_id,
          };
          socket.send(JSON.stringify(iceMsg));
        }
      };

      mediaStream.getTracks().forEach((track) => studentConnection.addTrack(track, mediaStream));

      const offer = await studentConnection.createOffer();
      await studentConnection.setLocalDescription(offer);

      const sendPacket: SignalMessage = {
        type: "offer",
        sdp: offer.sdp!,
        target_id: message.peer_id,
      };
      socket.send(JSON.stringify(sendPacket));
    }

    if (message.type === "ice-candidate") {
      const studentConnection = peersMap.get(message.target_id!);
      if (studentConnection && message.candidate) {
        await studentConnection.addIceCandidate(new RTCIceCandidate(JSON.parse(message.candidate)));
      }
    }
  });

  socket.addEventListener("open", () => {
    const join: SignalMessage = { type: "join", role: "teacher" };
    socket.send(JSON.stringify(join));
  }, { once: true });
}

startBtn.addEventListener("click", () => startCapture());
stopBtn.addEventListener("click", () => stopCapture());
videoElem.addEventListener("play", () => makeCall());
