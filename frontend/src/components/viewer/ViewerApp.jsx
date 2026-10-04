import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import ViewerJoin from './ViewerJoin';
import ViewerRoom from './ViewerRoom';
import { initConfig, getLivekitURI } from '../config.js';
import '../util/polyfill.js';

export default function ViewerApp() {
  const [screen, setScreen] = useState('join'); // 'join' | 'room'
  const [viewerName, setViewerName] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [ready, setReady] = useState(false);
  const [stream, setStream] = useState(null);

  const roomRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    initConfig().then(() => setReady(true));
  }, []);

  const connect = useCallback(async (name) => {
    if (!ready) return;
    try {
      const identity = 'student-' + Math.random().toString(36).substring(2, 9);
      const token = await fetch(
        `/token?role=student&identity=${identity}&name=${encodeURIComponent(name)}`
      ).then((r) => r.text());

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === 'video') {
          setStream(new MediaStream([track.mediaStreamTrack]));
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === 'video') {
          setStream(null);
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        console.log('Disconnected from room');
        resetToJoin();
      });

      await room.connect(getLivekitURI(), token);

      setViewerName(name);
      setScreen('room');
    } catch (err) {
      console.error('Failed to join session', err);
    }
  }, [ready]);

  const resetToJoin = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.disconnect().catch(() => {});
      roomRef.current = null;
    }
    setStream(null);
    setMessages([]);
    setIsChatOpen(false);
    setViewerName('');
    setScreen('join');
  }, []);

  const disconnect = useCallback(async () => {
    if (roomRef.current) {
      try { await roomRef.current.disconnect(); } catch (err) { console.error(err); }
      roomRef.current = null;
    }
    setStream(null);
    setMessages([]);
    setIsChatOpen(false);
    setScreen('join');
  }, []);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim()) return;
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.sendText(text, { topic: 'student-message' });
      setMessages((prev) => [...prev, { name: viewerName || 'Viewer', text }]);
    } catch (err) {
      console.error('Failed to send message', err);
    }
  }, [viewerName]);

  // attach the incoming stream to the video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, screen]);

  // cleanup on unmount (navigating away)
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect().catch(() => {});
        roomRef.current = null;
      }
    };
  }, []);

  if (!ready) return <div className="p-8 text-red-700">Loading…</div>;

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {screen === 'join' && (
        <ViewerJoin onConnect={connect} />
      )}

      {screen === 'room' && (
        <ViewerRoom
          viewerName={viewerName}
          messages={messages}
          isChatOpen={isChatOpen}
          videoRef={videoRef}
          onToggleChat={() => setIsChatOpen((prev) => !prev)}
          onSendMessage={sendMessage}
          onLeave={disconnect}
        />
      )}
    </div>
  );
}