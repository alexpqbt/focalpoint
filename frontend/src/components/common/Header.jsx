import React from 'react';
import logo from '../../assets/logo1.png';

export default function Header({ currentScreen = 'splash' }) {
  const getStatusText = () => {
    switch (currentScreen) {
      case 'dashboard':
        return 'Mode: Live Session Active';
      case 'splash':
      default:
        return 'Mode: Standby';
    }
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-blue-100 shadow-sm z-20">
      <div className="flex items-center">
        {/* Logo replaces TV icon and FocalPoint text */}
        <img src={logo} alt="Logo" className="h-8" />
      </div>
      <div className="text-xs text-blue-400 font-mono hidden sm:block">
        {getStatusText()}
      </div>
    </header>
  );
}
