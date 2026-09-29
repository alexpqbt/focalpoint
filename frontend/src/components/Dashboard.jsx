import React from 'react';
import Sidebar from './Sidebar';
import BroadcastScreen from './BroadcastScreen';

export default function Dashboard({ 
  onOpenModal, 
  viewers = [], 
  onRemoveViewer, 
  messages = [] 
}) {
  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar 
        onOpenModal={onOpenModal} 
        viewers={viewers} 
        onRemoveViewer={onRemoveViewer} 
        messages={messages} 
      />
      <BroadcastScreen />
    </div>
  );
}
