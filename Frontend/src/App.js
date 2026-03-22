import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import ApiToastListener from './components/ApiToastListener';
import { PrivateRoute } from './components/PrivateRoute';
import { ClientGuard } from './components/ClientGuard';
import DashboardLayout from './layouts/DashboardLayout';
import Marketplace from './pages/Marketplace';
import MyVMs from './pages/MyVMs';
import VMDetail from './pages/VMDetail';
import CreateVM from './pages/CreateVM';
import AdminDashboard from './pages/AdminDashboard';
import ClientDashboard from './pages/ClientDashboard';
import ForgotPassword from './pages/ForgotPassword';
import BillingPage from './pages/BillingPage';
import SettingsPage from './pages/SettingsPage';
import AdminVmTemplates from './pages/admin/AdminVmTemplates';
import AdminScaleUpRule from './pages/admin/AdminScaleUpRule';
import AdminUsers from './pages/admin/AdminUsers';
import AdminVMs from './pages/admin/AdminVMs';
import AuthLayout from './pages/Auth/AuthLayout';
import SignIn from './pages/Auth/SignIn';
import SignUp from './pages/Auth/SignUp';

function RedirectByRole() {
  const { user, token, loading } = useAuth();
  if (loading) {
    return (
      <div className="loading" style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
        <p style={{ marginLeft: '1rem' }}>Chargement...</p>
      </div>
    );
  }
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={user.role === 'admin' ? '/admin' : '/client'} replace />;
}

function AuthRedirect({ children }) {
  const { user, token, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="loading" style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }
  if (token && user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/client'} replace state={{ from: location }} />;
  }
  return children;
}

function AppContent() {
  const location = useLocation();
  const isAuthRoute = ['/login', '/register', '/forgot-password'].includes(location.pathname);
  const isAppRoute = location.pathname.startsWith('/client') || location.pathname.startsWith('/admin');

  return (
    <>
      <main className={isAppRoute ? 'main-content-dashboard' : 'main-content'} style={isAuthRoute ? { padding: 0, maxWidth: 'none' } : {}}>
        <Routes>
          <Route path="/" element={<RedirectByRole />} />

          <Route path="/login" element={
            <AuthRedirect>
              <AuthLayout><SignIn /></AuthLayout>
            </AuthRedirect>
          } />
          <Route path="/register" element={
            <AuthRedirect>
              <AuthLayout><SignUp /></AuthLayout>
            </AuthRedirect>
          } />
          <Route path="/forgot-password" element={
            <AuthLayout><ForgotPassword /></AuthLayout>
          } />

          <Route path="/client" element={
            <PrivateRoute>
              <ClientGuard>
                <DashboardLayout type="client" />
              </ClientGuard>
            </PrivateRoute>
          }>
            <Route index element={<ClientDashboard />} />
            <Route path="vms" element={<MyVMs />} />
            <Route path="vms/:id" element={<VMDetail />} />
            <Route path="marketplace" element={<Marketplace />} />
            <Route path="create" element={<CreateVM />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="billing" element={<BillingPage />} />
          </Route>

          <Route path="/admin" element={
            <PrivateRoute requireAdmin>
              <DashboardLayout type="admin" />
            </PrivateRoute>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="vms" element={<AdminVMs />} />
            <Route path="vms/:id" element={<VMDetail />} />
            <Route path="create" element={<CreateVM />} />
            <Route path="vm-templates" element={<AdminVmTemplates />} />
            <Route path="scale-up-rule" element={<AdminScaleUpRule />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isAuthRoute && isAppRoute && (
        <footer className="footer" style={{ marginTop: 'auto' }}>
          <p>© {new Date().getFullYear()} VM Marketplace – Propulsé par OpenStack</p>
        </footer>
      )}
    </>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster 
          position="top-right" 
          toastOptions={{ 
            duration: 5000,
            style: {
              borderRadius: 'var(--radius-lg)',
              backdropFilter: 'blur(12px) saturate(180%)',
              WebkitBackdropFilter: 'blur(12px) saturate(180%)',
              background: 'rgba(255, 255, 255, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
              padding: '12px 16px',
              fontSize: '0.875rem',
              fontWeight: 500
            },
            className: 'liquid-glass-toast'
          }} 
        />
        <ApiToastListener />
        <div className="App">
          <AppContent />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
