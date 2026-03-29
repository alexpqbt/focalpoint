import type { SignalMessage } from "./signal";

const videoElem = document.getElementById("video") as HTMLMediaElement;
const params = new URLSearchParams(window.location.search);
const roomId = params.get("room");

const server = import.meta.env.VITE_SIGNALING_SERVER;

async function joinRoom(roomId: string) {
  const wsConnection = `${server}/ws/${roomId}`;
  const socket = new WebSocket(wsConnection);
  const configuration: RTCConfiguration = { iceServers: [] };

  let teacherConnection: RTCPeerConnection | null = null;
  let teacherId: string | null = null;

  socket.addEventListener('open', () => {
    const join: SignalMessage = { type: "join", role: "student" };
    socket.send(JSON.stringify(join));
  });

  socket.addEventListener('message', async (event: MessageEvent<string>) => {
    const message: SignalMessage = JSON.parse(event.data);

    if (message.type === "offer") {
      teacherId = message.target_id ?? null;
      teacherConnection = new RTCPeerConnection(configuration);

      teacherConnection.ontrack = (event) => {
        if (event.streams && event.streams) {
          videoElem.srcObject = event.streams[0];
          console.log("Teacher stream attached successfully.");
        }
      };

      teacherConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const iceMsg: SignalMessage = {
            type: "ice-candidate",
            candidate: JSON.stringify(event.candidate),
            target_id: teacherId,
          };
          socket.send(JSON.stringify(iceMsg));
        }
      };

      await teacherConnection.setRemoteDescription({ type: "offer", sdp: message.sdp });
      const answer = await teacherConnection.createAnswer();
      await teacherConnection.setLocalDescription(answer);

      const remoteDescription: SignalMessage = {
        type: "answer",
        sdp: answer.sdp!,
        target_id: teacherId,
      };
      socket.send(JSON.stringify(remoteDescription));
    }

    if (message.type === "ice-candidate") {
      if (teacherConnection && message.candidate) {
        try {
          await teacherConnection.addIceCandidate(new RTCIceCandidate(JSON.parse(message.candidate)));
        } catch (e) {
          console.error("Error adding ICE candidate:", e);
        }
      }
    }
  });
}

if (roomId) {
  document.getElementById("room-selection")!.classList.add("hidden");
  document.getElementById("classroom-vid")!.classList.remove("hidden");
  document.getElementById("classroom-chat")!.classList.remove("hidden");
  joinRoom(roomId);
}


