import React, { useState } from 'react';
import ViewerJoin from './ViewerJoin';
import ViewerRoom from './ViewerRoom';

export default function ViewerApp() {
  const [screen, setScreen] = useState('join'); // 'join' | 'room'
  const [viewerName, setViewerName] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);

  const [messages, setMessages] = useState([
    { name: "Anakin", text: "Supercalifragilisticexpialidocious" },
    { name: "Alex", text: "Supercalifragilisticexpialidocious" },
    { name: "Erika", text: "lorem ipsum dolor sit amet consectetur" },
  ]);

  const handleConnect = (name) => {
    setViewerName(name);
    setScreen('room');
  };

  const handleSendMessage = (text) => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { name: viewerName || 'Viewer', text }]);
  };

  const handleLeave = () => {
    setIsChatOpen(false);
    setScreen('join');
  };

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {screen === 'join' && (
        <ViewerJoin onConnect={handleConnect} />
      )}

      {screen === 'room' && (
        <ViewerRoom 
          viewerName={viewerName}
          messages={messages}
          isChatOpen={isChatOpen}
          onToggleChat={() => setIsChatOpen((prev) => !prev)}
          onSendMessage={handleSendMessage}
          onLeave={handleLeave}
        />
      )}
    </div>
  );
}
