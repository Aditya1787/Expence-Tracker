import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import DashboardLayout from './layouts/DashboardLayout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import GroupsPage from './pages/GroupsPage';
import CreateGroup from './pages/CreateGroup';
import GroupDetails from './pages/GroupDetails';
import ImportCSV from './pages/ImportCSV';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';
import Spinner from './components/common/Spinner';

// Route guards
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Spinner size="large" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Spinner size="large" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// NotFound Page
const NotFound = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
    <h2 className="text-4xl font-extrabold text-primary-600 mb-2">404</h2>
    <h3 className="text-xl font-bold mb-4">Page Not Found</h3>
    <p className="text-sm text-gray-500 max-w-sm mb-6">
      The ledger room or transaction page you are looking for does not exist or has been archived.
    </p>
    <Link to="/" className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm transition-colors">
      Return Dashboard
    </Link>
  </div>
);

// We need Link inside NotFound, let's make sure to import Link
import { Link } from 'react-router-dom';

function App() {
  return (
    <Router>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <Routes>
              {/* Public Authentications */}
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

              {/* Private Dashboards */}
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/groups" element={<ProtectedRoute><GroupsPage /></ProtectedRoute>} />
              <Route path="/groups/create" element={<ProtectedRoute><CreateGroup /></ProtectedRoute>} />
              <Route path="/groups/:id" element={<ProtectedRoute><GroupDetails /></ProtectedRoute>} />
              <Route path="/import" element={<ProtectedRoute><ImportCSV /></ProtectedRoute>} />
              <Route path="/audit" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

              {/* 404 Wildcard */}
              <Route path="*" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
