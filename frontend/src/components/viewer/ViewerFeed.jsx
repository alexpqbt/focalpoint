import React from 'react';

export default function ViewerFeed({ videoRef }) {
  return (
    <div className="w-full h-full flex items-center justify-center relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl bg-black"
      />
    </div>
  );
}