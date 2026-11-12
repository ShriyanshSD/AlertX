import { useEffect, useRef, useState } from 'react';
import { Activity, ChevronDown, LifeBuoy, LogOut, Settings, ShieldCheck, UserRound, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { MobileMenuButton, NotificationPanel } from './UI.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useNotifications from '../hooks/useNotifications.js';

export default function Navbar({ pageName, onMenuOpen }) {
  const { user, checking, backendAvailable, logout } = useAuth();
  const navigate = useNavigate();
  const { items: notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountError, setAccountError] = useState('');
  const accountRef = useRef(null);
  const displayName = user?.name || 'Guest session';
  const initials = displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!accountRef.current?.contains(event.target)) setAccountOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setAccountOpen(false);
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const signOut = async () => {
    if (!window.confirm('Sign out of your AlertX account?')) return;
    setAccountError('');
    try {
      await logout();
      setAccountOpen(false);
      navigate('/login', { replace: true });
    } catch (error) {
      setAccountError(error.response?.data?.error?.message || 'Unable to sign out. Please try again.');
    }
  };

  const statusLabel = checking ? 'Checking connection' : backendAvailable ? 'API connected' : 'Local session';
  const statusClass = checking ? 'checking' : backendAvailable ? 'connected' : 'local';
  const menuLinks = [
    { to: '/settings#profile', label: 'My profile', icon: UserRound },
    { to: '/settings#profile', label: 'Edit profile', icon: UserRound },
    { to: '/settings#preferences', label: 'Account settings', icon: Settings },
    { to: '/settings#security', label: 'Security & password', icon: ShieldCheck },
    { to: '/settings#preferences', label: 'Notification preferences', icon: Activity },
    { to: '/assistant', label: 'Help & support', icon: LifeBuoy },
  ];

  return <header className="topbar"><div className="topbar-left"><MobileMenuButton onClick={onMenuOpen} /><div className="breadcrumb"><span>AlertX</span><b>/</b><strong>{pageName}</strong></div></div><div className="topbar-right"><span className={`system-status ${statusClass}`}><i /> {statusLabel}</span><div className="notification-anchor"><button className="icon-button notification-bell" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} title="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(!notificationsOpen)}><Activity size={17} />{unreadCount > 0 && <i />}</button>{notificationsOpen && <div className="notification-popover"><div className="notification-popover-heading"><strong>Notifications {unreadCount > 0 && <small>· {unreadCount} unread</small>}</strong><div>{unreadCount > 0 && <button className="notification-mark-all" onClick={markAllRead}>Mark all read</button>}<button className="icon-button" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications"><X size={15} /></button></div></div><NotificationPanel notifications={notifications} onRead={markRead} /><Link className="panel-link" to="/history" onClick={() => setNotificationsOpen(false)}>View activity log</Link></div>}</div><div className="account-anchor" ref={accountRef}><button className="topbar-user" aria-haspopup="menu" aria-expanded={accountOpen} onClick={() => setAccountOpen((open) => !open)}><div className="operator-avatar small-avatar">{initials}</div><span>{displayName}</span><ChevronDown size={14} /></button>{accountOpen && <div className="account-menu" role="menu"><div className="account-menu-heading"><div className="operator-avatar">{initials}</div><span><strong>{displayName}</strong><small>{user ? `${user.role} · ${user.email}` : 'Browse in local mode'}</small></span></div>{accountError && <p className="form-error" role="alert">{accountError}</p>}{menuLinks.map(({ to, label, icon: Icon }) => <Link key={label} role="menuitem" to={to} onClick={() => setAccountOpen(false)}><Icon size={15} />{label}</Link>)}{user && <><div className="account-menu-divider" /><button className="account-signout" role="menuitem" onClick={signOut}><LogOut size={15} />Sign out</button></>}</div>}</div></div></header>;
}
