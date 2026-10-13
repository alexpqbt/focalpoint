import React from 'react';
import { Radio } from 'lucide-react';
import Rooms from './Rooms';
import logo from '../../assets/logo2.png';

export default function SplashScreen({ 
  onShareScreen, 
  onStartSharing = () => {},
  roomsRef: externalRoomsRef 
}) {
  const localRoomsRef = React.useRef(null);
  const roomsRef = externalRoomsRef || localRoomsRef;

  const handleShareClick = () => {
    if (onShareScreen) {
      onShareScreen();
    } else {
      roomsRef.current?.handleAddRoom();
    }
  };

  return (
    <main className="relative flex-1 flex flex-col items-center justify-center p-6 text-center">
      {/* Floating Rooms Sidebar */}
      <div className="absolute left-6 top-6 bottom-6 z-10 text-left">
        <Rooms ref={roomsRef} onShareScreen={onStartSharing || onShareScreen} />
      </div>

      <div className="bg-white/90 backdrop-blur-md p-10 rounded-2xl shadow-xl border border-blue-100 max-w-lg w-full flex flex-col items-center space-y-6">
        <div className="flex items-center justify-center shadow-inner">
          <img src={logo} alt="Logo" className="h-24" />
        </div>
        <div>
          <p className="text-sm text-blue-500">
            Broadcast your screen, Local and Offline.
          </p>
        </div>
        <button
          type="button"
          onClick={handleShareClick}
          className="w-full bg-blue-400 hover:bg-blue-500 text-white font-medium py-3 px-6 rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition active:scale-95"
        >
          <Radio className="w-5 h-5 animate-pulse" />
          <span>Share Screen</span>
        </button>
      </div>
    </main>
  );
}
