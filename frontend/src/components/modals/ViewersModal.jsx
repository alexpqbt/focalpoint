import React from 'react';
import { X } from 'lucide-react';

export default function ViewersModal({ 
  viewers = [], 
  onRemoveViewer = () => {}, 
  onClose = () => {} 
}) {
  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-red-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-red-100 bg-red-50/50">
          <h3 className="font-bold text-red-700">Viewers: {viewers.length}</h3>
          <button 
            type="button" 
            onClick={onClose}
            className="text-red-400 hover:text-red-700 p-1.5 rounded-full hover:bg-red-100 transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-2">
          <div className="grid grid-cols-2 text-xs font-semibold text-red-400 uppercase border-b pb-2 px-2">
            <span>Name</span>
            <span className="text-right">Action</span>
          </div>
          {viewers.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-6">No viewers currently connected.</p>
          ) : (
            viewers.map((viewer, idx) => (
              <div key={idx} className="grid grid-cols-2 items-center text-sm py-2.5 px-2 rounded-lg hover:bg-red-50/50 border-b border-red-50 transition">
                <span className="font-medium text-slate-800">{viewer}</span>
                <div className="text-right">
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveViewer(viewer);
                    }}
                    className="bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1 rounded text-xs font-medium transition inline-flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
