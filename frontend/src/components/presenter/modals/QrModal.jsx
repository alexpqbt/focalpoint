import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';

export default function QrModal({ qrRef, viewerURL = '', onClose = () => {} }) {
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    if (!viewerURL) return;
    navigator.clipboard.writeText(viewerURL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl p-6 w-fit max-w-[95vw] shadow-2xl border border-blue-100 relative text-center flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-blue-500 hover:text-blue-700 z-10"
          aria-label="Close modal"
        >
          <X className="w-6 h-6 cursor-pointer" />
        </button>

        <div className="flex items-center justify-center mb-4 rounded overflow-hidden max-w-full">
          <canvas ref={qrRef} className="max-w-full h-auto block" />
        </div>

        <div className="flex items-center justify-between w-full bg-blue-50 p-2 rounded text-xs text-blue-700 border border-blue-200 gap-2">
          <span className="truncate">{viewerURL || 'waiting…'}</span>
          <button
            type="button"
            onClick={copyLink}
            className="bg-blue-600 text-white px-3 py-1 rounded font-medium flex items-center gap-1 shrink-0 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}