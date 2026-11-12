import { Activity, Ambulance, Bot, ClipboardList, LayoutDashboard, MapPinned, PanelLeftClose, PanelLeftOpen, Settings, Shield, Siren, Users, Waves, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export const navigationGroups = [
  { section: 'WORKSPACE', items: [
    { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { to: '/tracking', label: 'Live tracking', icon: MapPinned, live: true },
    { to: '/sos', label: 'Emergency SOS', icon: Siren },
    { to: '/contacts', label: 'Trusted contacts', icon: Users },
  ] },
  { section: 'TOOLS', items: [
    { to: '/assistant', label: 'AI assistant', icon: Bot, beta: true },
    { to: '/stress-meter', label: 'Stress meter', icon: Waves },
  ] },
  { section: 'MANAGEMENT', items: [
    { to: '/admin', label: 'Admin dashboard', icon: Shield },
    { to: '/vehicles', label: 'Vehicle management', icon: Ambulance },
    { to: '/history', label: 'Emergency history', icon: ClipboardList },
  ] },
];

export default function Sidebar({ menuOpen, collapsed, onClose, onToggleCollapsed, currentPath }) {
  const { user } = useAuth();
  const displayName = user?.name || 'Guest session';
  const initials = displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return <>
    {menuOpen && <button className="sidebar-backdrop" onClick={onClose} aria-label="Close navigation" />}
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''} ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="brand-lockup"><div className="brand-mark"><Activity size={21} /></div><div><strong>AlertX</strong><small>RESPONSE NETWORK</small></div><button className="icon-button sidebar-collapse-toggle" onClick={onToggleCollapsed} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} title={collapsed ? 'Expand navigation' : 'Collapse navigation'}>{collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</button><button className="icon-button mobile-close" onClick={onClose} aria-label="Close menu"><X size={17} /></button></div>
      <div className="workspace-switch" title="Ghaziabad response region"><span className="workspace-avatar">G</span><span><strong>Ghaziabad Region</strong><small>Simulated coverage area</small></span></div>
      <nav className="sidebar-nav">{navigationGroups.map((group) => <div className="nav-group" key={group.section}><span className="nav-section">{group.section}</span>{group.items.map(({ to, label, icon: Icon, live, beta }) => <NavLink key={to} to={to} onClick={onClose} title={collapsed ? label : undefined} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={17} /><span>{label}</span>{live && <i className="nav-live" />}{beta && <small className="beta-tag">BETA</small>}</NavLink>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="operator-card" title={user?.email || 'Not signed in'}><div className="operator-avatar">{initials}</div><div><strong>{displayName}</strong><small>{user?.role || 'Not signed in'}</small></div>{user && <span className="online-indicator" />}</div><NavLink to="/settings" onClick={onClose} title={collapsed ? 'Profile & settings' : undefined} className={({ isActive }) => `nav-link settings-link ${currentPath === '/settings' ? 'active' : ''}`}><Settings size={17} /><span>Profile & settings</span></NavLink></div>
    </aside>
  </>;
}
