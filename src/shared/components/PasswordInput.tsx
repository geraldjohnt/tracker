// A password field with a show/hide eye button, used by the sign-in screen and Change password.
import { useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'>;

export function PasswordInput(props: Props) {
  const [shown, setShown] = useState(false);
  return (
    <div className="auth-password">
      <input {...props} className="auth-input" type={shown ? 'text' : 'password'} />
      <button type="button" className="auth-reveal" onClick={() => setShown(s => !s)}
        aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown} title={shown ? 'Hide password' : 'Show password'}>
        <i className={shown ? 'bi bi-eye-slash' : 'bi bi-eye'}></i>
      </button>
    </div>
  );
}
