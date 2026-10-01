import React from 'react';
import { Tv, Download } from 'lucide-react';

export default function EndedScreen({ onStartNewSession = () => {} }) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white/90 backdrop-blur-md p-10 rounded-2xl shadow-xl border border-red-100 max-w-lg w-full flex flex-col items-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-600 shadow-inner">
          <Tv className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-red-600 mb-1">Session Ended</h1>
          <p className="text-xs text-red-400">Thank you for broadcasting with FocalPoint.</p>
        </div>

        <div className="w-full pt-4 border-t border-red-100 flex flex-col items-center space-y-3">
          <span className="text-xs font-semibold text-red-500 uppercase tracking-wider">
            Download previous session logs
          </span>
          <div className="flex items-center justify-center gap-3 w-full">
            <button 
              type="button"
              onClick={() => alert("Downloading CSV logs...")}
              className="flex-1 border border-red-600 hover:bg-red-50 text-red-600 py-2.5 px-4 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button 
              type="button"
              onClick={() => alert("Downloading PDF logs...")}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 px-4 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 transition shadow"
            >
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>

        <button 
          type="button"
          onClick={onStartNewSession}
          className="text-xs text-red-500 hover:text-red-700 underline font-medium pt-2"
        >
          Start New Session
        </button>
      </div>
    </main>
  );
}
