import React from 'react';
import ViewerFeed from './ViewerFeed';
import ViewerControls from './ViewerControls';
import ViewerChat from './ViewerChat';

export default function ViewerRoom({
  viewerName = '',
  messages = [],
  isChatOpen = false,
  videoRef,
  onToggleChat = () => {},
  onSendMessage = () => {},
  onLeave = () => {},
}) {
  return (
    <main className="relative flex flex-row items-center justify-center bg-black overflow-hidden h-[100dvh] w-full">

      <div className="flex-1 flex items-center justify-center p-4 min-w-0 h-full relative">
        <ViewerFeed videoRef={videoRef} />
      </div>

      {isChatOpen && (
        <div className="w-80 h-full flex-shrink-0 border-l border-gray-800 bg-gray-900 z-20">
          <ViewerChat
            viewerName={viewerName}
            messages={messages}
            onSendMessage={onSendMessage}
            onClose={onToggleChat}
          />
        </div>
      )}

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
        <ViewerControls onToggleChat={onToggleChat} onLeave={onLeave} />
      </div>

    </main>
  );
}