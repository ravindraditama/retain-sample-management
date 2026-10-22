import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { KeyRound, Loader2, Plus, Trash2, UserCheck, UserX } from 'lucide-react';
import { api, errMsg } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/sampleStatus';
import { ROLE_LABEL, type Role, type User } from '@/lib/types';
import Modal from '@/components/Modal';
import ConfirmModal from '@/components/ConfirmModal';

const ROLES = Object.keys(ROLE_LABEL) as Role[];

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetFor, setResetFor] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);

  const load = useCallback(async () => {
    try { setUsers((await api.get<{ data: User[] }>('/users')).data); setError(null); } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const patch = async (u: User, body: Partial<{ role: Role; is_active: boolean; display_name: string }>) => {
    try { await api.patch(`/users/${u.id}`, body); await load(); } catch (e) { setError(errMsg(e)); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900">Users & Roles</h1><p className="mt-0.5 text-sm text-slate-500">Admin: full access · Quality Engineer: manage samples · Viewer: read-only.</p></div>
        <button className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Add User</button>
      </div>
      {error && <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr>{['User', 'Role', 'Status', 'Last sign-in', ''].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
            <tbody>{users.map((u) => { const self = u.id === me?.id; return (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-3"><div className="font-medium text-slate-900">{u.display_name || u.email}</div><div className="text-xs text-slate-500">{u.email}</div></td>
                <td className="px-4 py-3"><select className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm" aria-label={`Role for ${u.email}`} value={u.role} disabled={self} onChange={(e) => patch(u, { role: e.target.value as Role })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></td>
                <td className="px-4 py-3"><span className={`badge ${u.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-slate-100 text-slate-500'}`}>{u.is_active ? 'Active' : 'Disabled'}</span></td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDateTime(u.last_login_at)}</td>
                <td className="px-4 py-2"><div className="flex justify-end gap-0.5">
                  <button className="btn-ghost px-2" title="Reset password" aria-label="Reset password" onClick={() => setResetFor(u)}><KeyRound className="h-4 w-4" /></button>
                  {!self && <button className="btn-ghost px-2" title={u.is_active ? 'Disable' : 'Enable'} aria-label={u.is_active ? 'Disable user' : 'Enable user'} onClick={() => patch(u, { is_active: !u.is_active })}>{u.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}</button>}
                  {!self && <button className="btn-ghost px-2 text-red-600" title="Delete" aria-label="Delete user" onClick={() => setDeleting(u)}><Trash2 className="h-4 w-4" /></button>}
                </div></td>
              </tr>); })}</tbody>
          </table>
        </div>
        {loading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Add user" size="md"><UserForm onDone={() => { setCreating(false); load(); }} onCancel={() => setCreating(false)} /></Modal>
      <Modal open={!!resetFor} onClose={() => setResetFor(null)} title={`Reset password — ${resetFor?.email ?? ''}`} size="sm">{resetFor && <ResetForm user={resetFor} onDone={() => setResetFor(null)} />}</Modal>
      <ConfirmModal open={!!deleting} danger title="Delete user" confirmLabel="Delete" onClose={() => setDeleting(null)}
        onConfirm={async () => { try { await api.del(`/users/${deleting!.id}`); await load(); } catch (e) { setError(errMsg(e)); } setDeleting(null); }}>
        Delete <b>{deleting?.email}</b>? Their past activity stays in the audit trail. Consider disabling the account instead.
      </ConfirmModal>
    </div>
  );
}

function UserForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ email: '', display_name: '', role: 'viewer' as Role, password: '' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(null); try { await api.post('/users', f); onDone(); } catch (err) { setError(errMsg(err)); } finally { setBusy(false); } }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div><label className="label" htmlFor="u-name">Name</label><input id="u-name" className="input" value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></div>
      <div><label className="label" htmlFor="u-email">Email *</label><input id="u-email" type="email" required className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
      <div><label className="label" htmlFor="u-role">Role</label><select id="u-role" className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
      <div><label className="label" htmlFor="u-pw">Temporary password * (min. 8)</label><input id="u-pw" required minLength={8} className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
      {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="flex justify-end gap-3"><button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button><button className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Create user</button></div>
    </form>
  );
}

function ResetForm({ user, onDone }: { user: User; onDone: () => void }) {
  const [pw, setPw] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(null); try { await api.post(`/users/${user.id}/reset-password`, { password: pw }); onDone(); } catch (err) { setError(errMsg(err)); } finally { setBusy(false); } }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div><label className="label" htmlFor="r-pw">New temporary password</label><input id="r-pw" required minLength={8} className="input" value={pw} onChange={(e) => setPw(e.target.value)} /><p className="mt-1 text-xs text-slate-500">The user will be asked to change it after signing in.</p></div>
      {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="flex justify-end gap-3"><button type="button" className="btn-secondary" onClick={onDone}>Cancel</button><button className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Reset</button></div>
    </form>
  );
}
