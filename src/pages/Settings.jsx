import { useEffect, useState } from 'react';
import { Check, LogOut, Save, ShieldCheck } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FilterTabs, SectionHeading } from '../components/UI.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api, { getApiError } from '../services/api.js';
import { readStored, writeStored } from '../services/storage.js';

const defaultProfile = { name: 'Guest session', email: '', phone: '', role: 'Guest' };
export default function Settings() {
  const { user, logout, updateProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(() => readStored('resq-profile', defaultProfile));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [preferences, setPreferences] = useState(() => readStored('resq-preferences', { notifications: true, location: true }));
  const [activeTab, setActiveTab] = useState('profile');
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordUpdated, setPasswordUpdated] = useState(false);

  useEffect(() => {
    const tab = location.hash.slice(1);
    if (['profile', 'security', 'preferences'].includes(tab)) setActiveTab(tab);
  }, [location.hash]);

  useEffect(() => {
    if (user) setProfile({ name: user.name, email: user.email, phone: user.phone || '', role: user.role });
  }, [user]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setError('');
    try {
      if (user) {
        const updated = await updateProfile({ name: profile.name, phone: profile.phone });
        setProfile({ name: updated.name, email: updated.email, phone: updated.phone || '', role: updated.role });
      } else {
        writeStored('resq-profile', profile);
      }
      writeStored('resq-preferences', preferences);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2400);
    } catch (requestError) {
      setError(getApiError(requestError));
    }
  };

  const savePreference = (key, value) => {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    writeStored('resq-preferences', next);
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setError('');
    setPasswordUpdated(false);
    if (!user) {
      setError('Sign in to change an account password.');
      return;
    }
    if (password.newPassword !== password.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    try {
      await api.patch('/auth/password', {
        currentPassword: password.currentPassword,
        newPassword: password.newPassword,
      });
      setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordUpdated(true);
    } catch (requestError) {
      setError(getApiError(requestError));
    }
  };

  const signOut = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (requestError) {
      setError(getApiError(requestError));
    }
  };

  const settingsTabs = [
    { value: 'profile', label: 'Personal information' },
    { value: 'security', label: 'Security' },
    { value: 'preferences', label: 'Preferences' },
  ];

  return <><SectionHeading eyebrow="ACCOUNT" title="Profile & settings" description="Manage your account details, security, and preferences." />
    {error && <p className="form-error" role="alert">{error}</p>}
    <FilterTabs tabs={settingsTabs} value={activeTab} onChange={setActiveTab} label="Profile and settings sections" />
    <div className="settings-content">
      {activeTab === 'profile' && <form className="panel settings-card" onSubmit={saveProfile} id="profile"><div className="panel-heading"><div><h2>Personal information</h2><p>{user ? 'Changes are saved to your AlertX account.' : 'In local mode, profile preferences are saved in this browser.'}</p></div><div className="profile-large-avatar">{(profile.name || 'Guest').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div></div><div className="settings-fields"><label>Full name<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} required minLength={2} maxLength={100} /></label><label>Email address<input type="email" value={profile.email} readOnly /></label><label>Phone number<input type="tel" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} maxLength={30} /></label><label>Workspace role<input value={profile.role} readOnly /></label></div>{user?.createdAt && <p className="profile-created">Account created {new Date(user.createdAt).toLocaleDateString()}</p>}<div className="settings-save-row"><small>{saved && <><Check size={14} /> Saved successfully</>}</small><button className="button primary" type="submit"><Save size={15} /> Save changes</button></div></form>}
      {activeTab === 'security' && <form className="panel settings-card" onSubmit={changePassword} id="security"><div className="panel-heading"><div><h2>Security & password</h2><p>Verify your current password before choosing a new one.</p></div><ShieldCheck size={19} className="muted" /></div>{user ? <div className="settings-fields security-fields"><label>Current password<input type="password" autoComplete="current-password" minLength={8} maxLength={128} value={password.currentPassword} onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })} required /></label><label>New password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password.newPassword} onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} required /></label><label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password.confirmPassword} onChange={(event) => setPassword({ ...password, confirmPassword: event.target.value })} required /></label><p className="password-hint">Use at least 8 characters. Passwords are never displayed or stored in browser preferences.</p></div> : <p className="muted small">Sign in to change an account password.</p>}<div className="settings-save-row"><small>{passwordUpdated && <><Check size={14} /> Password updated</>}</small><button className="button primary" type="submit" disabled={!user}>Update password</button></div></form>}
      {activeTab === 'preferences' && <><section className="panel settings-card" id="preferences"><div className="panel-heading"><div><h2>Preferences</h2><p>Manage local interface and simulation settings.</p></div></div><label className="preference-row"><span><strong>Notifications</strong><small>Show real-time activity updates while this session is open</small></span><input type="checkbox" checked={preferences.notifications} onChange={(event) => savePreference('notifications', event.target.checked)} /></label><label className="preference-row"><span><strong>Location simulation</strong><small>Allow fictional vehicle locations in local tracking mode</small></span><input type="checkbox" checked={preferences.location} onChange={(event) => savePreference('location', event.target.checked)} /></label></section>
      <section className="panel settings-card" id="about"><div className="panel-heading"><div><h2>About AlertX</h2><p>Emergency coordination and tracking workspace</p></div></div><div className="about-demo-note"><ShieldCheck size={18} /><span><strong>No real emergency services are connected.</strong><small>Vehicle positions and offline requests may be simulated. Contact alerts are in-app records only; no SMS or email providers are configured.</small></span></div>{user ? <button className="button secondary logout-button" type="button" onClick={signOut}><LogOut size={15} /> Sign out</button> : <button className="button secondary logout-button" type="button" onClick={() => navigate('/')}><LogOut size={15} /> Return to landing page</button>}</section></>}
    </div>
  </>;
}
