import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import RoomPage from './pages/RoomPage';
import PostLectureHub from './pages/PostLectureHub';

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
      <Route path="/room/:roomId" element={
          <ProtectedRoute>
            <RoomPage />
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
  );
}
