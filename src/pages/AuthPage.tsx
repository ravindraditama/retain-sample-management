import { useState, type FormEvent } from 'react';
import { Beaker, Loader2, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { errMsg } from '@/lib/api';

export default function AuthPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await signIn(email.trim(), password); }
    catch (err) { setError(errMsg(err)); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-slate-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><Beaker className="h-5 w-5" /></div>
          <span className="text-lg font-semibold">Retain Sample Manager</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">Every retain sample,<br />traceable until disposal.</h1>
          <p className="mt-4 max-w-md text-slate-300">13-month retention tracking, location movements, disposal records and a complete audit trail for your quality system.</p>
        </div>
        <div className="text-xs text-slate-400">Quality Management System</div>
      </div>
      <div className="flex items-center justify-center bg-slate-50 p-6">
        <form onSubmit={submit} className="card w-full max-w-sm space-y-5 p-7">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">Use the account provided by your administrator.</p>
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input id="email" className="input pl-9" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <div className="relative"><Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input id="password" className="input pl-9" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          </div>
          {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Sign in</button>
        </form>
      </div>
    </div>
  );
}
