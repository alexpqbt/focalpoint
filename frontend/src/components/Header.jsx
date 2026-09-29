import React from 'react';
import { Tv } from 'lucide-react';

export default function Header() {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-red-100 shadow-sm z-20">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-bold shadow-md">
          <Tv className="w-4 h-4" />
        </div>
        <span className="text-xl font-bold tracking-tight text-red-600">FocalPoint</span>
      </div>
      <div className="text-xs text-red-400 font-mono hidden sm:block">
        Mode: Standby
      </div>
    </header>
  );
}
