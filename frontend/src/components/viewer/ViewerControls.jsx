import React from 'react';
import { X, MessageCircle } from 'lucide-react';

export default function ViewerControls({ 
  onToggleChat = () => {}, 
  onLeave = () => {} 
}) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-red-900/50 px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-4 z-30">
      <button 
        type="button"
        onClick={onToggleChat}
        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-full text-xs font-medium border border-slate-700 transition"
      >
        <span>Chat</span>
        <MessageCircle className="w-4 h-4 text-red-400" />
      </button>
      <button 
        type="button"
        onClick={onLeave}
        className="w-9 h-9 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow transition"
        title="Leave Room"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
