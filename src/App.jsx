import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout.jsx';
import { LoadingSpinner } from './components/UI.jsx';
import { useAuth } from './context/AuthContext.jsx';

const Landing = lazy(() => import('./pages/Landing.jsx'));
const AuthPage = lazy(() => import('./pages/AuthPage.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Tracking = lazy(() => import('./pages/Tracking.jsx'));
const SosPage = lazy(() => import('./pages/SosPage.jsx'));
const Contacts = lazy(() => import('./pages/Contacts.jsx'));
const Assistant = lazy(() => import('./pages/Assistant.jsx'));
const StressMeter = lazy(() => import('./pages/StressMeter.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));
const Vehicles = lazy(() => import('./pages/Vehicles.jsx'));
const History = lazy(() => import('./pages/History.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));

function ProtectedLayout() {
  const { user, checking, backendAvailable } = useAuth();
  if (checking) return <div className="route-loading"><LoadingSpinner label="Checking your session..." /></div>;
  if (backendAvailable && !user) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

export default function App() {
  return (
    <Suspense fallback={<div className="route-loading"><LoadingSpinner label="Loading AlertX..." /></div>}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage register />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tracking" element={<Tracking />} />
          <Route path="/sos" element={<SosPage />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/stress-meter" element={<StressMeter />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
