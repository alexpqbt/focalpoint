import React from 'react';
import Sidebar from './Sidebar';
import BroadcastScreen from './BroadcastScreen';

export default function Dashboard({
  onEndSession = () => {},
  onOpenModal = () => {},
  viewers = [],
  messages = [],
  previewRef,
  onExport = () => {},
  isSharing = false,
}) {
  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar
        onEndSession={onEndSession}
        onOpenModal={onOpenModal}
        viewers={viewers}
        messages={messages}
        onExport={onExport}
        isSharing={isSharing}
      />
      <BroadcastScreen previewRef={previewRef} />
    </div>
  );
}