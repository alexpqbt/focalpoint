import React, { useState } from 'react';
import Header from '../common/Header';
import Footer from '../common/Footer';
import SplashScreen from './SplashScreen';
import Dashboard from './Dashboard';
import EndedScreen from './EndedScreen';
import QrModal from './modals/QrModal';
import ViewersModal from './modals/ViewersModal';
import ChatModal from './modals/ChatModal';

export default function PresenterApp() {
  const [screen, setScreen] = useState('splash'); // 'splash' | 'dashboard' | 'ended'
  const [activeModal, setActiveModal] = useState(null); // 'qr' | 'viewers' | 'chat' | null

  const [viewers, setViewers] = useState([
    "Anakin", "Alex", "Erika", "Tristan",
    "Alice Johnson", "Brian Carter", "Clara Nguyen", "Elena Petrova"
  ]);

  const [messages] = useState([
    { name: "Anakin", text: "Supercalifragilisticexpialidocious" },
    { name: "Alex", text: "Supercalifragilisticexpialidocious" },
    { name: "Erika", text: "lorem ipsum dolor sit amet consectetur" },
    { name: "Tristan", text: "lorem ipsum dolor sit amet consectetur" },
  ]);

  const handleRemoveViewer = (nameToRemove) => {
    setViewers((prev) => prev.filter((v) => v !== nameToRemove));
  };

  return (
    <div className="min-h-screen bg-slate-50 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:24px_24px] flex flex-col justify-between text-red-700 font-sans select-none">
      <Header currentScreen={screen} />

      {screen === 'splash' && (
        <SplashScreen onShareScreen={() => setScreen('dashboard')} />
      )}

      {screen === 'dashboard' && (
        <Dashboard 
          onEndSession={() => setScreen('ended')}
          onOpenModal={setActiveModal}
          viewers={viewers}
          messages={messages}
        />
      )}

      {screen === 'ended' && (
        <EndedScreen onStartNewSession={() => setScreen('dashboard')} />
      )}

      <Footer />

      {activeModal === 'qr' && (
        <QrModal onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'viewers' && (
        <ViewersModal 
          viewers={viewers}
          onRemoveViewer={handleRemoveViewer}
          onClose={() => setActiveModal(null)} 
        />
      )}

      {activeModal === 'chat' && (
        <ChatModal 
          messages={messages}
          onClose={() => setActiveModal(null)} 
        />
      )}
    </div>
  );
}
