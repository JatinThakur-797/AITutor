import { useNavigate } from 'react-router-dom';
import { ArrowRight, LogOut, Mail, Moon, ShieldCheck, Sun, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button, Card, PageHeading } from '../components/UI';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const signOut = async () => { await logout(); navigate('/login', { replace: true }); };
  return <>
    <PageHeading eyebrow="ACCOUNT SETTINGS" title="Your account." description="Manage your PathAI profile and workspace preferences." />
    <div className="profile-layout"><Card className="profile-card"><div className="profile-card-banner" /><div className="profile-avatar-large">{(user?.name || user?.email || 'L').slice(0, 1).toUpperCase()}</div><h2>{user?.name || 'Learner'}</h2><p>{user?.email || 'No email available'}</p><span className="profile-status"><i /> Account connected</span></Card>
      <div className="profile-settings"><Card><div className="settings-title"><div className="settings-icon"><UserRound size={18} /></div><div><h3>Personal information</h3><p>Your account details from User-Service.</p></div></div><div className="setting-row"><div><span>Name</span><strong>{user?.name || '—'}</strong></div></div><div className="setting-row"><div><span>Email</span><strong>{user?.email || '—'}</strong></div><Mail size={17} className="muted-icon" /></div></Card>
        <Card><div className="settings-title"><div className="settings-icon"><Sun size={18} /></div><div><h3>Appearance</h3><p>Choose a comfortable reading experience.</p></div></div><div className="appearance-switch"><div><strong>{theme === 'dark' ? 'Dark theme' : 'Light theme'}</strong><span>Your preference is saved in this browser.</span></div><Button variant="secondary" size="sm" onClick={toggleTheme}>{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />} Switch theme</Button></div></Card>
        <Card><div className="settings-title"><div className="settings-icon"><ShieldCheck size={18} /></div><div><h3>Session & security</h3><p>Your session uses an access token and an HttpOnly refresh cookie managed by the backend.</p></div></div><Button variant="danger" onClick={signOut}><LogOut size={16} /> Sign out of PathAI</Button></Card>
      </div>
    </div>
  </>;
}
