import React from 'react';
import { Radio } from 'lucide-react';

export default function BroadcastScreen() {
  return (
    <main className="flex-1 p-6 flex items-center justify-center bg-slate-100/50">
      <div className="bg-slate-900 rounded-xl shadow-2xl overflow-hidden w-full max-w-5xl aspect-video border-2 border-red-900/40 flex flex-col items-center justify-center relative group">
        {/* Simulated Screen Stream */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-black flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center mb-4 text-red-500 animate-pulse">
            <Radio className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">Broadcasting Live Stream</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            Your screen is currently being shared securely via FocalPoint local channel.
          </p>
        </div>
        <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-md border border-red-500/30 text-white text-xs font-mono flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
          <span>Live (1080p @ 60fps)</span>
        </div>
      </div>
    </main>
  );
}
