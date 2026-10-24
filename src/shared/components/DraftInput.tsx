import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  onValue: (text: string) => void;
};

/**
 * An input that owns its text while focused. Incoming `value` changes (live
 * Firebase snapshots, or a kg→lb display round-trip like "15" → "15.0") are
 * applied only while the input is NOT focused, and once more on blur — the
 * React equivalent of the legacy pages' isEditing()/requestRender() deferral,
 * so a background sync never rewrites what the user is typing.
 */
export function DraftInput({ value, onValue, onFocus, onBlur, ...rest }: Props) {
  const [text, setText] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(value); }, [value]);
  return (
    <input
      {...rest}
      value={text}
      onChange={e => { setText(e.target.value); onValue(e.target.value); }}
      onFocus={e => { focused.current = true; onFocus?.(e); }}
      onBlur={e => { focused.current = false; setText(value); onBlur?.(e); }}
    />
  );
}
