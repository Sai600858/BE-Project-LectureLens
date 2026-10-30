import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import RoomPage from './pages/RoomPage';
import PostLectureHub from './pages/PostLectureHub';
import FloatingDock from './components/FloatingDock';
const VisualizationLab = React.lazy(() => import('./pages/VisualizationLab'));

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('lecturelens_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lab"
          element={
            <ProtectedRoute>
              <React.Suspense
                fallback={
                  <div style={{ minHeight: '100vh', background: '#0b0f19', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', fontFamily: 'sans-serif' }}>
                    Loading 3D Educational Lab...
                  </div>
                }
              >
                <VisualizationLab />
              </React.Suspense>
            </ProtectedRoute>
          }
        />
        <Route path="/visualize" element={<Navigate to="/lab" replace />} />
        <Route path="/room/:roomId" element={
            <ProtectedRoute>
              <RoomPage />
            </ProtectedRoute>
          } />
        <Route path="/lecture/:lectureId" element={
            <ProtectedRoute>
              <PostLectureHub />
            </ProtectedRoute>
          } />
        <Route path="/lecture/:lectureId/review" element={
            <ProtectedRoute>
              <PostLectureHub />
            </ProtectedRoute>
          } />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <FloatingDock />
    </>
  );
}
