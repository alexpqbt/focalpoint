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
        className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl border border-red-100 relative text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-red-500 hover:text-red-700"
          aria-label="Close modal"
        >
          <X className="w-6 h-6" />
        </button>

        {/* QR code renders into this div via qrRef */}
        <div className="w-64 h-64 bg-red-50 mx-auto border-2 border-red-600 flex items-center justify-center mb-4 rounded">
          <canvas ref={qrRef} />
        </div>

        <div className="flex items-center justify-between bg-red-50 p-2 rounded text-xs text-red-700 border border-red-200 gap-2">
          <span className="truncate">{viewerURL || 'waiting…'}</span>
          <button
            type="button"
            onClick={copyLink}
            className="bg-red-600 text-white px-3 py-1 rounded font-medium flex items-center gap-1 shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}