import React from 'react';
import { Tv, Radio } from 'lucide-react';

export default function SplashScreen() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white/80 backdrop-blur-md p-10 rounded-2xl shadow-xl border border-red-100 max-w-lg w-full flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-4 shadow-inner">
          <Tv className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-red-600 mb-2">FocalPoint</h1>
        <p className="text-sm text-red-500 mb-8">Broadcast your screen, Local and Offline.</p>
        
        <button 
          type="button"
          className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-medium py-3 px-6 rounded-xl shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transform active:scale-95 transition"
        >
          <Radio className="w-5 h-5 animate-pulse" />
          <span>Share Screen</span>
        </button>
      </div>
    </main>
  );
}
