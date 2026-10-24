// Shows the sign-in / register screen until someone is signed in, then renders the
// page for that account. Every page is wrapped in one (see each page's main.tsx).
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import logoUrl from '../../../logo.png';
import { AuthError, passwordProblem, usernameProblem, type AuthUser } from '../auth';
import { importLegacyData, LEGACY_OWNER } from '../legacy';
import { getAuthService, getBackend, isSampleMode } from '../store';
import { toast } from '../toast';
import { Toasts } from './Toasts';

const IMPORT_TIMEOUT_MS = 8000; // offline, Firebase never answers; open the app anyway and retry next time

interface Props {
  title: string;
  subtitle: string;
  /** Called once with the signed-in account before the page first renders (start stores here). */
  onUser?: (user: AuthUser) => void;
  children: (user: AuthUser) => ReactNode;
}

type Phase = { kind: 'loading' } | { kind: 'signedOut' } | { kind: 'ready'; user: AuthUser };

async function importWithTimeout(user: AuthUser) {
  const backend = getBackend();
  if (!backend) return;
  try {
    const result = await Promise.race([
      importLegacyData(backend, user),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timed out')), IMPORT_TIMEOUT_MS)),
    ]);
    if (result === 'imported') toast('Your existing data is now in your account');
  } catch (e) {
    console.error(e);
    toast('Could not move your existing data yet. It will try again next time', true);
  }
}

export function AuthGate({ title, subtitle, onUser, children }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const startedUid = useRef<string | null>(null);
  const onUserRef = useRef(onUser);
  onUserRef.current = onUser;

  useEffect(() => {
    const auth = getAuthService();
    if (!auth) { setPhase({ kind: 'signedOut' }); return; }
    let active = true;
    let latest = 0; // ignore a sign-in whose import finishes after a newer auth change
    const unsub = auth.onChange(async user => {
      const seq = ++latest;
      if (!user) { setPhase({ kind: 'signedOut' }); return; }
      // Stores are per page load: switching accounts (e.g. in another tab) needs a fresh page.
      if (startedUid.current && startedUid.current !== user.uid) { location.reload(); return; }
      if (!startedUid.current) {
        setPhase({ kind: 'loading' });
        await importWithTimeout(user);
        if (!active || seq !== latest) return;
        startedUid.current = user.uid;
        onUserRef.current?.(user);
      }
      setPhase({ kind: 'ready', user });
    });
    return () => { active = false; unsub(); };
  }, []);

  if (phase.kind === 'ready') return <>{children(phase.user)}</>;
  return (
    <>
      {phase.kind === 'loading'
        ? <div className="auth-loading"><div className="spinner-border spinner-border-sm" role="status"><span className="visually-hidden">Loading</span></div></div>
        : <AuthScreen title={title} subtitle={subtitle} />}
      <Toasts />
    </>
  );
}

function AuthScreen({ title, subtitle }: { title: string; subtitle: string }) {
  const auth = getAuthService();
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(auth ? null : 'Sign-in is unavailable right now. Try reloading the page');
  const [busy, setBusy] = useState(false);
  const registering = mode === 'register';

  const switchMode = (m: typeof mode) => { setMode(m); setError(null); setConfirm(''); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!auth || busy) return;
    const problem = !username.trim() || !password
      ? 'Enter your username and password'
      : registering ? usernameProblem(username) ?? passwordProblem(password) ?? (confirm !== password ? 'Passwords do not match' : null) : null;
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError(null);
    try {
      await (registering ? auth.register(username, password) : auth.signIn(username, password));
      // AuthGate's listener takes it from here.
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Something went wrong. Please try again');
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card fade-in" onSubmit={submit} noValidate>
        <div className="auth-brand">
          <div className="brand-logo"><img src={logoUrl} alt="Logo" /></div>
          <div>
            <div className="brand-name">{title}</div>
            <div className="brand-sub">{subtitle}</div>
          </div>
        </div>
        <div className="auth-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={!registering} className={registering ? '' : 'active'} onClick={() => switchMode('signin')}>Sign in</button>
          <button type="button" role="tab" aria-selected={registering} className={registering ? 'active' : ''} onClick={() => switchMode('register')}>Register</button>
        </div>

        <label className="auth-label" htmlFor="authUsername">Username</label>
        <input id="authUsername" className="auth-input" value={username} onChange={e => setUsername(e.target.value)}
          autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus />
        <label className="auth-label" htmlFor="authPassword">Password</label>
        <input id="authPassword" className="auth-input" type="password" value={password} onChange={e => setPassword(e.target.value)}
          autoComplete={registering ? 'new-password' : 'current-password'} />
        {registering && <>
          <label className="auth-label" htmlFor="authConfirm">Confirm password</label>
          <input id="authConfirm" className="auth-input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
        </>}

        {error && <div className="auth-error" role="alert"><i className="bi bi-exclamation-circle"></i><span>{error}</span></div>}
        <button type="submit" className="auth-submit" disabled={busy || !auth}>
          {busy ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}
        </button>
        <div className="auth-note">
          {isSampleMode()
            ? 'Sample mode: accounts live in this browser only. Register "' + LEGACY_OWNER + '" to get the sample data.'
            : registering ? 'Anyone can register. You only ever see your own data.' : 'Your data is private to your account.'}
        </div>
      </form>
    </div>
  );
}
