import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { backendConfigured, supabase } from '../lib/supabase';
import { useAuth } from '../state/auth';
import { CardView } from '../ui/Card';
import { getCard } from '../cards/registry';
import { useToast } from '../ui/kit';
import { Logo } from '../ui/Layout';

export default function Login() {
  const { session } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (session) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (mode === 'signup' && !/^[A-Za-z0-9_]{3,16}$/.test(username)) { toast('Usernames are 3–16 letters, numbers or underscores.', 'error'); return; }
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username } } });
        if (error) throw error;
        if (!data.session) setNotice('Check your inbox to confirm your email, then sign in.');
      }
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
      <div className="panel mx-auto w-full max-w-md p-6">
        <Logo />
        {!backendConfigured ? (
          <div className="mt-5 space-y-3 text-sm text-white/80">
            <p className="font-display text-xl font-bold text-white">Accounts aren’t configured on this deployment.</p>
            <p>Set <code className="rounded bg-black/40 px-1">VITE_SUPABASE_URL</code> and <code className="rounded bg-black/40 px-1">VITE_SUPABASE_ANON_KEY</code> (see README) to enable accounts, collections, packs and online play.</p>
            <p>You can still play full matches against every AI difficulty in Practice mode.</p>
            <Link to="/battle" className="btn-primary mt-2 w-full">Play Practice</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-black/30 p-1">
              {(['signin', 'signup'] as const).map((m) => (
                <button type="button" key={m} onClick={() => setMode(m)} className={`rounded-xl py-2 font-display font-bold ${mode === m ? 'bg-berry-400 text-[#2a1710]' : 'text-white/70'}`}>{m === 'signin' ? 'Sign in' : 'Create account'}</button>
              ))}
            </div>
            {mode === 'signup' && <input className="input" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />}
            <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            <input className="input" type="password" placeholder="Password (8+ characters)" value={password} minLength={8} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required />
            <button className="btn-primary w-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
            {notice && <p className="rounded-xl bg-mint-400/20 p-3 text-sm text-mint-300">{notice}</p>}
            <p className="text-center text-xs text-white/50">New players receive two starter decks and 300 Scoops.</p>
          </form>
        )}
      </div>
      <div className="relative mx-auto hidden h-[420px] w-[420px] md:block">
        {['GEN-104', 'GEN-105', 'CEL-103'].map((id, i) => (
          <div key={id} className="absolute left-1/2 top-1/2" style={{ transform: `translate(-50%,-50%) translateX(${(i - 1) * 110}px) rotate(${(i - 1) * 10}deg)`, zIndex: i === 1 ? 2 : 1 }}>
            <CardView card={getCard(id)} width={210} tilt />
          </div>
        ))}
      </div>
    </div>
  );
}
