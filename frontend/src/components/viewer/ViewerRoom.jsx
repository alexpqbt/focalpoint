import React from 'react';
import ViewerFeed from './ViewerFeed';
import ViewerControls from './ViewerControls';
import ViewerChat from './ViewerChat';

export default function ViewerRoom({ 
  viewerName = '', 
  messages = [], 
  isChatOpen = false, 
  onToggleChat = () => {}, 
  onSendMessage = () => {}, 
  onLeave = () => {} 
}) {
  return (
    <main className="relative flex items-center justify-center p-4 bg-black overflow-hidden min-h-screen">
      <ViewerFeed />

      <ViewerControls 
        onToggleChat={onToggleChat} 
        onLeave={onLeave} 
      />

      {isChatOpen && (
        <ViewerChat 
          viewerName={viewerName}
          messages={messages}
          onSendMessage={onSendMessage}
          onClose={onToggleChat}
        />
      )}
    </main>
  );
}
