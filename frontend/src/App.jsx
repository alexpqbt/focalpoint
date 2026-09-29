import React from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Dashboard from './components/Dashboard';
// import SplashScreen from './components/SplashScreen';
// import QrModal from './components/modals/QrModal';
// import ViewersModal from './components/modals/ViewersModal';
// import ChatModal from './components/modals/ChatModal';

export default function App() {
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
