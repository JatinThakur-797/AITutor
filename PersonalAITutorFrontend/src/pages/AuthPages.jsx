import {
  ArrowRight,
  Code,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  Mail,
  Sparkles
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { getErrorMessage } from '../api/client';
import { Alert, Button, Field } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

function AuthFrame({ mode, children }) {
  const { theme, toggleTheme } = useTheme();
  return <div className="auth-page">
    <div className="auth-theme"><button className="icon-btn" onClick={toggleTheme} title="Toggle theme">{theme === 'dark' ? '☼' : '☾'}</button></div>
    <section className="auth-art">
      <div className="auth-art-grid" />
      <Link to="/login" className="auth-brand"><span className="brand-mark"><GraduationCap size={20} /></span>path<span>ai</span></Link>
      <div className="auth-art-content">
        <div className="auth-orbit"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-core"><Sparkles size={34} /></div><span className="orbit-dot dot-one" /><span className="orbit-dot dot-two" /><span className="orbit-dot dot-three" /></div>
        <div className="auth-art-copy"><div className="eyebrow">YOUR PERSONAL LEARNING SPACE</div><h1>Turn curiosity<br />into <em>capability.</em></h1><p>Build a clear learning path, learn one concept at a time, and get unstuck with an AI mentor that understands your lesson.</p></div>
        <div className="auth-proof"><div className="proof-avatars"><span>J</span><span>A</span><span>M</span><span>+</span></div><div><strong>Learn at your own pace</strong><small>One focused session at a time.</small></div></div>
      </div>
      <div className="auth-art-footer"><span>PathAI Learning Workspace</span><span>Built for curious minds</span></div>
    </section>
    <section className="auth-form-side"><div className="auth-form-wrap">{children}</div><div className="auth-mobile-footer">PathAI · Learn with direction</div></section>
  </div>;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const update = (key) => (event) => setForm((old) => ({ ...old, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setError(''); setLoading(true);
    try { await login(form); navigate(location.state?.from?.pathname || '/', { replace: true }); }
    catch (err) { setError(getErrorMessage(err, 'Unable to sign in. Check your credentials.')); }
    finally { setLoading(false); }
  };

  return <AuthFrame>
    <div className="auth-mobile-brand"><span className="brand-mark"><GraduationCap size={19} /></span>path<span>ai</span></div>
    <div className="auth-kicker"><span className="tiny-spark"><Sparkles size={13} /></span> Welcome back</div>
    <h2>Sign in to your workspace</h2><p className="auth-subtitle">Pick up where you left off. Your next breakthrough is one session away.</p>
    {error ? <Alert type="error">{error}</Alert> : null}
    <form className="auth-form" onSubmit={submit}>
      <Field label="Email address"><div className="input-icon-wrap"><Mail size={17} /><input type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={update('email')} required /></div></Field>
      <Field label="Password"><div className="input-icon-wrap"><LockKeyhole size={17} /><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={form.password} onChange={update('password')} required /><button type="button" className="input-trailing" onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></Field>
      <Button type="submit" className="auth-submit" loading={loading}>Sign in <ArrowRight size={17} /></Button>
    </form>
    <div className="auth-divider"><span />or continue with<span /></div>
    <div className="oauth-row"><a href={authApi.oauthUrl('google')} className="oauth-button"><GoogleMark />Google</a><a href={authApi.oauthUrl('github')} className="oauth-button"><Code size={17} />GitHub</a></div>
    <p className="auth-switch">New to PathAI? <Link to="/register">Create an account <ArrowRight size={14} /></Link></p>
    <p className="auth-legal">By continuing, you agree to use PathAI responsibly and keep your account credentials private.</p>
  </AuthFrame>;
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const update = (key) => (event) => setForm((old) => ({ ...old, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setError(''); setLoading(true);
    try { await register(form); navigate('/', { replace: true }); }
    catch (err) { setError(getErrorMessage(err, 'Unable to create your account.')); }
    finally { setLoading(false); }
  };
  return (
    <AuthFrame>
      <div className="auth-mobile-brand">
        <span className="brand-mark">
          <GraduationCap size={19} />
        </span>
        path<span>ai</span>
      </div>
      <div className="auth-kicker">
        <span className="tiny-spark">
          <Sparkles size={13} />
        </span>{" "}
        Start learning intentionally
      </div>
      <h2>Create your account</h2>
      <p className="auth-subtitle">
        Set up your personal learning workspace in less than a minute.
      </p>
      {error ? <Alert type="error">{error}</Alert> : null}
      <form className="auth-form" onSubmit={submit}>
        <Field label="Full name">
          <input
            className="input"
            autoComplete="name"
            placeholder="Your name"
            value={form.name}
            onChange={update("name")}
            required
          />
        </Field>
        <Field label="Email address">
          <div className="input-icon-wrap">
            <Mail size={17} />
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={update("email")}
              required
            />
          </div>
        </Field>
        <Field
          label="Password"
          hint="Use at least 8 characters for a stronger password."
        >
          <div className="input-icon-wrap">
            <LockKeyhole size={17} />
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Create a password"
              value={form.password}
              onChange={update("password")}
              minLength={8}
              required
            />
            <button
              type="button"
              className="input-trailing"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </Field>
        <Button type="submit" className="auth-submit" loading={loading}>
          Create account <ArrowRight size={17} />
        </Button>
      </form>
      <div className="auth-divider">
        <span />
        or sign up with
        <span />
      </div>
      <div className="oauth-row">
        <a href={authApi.oauthUrl("google")} className="oauth-button">
          <GoogleMark />
          Google
        </a>
        <a href={authApi.oauthUrl("github")} className="oauth-button">
          <Code size={17} />
          GitHub
        </a>
      </div>
      <p className="auth-switch">
        Already have an account?{" "}
        <Link to="/login">
          Sign in <ArrowRight size={14} />
        </Link>
      </p>
      <p className="auth-legal">
        Your learning goals and progress belong to your account.
      </p>
    </AuthFrame>
  );
}

export function OAuthSuccessPage() {
  const { setUser, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const email = params.get('email');
    const name = params.get('name');
    if (!token) { setError('The sign-in link did not contain an access token.'); return; }
    localStorage.setItem('pathai_access_token', token);
    window.history.replaceState({}, document.title, '/auth/success');
    setUser({ email: email || '', name: name || 'Learner' });
    refreshProfile().catch(() => { }).finally(() => navigate('/', { replace: true }));
  }, [navigate, refreshProfile, setUser]);
  return <div className="oauth-success"><div className="brand-mark"><GraduationCap size={22} /></div><h2>Finishing sign in</h2><p>{error || 'Connecting your PathAI workspace…'}</p>{error ? <Link to="/login" className="text-link">Return to sign in</Link> : null}</div>;
}

function GoogleMark() { return <span className="google-mark">G</span>; }
