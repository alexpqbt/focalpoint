import React, { useState, useEffect, useRef } from 'react';
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
  const [showControls, setShowControls] = useState(true);
  const timeoutRef = useRef(null);

  const handleActivity = () => {
    setShowControls(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!isChatOpen) {
      timeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  };

  useEffect(() => {
    handleActivity();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('click', handleActivity);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, [isChatOpen]);

  return (
    <main className={`relative flex flex-row items-center justify-center bg-black overflow-hidden h-[100dvh] w-full transition-colors ${showControls ? 'cursor-default' : 'cursor-none'}`}>
      
      <div className="flex-1 flex items-center justify-center p-4 min-w-0 h-full relative">
        <ViewerFeed videoRef={videoRef} />
      </div>

      {/* Chat Container: Popup on Mobile, Sidebar on Desktop */}
      {isChatOpen && (
        <div className="
          absolute bottom-32 left-4 right-4 max-h-[50vh] z-40 flex flex-col
          md:static md:max-h-full md:h-full md:w-80 md:left-auto md:right-auto md:bottom-auto md:border-l md:border-gray-200 md:z-20
        ">
          <ViewerChat
            viewerName={viewerName}
            messages={messages}
            onSendMessage={onSendMessage}
            onClose={onToggleChat}
          />
        </div>
      )}

      <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-30 transition-opacity duration-300 ease-in-out ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <ViewerControls onToggleChat={onToggleChat} onLeave={onLeave} />
      </div>

    </main>
  );
}