import React, { useState } from 'react';
import { X, Send } from 'lucide-react';

export default function ViewerChat({ 
  viewerName = '', 
  messages = [], 
  onSendMessage = () => {}, 
  onClose = () => {} 
}) {
  const [newMsg, setNewMsg] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    onSendMessage(newMsg);
    setNewMsg('');
  };

  return (
    <div className="absolute inset-x-4 bottom-20 max-w-lg mx-auto bg-white rounded-xl shadow-2xl border border-blue-100 flex flex-col z-40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-100">
        <span className="text-xs font-semibold text-blue-700">Chat Room ({viewerName})</span>
        <button 
          type="button"
          onClick={onClose} 
          className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-100 transition"
          aria-label="Close Chat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 max-h-48 overflow-y-auto space-y-2">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-4">No messages yet.</p>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className="border-b border-blue-50 pb-1 text-xs">
              <span className="font-semibold text-blue-900">{msg.name}: </span>
              <span className="text-blue-700">{msg.text}</span>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-blue-100 flex gap-2 bg-white">
        <input 
          type="text"
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          placeholder="Send message..."
          className="flex-1 border border-blue-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-600 text-blue-900"
        />
        <button 
          type="submit" 
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs flex items-center justify-center transition"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
