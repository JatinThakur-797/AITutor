import { ArrowLeft, Compass } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return <div className="not-found"><div className="not-found-icon"><Compass size={28} /></div><div className="eyebrow">404 · WRONG TURN</div><h1>This page isn't on the roadmap.</h1><p>The page may have moved, or the address may be incorrect.</p><Link to="/" className="btn btn-primary"><ArrowLeft size={16} /> Back to overview</Link></div>;
}
