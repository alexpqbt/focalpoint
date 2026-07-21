let SERVER_IP = null
let LIVEKIT_URI = null

export const VIDEO_CFG = {
  audio: false,
  contentHint: "text",
  resolution: {
    frameRate: 15,
    height: 1280,
    width: 720,
  }
}

export async function initConfig() {
  const res = await fetch('/config')
  const data = await res.json()
  SERVER_IP = data.server_ip
  LIVEKIT_URI = data.livekit_uri
}

export const getServerIP = () => SERVER_IP
export const getLivekitURI = () => LIVEKIT_URI