import React from 'react';

export default function ViewerFeed({ videoRef }) {
  return (
    <div className="w-full max-w-5xl aspect-video bg-black rounded-lg shadow-2xl overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-contain bg-black"
      />
    </div>
  );
}