import React, { useState, useRef, useCallback, useEffect } from 'react';
import Header from '../common/Header';
import Footer from '../common/Footer';
import SplashScreen from './SplashScreen';
import Dashboard from './Dashboard';
import EndedScreen from './EndedScreen';
import QrModal from './modals/QrModal';
import ViewersModal from './modals/ViewersModal';
import ChatModal from './modals/ChatModal';
import { Room, RoomEvent } from 'livekit-client';
import { toCanvas } from 'qrcode';

import { initConfig, getServerIP, getLivekitURI, VIDEO_CFG } from '../config.js';
import '../util/polyfill.js';

export default function PresenterApp() {
  const [screen, setScreen] = useState('splash');
  const [activeModal, setActiveModal] = useState(null);

  const [viewers, setViewers] = useState([]);       // array of { identity, name }
  const [messages, setMessages] = useState([]);
  const [viewerURL, setViewerURL] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [ready, setReady] = useState(false);
  const [screenStream, setScreenStream] = useState(null);

  const roomRef = useRef(null);
  const tokenRef = useRef(null);
  const pollRef = useRef(null);
  const previewRef = useRef(null);
  const qrRef = useRef(null);

  useEffect(() => {
    initConfig().then(() => setReady(true));
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchParticipants = useCallback(async () => {
    const res = await fetch('/participants', {
      headers: { Authorization: `Bearer ${tokenRef.current}` },
    });
    if (!res.ok) return console.error('participant fetch failed', res.status);
    const { participants } = await res.json();
    setViewers(participants.map(p => ({
      identity: p.identity,
      name: p.name || p.identity,
    })));
  }, []);

  const startPolling = useCallback(() => {
    fetchParticipants();
    pollRef.current = setInterval(fetchParticipants, 3500);
  }, [fetchParticipants]);

  const receiveMessages = useCallback((room) => {
    room.registerTextStreamHandler('student-message', async (reader, info) => {
      const text = await reader.readAll();
      const participant = room.remoteParticipants.get(info.identity);
      const senderName = participant?.name || info.identity;
      setMessages(prev => [...prev, { name: senderName, text }]);
    });
  }, []);

  const stopSharing = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      if (qrRef.current) qrRef.current.replaceChildren();
      await room.localParticipant.setScreenShareEnabled(false);
      await room.disconnect();
      if (previewRef.current) previewRef.current.srcObject = null;
      setViewerURL('');
      setScreenStream(null);
      roomRef.current = null;
    } catch (err) {
      console.error('Failed to stop sharing:', err);
    } finally {
      setIsSharing(false);
      stopPolling();
      setViewers([]);
    }
  }, [stopPolling]);

  const startSharing = useCallback(async () => {
    if (isSharing || !ready) return;
    setIsSharing(true);
    try {
      if (qrRef.current) qrRef.current.replaceChildren();

      const token = await fetch('/token?role=presenter&identity=presenter').then(r => r.text());
      tokenRef.current = token;

      await fetch('/logs/reset', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const room = new Room();
      roomRef.current = room;
      await room.connect(getLivekitURI(), token);
      await room.localParticipant.setScreenShareEnabled(true, VIDEO_CFG);
      room.on(RoomEvent.LocalTrackUnpublished, stopSharing);
      receiveMessages(room);

      const pub = room.localParticipant.getTrackPublication('screen_share');
      if (!pub?.videoTrack) throw new Error('Screen share track unavailable');

      setScreenStream(new MediaStream([pub.videoTrack.mediaStreamTrack]));

      const url = `http://${getServerIP()}:8080/view`;
      setViewerURL(url);

      startPolling();
      setScreen('dashboard');
    } catch (err) {
      console.error('Failed to start sharing:', err);
      setIsSharing(false);
    }
  }, [isSharing, ready, receiveMessages, startPolling, stopSharing]);

  // attach the stream to the video element AFTER it's rendered
  useEffect(() => {
    if (previewRef.current && screenStream) {
      previewRef.current.srcObject = screenStream;
    }
  }, [screenStream, screen]);

  // render the QR code once the qr div and the URL are both ready
  useEffect(() => {
  if (activeModal === 'qr' && qrRef.current && viewerURL) {
    toCanvas(qrRef.current, viewerURL, { width: 256 }, (err) => {
        if (err) console.error('QR render failed:', err);
      });
    }
  }, [activeModal, viewerURL]);

  const handleEndSession = useCallback(async () => {
    await stopSharing();
    setScreen('ended');
  }, [stopSharing]);

  const handleRemoveViewer = useCallback(async (identity) => {
    const res = await fetch(`/participants/${encodeURIComponent(identity)}/remove`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenRef.current}` },
    });
    if (!res.ok) return console.error('disconnect failed', identity, res.status);
    fetchParticipants();
  }, [fetchParticipants]);

  const exportLog = useCallback(async (format) => {
    const res = await fetch(`/logs/export?format=${format}`, {
      headers: { Authorization: `Bearer ${tokenRef.current}` },
    });
    if (!res.ok) return console.error('export failed', res.status);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session_log.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // cleanup on unmount (React Router navigation away)
  useEffect(() => {
    return () => {
      stopPolling();
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, [stopPolling]);

  if (!ready) {
    return <div className="p-8 text-red-700">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:24px_24px] flex flex-col justify-between text-red-700 font-sans select-none">
      <Header currentScreen={screen} />

      {screen === 'splash' && (
        <SplashScreen onShareScreen={startSharing} />
      )}

      {screen === 'dashboard' && (
        <Dashboard
          onEndSession={handleEndSession}
          onOpenModal={setActiveModal}
          viewers={viewers}
          messages={messages}
          previewRef={previewRef}
          onExport={exportLog}
          isSharing={isSharing}
        />
      )}

      {screen === 'ended' && (
        <EndedScreen onStartNewSession={() => setScreen('dashboard')} />
      )}

      <Footer />

      {activeModal === 'qr' && (
        <QrModal qrRef={qrRef} viewerURL={viewerURL} onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'viewers' && (
        <ViewersModal
          viewers={viewers}
          onRemoveViewer={handleRemoveViewer}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'chat' && (
        <ChatModal messages={messages} onClose={() => setActiveModal(null)} />
      )}
    </div>
  );
}