import React, { useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Dashboard from './components/Dashboard';
import QrModal from './components/modals/QrModal';
import ViewersModal from './components/modals/ViewersModal';
import ChatModal from './components/modals/ChatModal';

export default function App() {
  const [activeModal, setActiveModal] = useState(null); // 'qr' | 'viewers' | 'chat' | null

  // Viewers list state
  const [viewers, setViewers] = useState([
    "Anakin", 
    "Alex", 
    "Erika", 
    "Tristan", 
    "Alice Johnson", 
    "Brian Carter", 
    "Clara Nguyen", 
    "Elena Petrova"
  ]);

  // Chat messages state
  const [messages, setMessages] = useState([
    { name: "Anakin", text: "Supercalifragilisticexpialidocious" },
    { name: "Alex", text: "Supercalifragilisticexpialidocious" },
    { name: "Erika", text: "lorem ipsum dolor sit amet consectetur" },
    { name: "Tristan", text: "lorem ipsum dolor sit amet consectetur" },
  ]);

  const handleRemoveViewer = (nameToRemove) => {
    setViewers((prev) => prev.filter((v) => v !== nameToRemove));
  };

  const handleSendMessage = (text) => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { name: "Host", text }]);
  };

  return (
    <div className="min-h-screen bg-slate-50 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:24px_24px] flex flex-col justify-between text-red-700 font-sans select-none">
      <Header />
      
      {/* Active Screen View */}
      <Dashboard 
        onOpenModal={setActiveModal}
        viewers={viewers}
        onRemoveViewer={handleRemoveViewer}
        messages={messages}
      />
      
      <Footer />

      {/* Modals */}
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
          onSendMessage={handleSendMessage}
          onClose={() => setActiveModal(null)} 
        />
      )}
    </div>
  );
}
