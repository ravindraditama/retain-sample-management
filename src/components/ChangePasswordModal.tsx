import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { api, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function ChangePasswordModal({ onDone }: { onDone: () => void }) {
  const { refreshUser } = useAuth();
  const [cur, setCur] = useState(''); const [next, setNext] = useState(''); const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next !== again) { setError('The new passwords do not match.'); return; }
    setBusy(true); setError(null);
    try { await api.post('/auth/change-password', { current_password: cur, new_password: next }); await refreshUser(); onDone(); }
    catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div><label className="label">Current password</label><input className="input" type="password" autoComplete="current-password" required value={cur} onChange={(e) => setCur(e.target.value)} /></div>
      <div><label className="label">New password (min. 8 characters)</label><input className="input" type="password" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} /></div>
      <div><label className="label">Repeat new password</label><input className="input" type="password" autoComplete="new-password" required value={again} onChange={(e) => setAgain(e.target.value)} /></div>
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="flex justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onDone}>Cancel</button>
        <button className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Update password</button>
      </div>
    </form>
  );
}
