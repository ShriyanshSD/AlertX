import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Bot } from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import Sidebar, { navigationGroups } from '../components/Sidebar.jsx';
import { readStored, writeStored } from '../services/storage.js';

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readStored('resq-sidebar-collapsed', false));
  const location = useLocation();
  const pageName = navigationGroups.flatMap((group) => group.items).find((item) => item.to === location.pathname)?.label || 'Settings';
  return <div className="app-shell min-h-screen">
    <Sidebar menuOpen={menuOpen} collapsed={sidebarCollapsed} onClose={() => setMenuOpen(false)} onToggleCollapsed={() => setSidebarCollapsed((current) => { const next = !current; writeStored('resq-sidebar-collapsed', next); return next; })} currentPath={location.pathname} />
    <div className={`app-main ${sidebarCollapsed ? 'sidebar-collapsed-main' : ''}`}>
      <Navbar pageName={pageName} onMenuOpen={() => setMenuOpen(true)} />
      <main className="page-content"><Outlet /></main>
      {location.pathname !== '/assistant' && <Link className="floating-assistant" to="/assistant" aria-label="Open AlertX AI Assistant" title="AlertX AI Assistant"><Bot size={19} /><span>Ask AlertX AI</span></Link>}
      <footer className="app-footer"><span>AlertX Response Network</span><span>Simulation environment · No real emergency services connected</span></footer>
    </div>
  </div>;
}
