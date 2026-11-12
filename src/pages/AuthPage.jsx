import { useState } from 'react';
import { Activity, ArrowLeft, ArrowRight, Check, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiError } from '../services/api.js';

export default function AuthPage({ register = false }) {
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { login, register: createAccount, backendAvailable } = useAuth();

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const credentials = {
      email: String(form.get('email')).trim(),
      password: String(form.get('password')),
    };
    try {
      if (register) {
        await createAccount({
          ...credentials,
          name: String(form.get('name')).trim(),
        });
      } else {
        await login(credentials);
      }
      navigate('/dashboard');
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="auth-page"><div className="auth-decoration"><div className="auth-grid" /><div className="auth-brand"><Activity size={23} /> AlertX</div><div className="auth-quote"><span className="eyebrow">A BETTER WAY TO RESPOND</span><h2>Preparedness<br />starts with<br /><em>connection.</em></h2><p>One clear picture. Better coordination. A more confident response.</p><div className="auth-quote-foot"><ShieldCheck size={17} /> Simulation environment · No real emergency service connection</div></div><div className="auth-coordinate">28° 40' 19.2" N &nbsp; 77° 27' 13.7" E</div></div>
    <div className="auth-form-side"><Link className="auth-back" to="/"><ArrowLeft size={16} /> Back to home</Link><form className="auth-form" onSubmit={submit}><span className="eyebrow">{register ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'}</span><h1>{register ? 'Join the network.' : 'Good to see you.'}</h1><p className="muted">{register ? 'Create an AlertX account to access your response workspace.' : 'Sign in to continue to your response workspace.'}</p>{register && <label>Full name<input name="name" required autoComplete="name" placeholder="Your name" /></label>}<label>Email address<input name="email" required type="email" autoComplete="email" placeholder="you@example.com" /></label><label>Password<span className="password-field"><input name="password" required type={showPassword ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} minLength="8" placeholder="At least 8 characters" /><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>{register && <label className="check-label"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} required /><span>I understand this workspace does not contact real emergency services.</span></label>}{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary full auth-submit" type="submit" disabled={submitting}>{register ? 'Create account' : 'Sign in to AlertX'} <ArrowRight size={16} /></button><div className="auth-divider"><span />or<span /></div><p className="auth-switch">{register ? 'Already have a workspace?' : 'New to AlertX?'} <Link to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</Link></p><div className="auth-demo-note"><Check size={14} /> {backendAvailable ? 'Credentials are sent only to the configured AlertX API.' : 'Backend unavailable. Local profile data is stored in this browser.'}</div></form></div></div>;
}
