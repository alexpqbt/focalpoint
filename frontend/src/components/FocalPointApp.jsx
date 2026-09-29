import React from 'react';
import Header from './Header';
import Footer from './Footer';
import Dashboard from './Dashboard';
// import SplashScreen from './SplashScreen';
// import QrModal from './modals/QrModal';
// import ViewersModal from './modals/ViewersModal';
// import ChatModal from './modals/ChatModal';

export default function FocalPointApp() {
  return (
    <div className="min-h-screen bg-slate-50 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:24px_24px] flex flex-col justify-between text-red-700 font-sans select-none">
      <Header />
      
      {/* Active Screen View (e.g., Dashboard or SplashScreen) */}
      <Dashboard />
      
      <Footer />

      {/* Modals can be rendered here when activated */}
    </div>
  );
}
