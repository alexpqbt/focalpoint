import React from 'react';
import { X } from 'lucide-react';

export default function ViewersModal({ 
  viewers = [], 
  onRemoveViewer = () => {}, 
  onClose = () => {} 
}) {
  const handleRemoveViewer = (viewer, e) => {
    e.stopPropagation();
    onRemoveViewer(viewer, e);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-red-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-red-100">
          <h3 className="font-semibold text-red-700">Viewers: {viewers.length}</h3>
          <button 
            type="button"
            onClick={onClose} 
            className="text-red-500 hover:text-red-700"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 max-h-96 overflow-y-auto space-y-2">
          <div className="grid grid-cols-2 text-xs font-semibold text-red-400 uppercase border-b pb-2">
            <span>Name</span>
            <span className="text-right">Action</span>
          </div>
          {viewers.map((viewer, idx) => (
            <div key={idx} className="grid grid-cols-2 items-center text-sm py-2 border-b border-red-50">
              <span className="font-medium text-red-900">{viewer}</span>
              <div className="text-right">
                <button 
                  type="button"
                  onClick={(e) => handleRemoveViewer(viewer, e)} 
                  className="text-red-600 hover:text-red-800 text-xs font-medium"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
