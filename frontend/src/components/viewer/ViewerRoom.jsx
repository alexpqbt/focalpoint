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
  // 1. State to track if controls should be visible
  const [showControls, setShowControls] = useState(true);
  
  // 2. Ref to hold the timeout ID so we can reset it
  const timeoutRef = useRef(null);

  // 3. Function to handle user activity
  const handleActivity = () => {
    setShowControls(true);
    
    // Clear any existing timer
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set a new timer to hide controls after 3 seconds
    timeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000); // 3000ms = 3 seconds. Adjust as needed.
  };

  // 4. Setup event listeners on mount
  useEffect(() => {
    // Start the initial timer
    handleActivity();

    // Listen for mouse movement (desktop), screen taps (mobile), and clicks
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('click', handleActivity);

    // Cleanup: remove listeners and clear timer when component unmounts
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, []);

  return (
    <main 
      className={`relative flex flex-row items-center justify-center bg-black overflow-hidden h-[100dvh] w-full transition-colors ${
        showControls ? 'cursor-default' : 'cursor-none'
      }`}
    >
      
      {/* Video Feed Area */}
      <div className="flex-1 flex items-center justify-center p-4 min-w-0 h-full relative">
        <ViewerFeed videoRef={videoRef} />
      </div>

      {/* Chat Sidebar */}
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

      <div 
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-30 transition-opacity duration-300 ease-in-out ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <ViewerControls onToggleChat={onToggleChat} onLeave={onLeave} />
      </div>

    </main>
  );
}