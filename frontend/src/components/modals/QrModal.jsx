import React from 'react';
import { X, Copy } from 'lucide-react';

export default function QrModal() {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-red-100 relative text-center animate-in fade-in zoom-in-95 duration-200">
        <button 
          type="button"
          className="absolute top-4 right-4 text-red-400 hover:text-red-700 p-1.5 rounded-full hover:bg-red-50 transition"
          aria-label="Close modal"
        >
          <X className="w-6 h-6" />
        </button>
        <h3 className="text-base font-bold text-red-700 mb-4">Session QR Code</h3>
        
        <div className="w-64 h-64 bg-red-50 mx-auto border-2 border-red-600 rounded-xl p-4 flex items-center justify-center shadow-inner mb-6">
          <div className="grid grid-cols-6 gap-2 w-full h-full bg-white p-3 rounded border border-red-200">
            {[...Array(36)].map((_, i) => (
              <div key={i} className={`rounded-xs ${i % 3 === 0 || i % 5 === 0 ? 'bg-red-600' : 'bg-red-100'}`}></div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between bg-red-50 p-2 rounded-lg text-xs text-red-700 border border-red-200 gap-2">
          <span className="truncate">https://www.figma.com/design/ZqVCE6DcVwxLilVKhaD4K/...</span>
          <button 
            type="button"
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded font-medium flex items-center gap-1 shrink-0 transition"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy</span>
          </button>
        </div>
      </div>
    </div>
  );
}
