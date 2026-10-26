import 'bootstrap/js/dist/dropdown'; // registers Bootstrap's data-bs-toggle="dropdown" handler
import { useImperativeHandle, useRef, useState, type FormEvent, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { AuthError, passwordProblem, type AuthUser } from '../auth';
import { getAuthService } from '../store';
import { toast } from '../toast';
import { PasswordInput } from './PasswordInput';
import { useBsModal } from './useBsModal';

/** Header account button: who's signed in, Change password, Sign out. */
export function AccountMenu({ user }: { user: AuthUser }) {
  const pw = useRef<ChangePasswordHandle>(null);
  const signOut = async () => {
    await getAuthService()?.signOut();
    location.reload(); // drop this account's data from memory
  };
  return (
    <>
      <div className="dropdown">
        <button id="accountBtn" className="btn btn-ghost btn-sm btn-icon" type="button" data-bs-toggle="dropdown"
          aria-expanded="false" title={'Signed in as ' + user.username}>
          <i className="bi bi-person-circle"></i>
        </button>
        <div className="dropdown-menu dropdown-menu-end account-menu" aria-labelledby="accountBtn">
          <div className="account-name"><i className="bi bi-person-circle"></i><span>{user.username}</span></div>
          <div className="dropdown-divider"></div>
          <button type="button" className="dropdown-item" onClick={() => pw.current?.open()}><i className="bi bi-key"></i>Change password</button>
          <button type="button" className="dropdown-item" onClick={signOut}><i className="bi bi-box-arrow-right"></i>Sign out</button>
        </div>
      </div>
      {/* Portaled: inside the sticky header the modal would sit under its own backdrop. */}
      {createPortal(<ChangePasswordModal ref={pw} />, document.body)}
    </>
  );
}

interface ChangePasswordHandle { open(): void }

function ChangePasswordModal({ ref }: { ref: Ref<ChangePasswordHandle> }) {
  const modal = useBsModal();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useImperativeHandle(ref, () => ({
    open() { setCurrent(''); setNext(''); setConfirm(''); setError(null); setBusy(false); modal.show(); },
  }), [modal]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const problem = !current ? 'Enter your current password'
      : passwordProblem(next) ?? (next !== confirm ? 'New passwords do not match' : next === current ? 'Choose a password different from the current one' : null);
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError(null);
    try {
      const auth = getAuthService();
      if (!auth) throw new AuthError('Sign-in is unavailable right now');
      await auth.changePassword(current, next);
      modal.hide();
      toast('Password changed');
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Something went wrong. Please try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal fade account-modal" id="passwordModal" tabIndex={-1} ref={modal.ref}>
      <div className="modal-dialog modal-dialog-centered modal-sm">
        <form className="modal-content" onSubmit={submit} noValidate>
          <div className="modal-header">
            <h5 className="modal-title">Change password</h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <label className="auth-label" htmlFor="pwCurrent">Current password</label>
            <PasswordInput id="pwCurrent" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} />
            <label className="auth-label" htmlFor="pwNew">New password</label>
            <PasswordInput id="pwNew" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} />
            <label className="auth-label" htmlFor="pwConfirm">Confirm new password</label>
            <PasswordInput id="pwConfirm" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
            {error && <div className="auth-error mb-0" role="alert"><i className="bi bi-exclamation-circle"></i><span>{error}</span></div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" className="auth-submit" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
