import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PresenterApp from './components/presenter/PresenterApp';
import ViewerApp from './components/viewer/ViewerApp';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Presenter Route */}
        <Route path="/" element={<PresenterApp />} />

        {/* Viewer Route */}
        <Route path="/view" element={<ViewerApp />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
