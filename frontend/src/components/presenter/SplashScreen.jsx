import React from 'react';
import { Radio } from 'lucide-react';
import Rooms from './Rooms';
import logo from '../../assets/logo2.png';

export default function SplashScreen({ onShareScreen = () => {} }) {
  return (
    <main className="relative flex-1 flex flex-col items-center justify-center p-6 text-center">
      {/* Floating Rooms Sidebar */}
      <div className="absolute left-6 top-6 bottom-6 z-10 text-left">
        <Rooms onShareScreen={onShareScreen} />
      </div>

      <div className="bg-white/90 backdrop-blur-md p-10 rounded-2xl shadow-xl border border-red-100 max-w-lg w-full flex flex-col items-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-600 shadow-inner">
          <img src={logo} alt="Logo" className="w-8 h-8" />
        </div>
        <div>
          <p className="text-sm text-red-500">
            Broadcast your screen, Local and Offline.
          </p>
        </div>
        <button
          type="button"
          onClick={onShareScreen}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-6 rounded-xl shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition active:scale-95"
        >
          <Radio className="w-5 h-5 animate-pulse" />
          <span>Share Screen</span>
        </button>
      </div>
    </main>
  );
}
