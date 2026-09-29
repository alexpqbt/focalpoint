import React from 'react';
import Sidebar from './Sidebar';
import BroadcastScreen from './BroadcastScreen';

export default function Dashboard() {
  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar />
      <BroadcastScreen />
    </div>
  );
}
