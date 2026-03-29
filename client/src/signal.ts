export type SignalMessage =
  | { type: "join", role: "teacher" | "student" }
  | { type: "offer", sdp: string, target_id?: string | null }
  | { type: "answer", sdp: string, target_id?: string | null }
  | { type: "ice-candidate", candidate: string, target_id?: string | null }
  | { type: "peers-joined", peer_id: string }
