import React from 'react';
import { X } from 'lucide-react';

export default function ChatModal({ 
  messages = [], 
  onClose = () => {} 
}) {
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
          {messages.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-6">No messages yet.</p>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className="border-b border-red-50 pb-2">
                <p className="text-xs font-semibold text-red-900">{msg.name}</p>
                <p className="text-sm text-red-600">{msg.text}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
