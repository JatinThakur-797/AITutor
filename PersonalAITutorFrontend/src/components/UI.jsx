import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Check, CircleAlert, LoaderCircle, Sparkles } from 'lucide-react';

export function Button({ children, variant = 'primary', size = 'md', className = '', loading = false, disabled = false, ...props }) {
  return (
    <button className={`btn btn-${variant} btn-${size} ${className}`} disabled={disabled || loading} {...props}>
      {loading ? <LoaderCircle size={16} className="spin" /> : null}
      {children}
    </button>
  );
}

export function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading">
    <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description ? <p>{description}</p> : null}</div>
    {action ? <div className="page-heading-action">{action}</div> : null}
  </div>;
}

export function Card({ children, className = '', ...props }) {
  return <section className={`card ${className}`} {...props}>{children}</section>;
}

export function StatCard({ icon: Icon = Sparkles, label, value, note, tone = 'violet' }) {
  return <div className="stat-card"><div className={`stat-icon tone-${tone}`}><Icon size={19} /></div><div><div className="stat-label">{label}</div><div className="stat-value">{value}</div>{note ? <div className="stat-note">{note}</div> : null}</div></div>;
}

export function EmptyState({ icon: Icon = BookOpen, title, description, action }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={25} /></div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function Alert({ type = 'info', children }) {
  const Icon = type === 'error' ? CircleAlert : Check;
  return <div className={`alert alert-${type}`}><Icon size={17} /> <span>{children}</span></div>;
}

export function ProgressBar({ value = 0 }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return <div className="progress-track"><div className="progress-fill" style={{ width: `${safe}%` }} /></div>;
}

export function SectionTitle({ title, subtitle, to, linkLabel = 'View all' }) {
  return <div className="section-title"><div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>{to ? <Link className="text-link" to={to}>{linkLabel}<ArrowRight size={15} /></Link> : null}</div>;
}

export function Field({ label, hint, error, children }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint ? <span className="field-hint">{hint}</span> : null}{error ? <span className="field-error">{error}</span> : null}</label>;
}

export function LoadingScreen({ label = 'Preparing your workspace' }) {
  return <div className="loading-screen"><div className="loading-mark"><Sparkles size={22} /></div><LoaderCircle className="spin" size={21} /><p>{label}</p></div>;
}

export function Badge({ children, tone = 'neutral' }) { return <span className={`badge badge-${tone}`}>{children}</span>; }
