import React from 'react';

export default function ViewerFeed({ videoRef }) {
  return (
    <div className="w-full h-full flex items-center justify-center relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-contain rounded-lg"
      />
    </div>
  );
}