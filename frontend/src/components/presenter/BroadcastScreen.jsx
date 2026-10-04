import React from 'react';

export default function BroadcastScreen({ previewRef }) {
  return (
    <main className="flex-1 p-8 flex items-center justify-center">
      <div className="bg-black rounded-lg shadow-2xl overflow-hidden w-full max-w-5xl aspect-video border border-red-900 flex items-center justify-center text-white relative">
        <video
          ref={previewRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-contain bg-black"
        />
      </div>
    </main>
  );
}