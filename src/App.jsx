import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DialogProvider } from './context/DialogContext';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import MobileHeader from './components/MobileHeader';
import NetworkBanner from './components/NetworkBanner';
import TodayView from './pages/TodayView';
import DashboardView from './pages/DashboardView';
import ActionRequiredView from './pages/ActionRequiredView';
import HistoryView from './pages/HistoryView';
import SettingsView from './pages/SettingsView';
import StudentsView from './pages/StudentsView';
import RegisterView from './pages/RegisterView';
import LoginView from './pages/LoginView';
import { initSyncEngine } from './lib/syncEngine';

// Initialize the offline sync engine once at module level
initSyncEngine();

// Protected Route Wrapper using Auth Context
function ProtectedRoute({ children, adminOnly = false }) {
  const { session, isAdmin, loading } = useAuth();
  
  if (loading) return (
    <div className="page-container flex items-center justify-center min-h-screen">
      <div className="text-muted animate-pulse" style={{ textAlign: 'center' }}>Authenticating Secure Portal...</div>
    </div>
  );

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Wrapper component to handle layout based on route
function Layout() {
  const location = useLocation();
  const { session, loading } = useAuth();
  const isPublicRoute = location.pathname === '/register' || location.pathname === '/login';

  // Show loading only for protected routes
  if (loading && !isPublicRoute) {
    return (
      <div className="page-container flex items-center justify-center min-h-screen">
        <div className="text-muted animate-pulse" style={{ textAlign: 'center' }}>Loading...</div>
      </div>
    );
  }

  // Public routes render without sidebar/nav
  if (isPublicRoute) {
    return (
      <main className="w-full h-full">
        <Routes>
          <Route path="/register" element={<RegisterView />} />
          <Route path="/login" element={<LoginView />} />
        </Routes>
      </main>
    );
  }

  return (
    <div className="app-layout">
      {session && <NetworkBanner />}
      {session && <Sidebar />}
      {session && <MobileHeader />}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<ProtectedRoute><DashboardView /></ProtectedRoute>} />
          <Route path="/attendance" element={<ProtectedRoute><TodayView /></ProtectedRoute>} />
          
          {/* Admin-Only Routes */}
          <Route path="/action" element={<ProtectedRoute adminOnly><ActionRequiredView /></ProtectedRoute>} />
          <Route path="/students" element={<ProtectedRoute adminOnly><StudentsView /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute adminOnly><HistoryView /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute adminOnly><SettingsView /></ProtectedRoute>} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {session && <BottomNav />}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <DialogProvider>
          <Layout />
        </DialogProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
