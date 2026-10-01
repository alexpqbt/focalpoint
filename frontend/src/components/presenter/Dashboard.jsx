import React from 'react';
import Sidebar from './Sidebar';
import BroadcastScreen from './BroadcastScreen';

export default function Dashboard({ 
  onEndSession = () => {},
  onOpenModal = () => {}, 
  viewers = [], 
  messages = [] 
}) {
  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar 
        onEndSession={onEndSession}
        onOpenModal={onOpenModal} 
        viewers={viewers} 
        messages={messages} 
      />
      <BroadcastScreen />
    </div>
  );
}
