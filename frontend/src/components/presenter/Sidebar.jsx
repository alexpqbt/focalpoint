import React from 'react';
import { LogOut, Maximize2, MessageSquare } from 'lucide-react';

export default function Sidebar({ 
  onEndSession = () => {},
  onOpenModal = () => {}, 
  viewers = [], 
  messages = [] 
}) {
  return (
    <aside className="w-80 bg-white border-r border-red-100 flex flex-col justify-between shadow-sm z-10">
      <div>
        {/* End Session Button */}
        <div className="p-4 border-b border-red-100">
          <button 
            type="button"
            onClick={onEndSession}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-between shadow transition"
          >
            <span>End Session</span>
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* QR Code Thumbnail Preview */}
        <div className="p-4 border-b border-red-100 text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-red-500 block mb-2">
            Click to Expand
          </span>
          <div 
            onClick={() => onOpenModal('qr')}
            className="cursor-pointer inline-block p-2 border border-red-200 rounded-lg bg-white hover:shadow-md transition"
          >
            <div className="w-32 h-32 bg-red-50 flex items-center justify-center border border-red-600 text-red-600 font-bold text-xs rounded">
              [QR CODE]
            </div>
          </div>
        </div>

        {/* Chat Preview Section */}
        <div className="p-4 border-b border-red-100">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-red-600 flex items-center gap-1 text-sm">
              <MessageSquare className="w-4 h-4" /> Chat
            </span>
            <button 
              type="button"
              onClick={() => onOpenModal('chat')}
              className="text-red-500 hover:text-red-700"
              aria-label="Expand Chat"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2 max-h-36 overflow-y-auto">
            {messages.slice(0, 2).map((msg, idx) => (
              <div key={idx} className="text-xs">
                <p className="font-semibold text-red-900">{msg.name}</p>
                <p className="text-red-600 truncate">{msg.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Viewers Trigger Button */}
        <div className="p-4">
          <div 
            onClick={() => onOpenModal('viewers')}
            className="flex items-center justify-between cursor-pointer bg-red-50 hover:bg-red-100 p-2.5 rounded-lg transition"
          >
            <span className="font-semibold text-sm text-red-700">Viewers: {viewers.length}</span>
            <Maximize2 className="w-4 h-4 text-red-600" />
          </div>
        </div>
      </div>
    </aside>
  );
}
