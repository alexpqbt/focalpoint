import React from 'react';
import { LogOut, Maximize2, MessageSquare, X } from 'lucide-react';

export default function Sidebar({ 
  onOpenModal = () => {}, 
  viewers = [], 
  onRemoveViewer = () => {}, 
  messages = [] 
}) {
  return (
    <aside className="w-80 bg-white border-r border-red-100 flex flex-col justify-between shadow-sm z-10 overflow-y-auto">
      <div>
        {/* End Session Button */}
        <div className="p-4 border-b border-red-100">
          <button 
            type="button"
            className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-between shadow transition active:scale-95"
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
            className="cursor-pointer inline-block p-2 border border-red-200 rounded-lg bg-white hover:shadow-md hover:border-red-400 transition group"
          >
            <div className="w-32 h-32 bg-red-50 flex flex-col items-center justify-center border border-red-600 text-red-600 rounded">
              <div className="grid grid-cols-4 gap-1.5 p-2 w-full h-full">
                {[...Array(16)].map((_, i) => (
                  <div key={i} className={`bg-red-600 rounded-xs ${i % 2 === 0 ? 'opacity-90' : 'opacity-40'}`}></div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Chat Preview Section */}
        <div className="p-4 border-b border-red-100">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-red-600 flex items-center gap-1.5 text-sm">
              <MessageSquare className="w-4 h-4" /> Chat
            </span>
            <button 
              type="button"
              onClick={() => onOpenModal('chat')}
              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition"
              aria-label="Expand Chat"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2.5 max-h-36 overflow-y-auto pr-1">
            {messages.slice(0, 2).map((msg, idx) => (
              <div key={idx} className="text-xs bg-red-50/50 p-2 rounded border border-red-100">
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
            className="flex items-center justify-between cursor-pointer bg-red-50 hover:bg-red-100 p-3 rounded-lg border border-red-100 transition shadow-xs"
          >
            <span className="font-semibold text-sm text-red-700">Viewers: {viewers.length}</span>
            <Maximize2 className="w-4 h-4 text-red-600" />
          </div>
        </div>
      </div>

      {/* Quick Viewer Quick-Remove List */}
      <div className="p-4 border-t border-red-100 space-y-1.5 max-h-40 overflow-y-auto bg-slate-50/50">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400 block mb-1">
          Quick Management
        </span>
        {viewers.slice(0, 3).map((viewer, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-white border border-red-100 shadow-2xs">
            <span className="font-medium text-slate-700 truncate max-w-[170px]">{viewer}</span>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveViewer(viewer);
              }}
              className="text-red-400 hover:text-red-700 p-1 rounded hover:bg-red-50 transition"
              title="Remove Viewer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
