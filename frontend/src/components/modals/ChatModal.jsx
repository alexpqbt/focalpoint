import React from 'react';
import { X, Send } from 'lucide-react';

export default function ChatModal() {
  const messages = [
    { name: "Anakin", text: "Supercalifragilisticexpialidocious" },
    { name: "Alex", text: "Supercalifragilisticexpialidocious" },
    { name: "Erika", text: "lorem ipsum dolor sit amet consectetur" },
    { name: "Tristan", text: "lorem ipsum dolor sit amet consectetur" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-red-100 overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-red-100 bg-red-50/50">
          <h3 className="font-bold text-red-700">Chat</h3>
          <button 
            type="button" 
            className="text-red-400 hover:text-red-700 p-1.5 rounded-full hover:bg-red-100 transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {messages.map((msg, idx) => (
            <div key={idx} className="bg-red-50/40 p-3 rounded-xl border border-red-100">
              <p className="text-xs font-bold text-red-900 mb-0.5">{msg.name}</p>
              <p className="text-sm text-slate-700">{msg.text}</p>
            </div>
          ))}
        </div>

        <form className="p-4 border-t border-red-100 bg-slate-50 flex gap-2">
          <input 
            type="text" 
            placeholder="Type a message..."
            className="flex-1 bg-white border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-600 text-slate-800"
          />
          <button 
            type="button"
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-1 transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
