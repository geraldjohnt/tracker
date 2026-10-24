import { describe, expect, it } from 'vitest';
import { AuthError, MemoryAuth, usernameProblem, usernameToEmail, type AuthUser } from './auth';

const flush = () => new Promise(r => setTimeout(r, 0));

describe('MemoryAuth (sample-mode accounts)', () => {
  it('registers, signs out and in, and changes the password', async () => {
    localStorage.clear();
    const auth = new MemoryAuth('test.auth');
    const seen: Array<AuthUser | null> = [];
    auth.onChange(u => seen.push(u));
    await flush();
    expect(seen).toEqual([null]);

    const u = await auth.register(' Alice ', 'secret1');
    expect(u.username).toBe('alice');
    await expect(auth.register('alice', 'another1')).rejects.toThrow('already taken');

    await auth.signOut();
    await expect(auth.signIn('alice', 'wrong')).rejects.toBeInstanceOf(AuthError);
    expect((await auth.signIn('ALICE', 'secret1')).uid).toBe(u.uid);

    await expect(auth.changePassword('nope', 'newpass1')).rejects.toThrow('Current password is incorrect');
    await expect(auth.changePassword('secret1', '123')).rejects.toThrow('at least 6');
    await auth.changePassword('secret1', 'newpass1');
    await auth.signOut();
    await expect(auth.signIn('alice', 'secret1')).rejects.toBeInstanceOf(AuthError);
    await auth.signIn('alice', 'newpass1');

    // Persisted: a new page load is still signed in as alice.
    const reloaded = new MemoryAuth('test.auth');
    const now: Array<AuthUser | null> = [];
    reloaded.onChange(x => now.push(x));
    await flush();
    expect(now).toEqual([{ uid: u.uid, username: 'alice' }]);
    expect(seen.at(-1)).toEqual({ uid: u.uid, username: 'alice' });
  });

  it('validates usernames and maps them to a sign-in email', () => {
    expect(usernameProblem('geraldjohnt')).toBeNull();
    expect(usernameProblem('ab')).not.toBeNull();
    expect(usernameProblem('has space')).not.toBeNull();
    expect(usernameToEmail(' GeraldJohnT ')).toBe('geraldjohnt@tracker-8dcc0.firebaseapp.com');
  });
});
