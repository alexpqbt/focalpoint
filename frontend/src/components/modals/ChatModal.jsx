import React, { useState } from 'react';
import { X, Send } from 'lucide-react';

export default function ChatModal({ 
  messages = [], 
  onSendMessage = () => {}, 
  onClose = () => {} 
}) {
  const [newMsg, setNewMsg] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    onSendMessage(newMsg);
    setNewMsg("");
  };

  return (
    <div 
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-red-100 overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-red-100">
          <h3 className="font-semibold text-red-700">Chat</h3>
          <button 
            type="button"
            onClick={onClose} 
            className="text-red-500 hover:text-red-700"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {messages.map((msg, idx) => (
            <div key={idx} className="border-b border-red-50 pb-2">
              <p className="text-xs font-semibold text-red-900">{msg.name}</p>
              <p className="text-sm text-red-600">{msg.text}</p>
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="p-4 border-t border-red-100 flex gap-2">
          <input 
            type="text" 
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 border border-red-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-600"
          />
          <button 
            type="submit" 
            className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
