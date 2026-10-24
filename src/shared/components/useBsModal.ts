import Modal from 'bootstrap/js/dist/modal';
import { useCallback, useEffect, useRef } from 'react';

/** A Bootstrap 5 modal driven from React: attach `ref` to the `.modal` element, then call show()/hide(). */
export function useBsModal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => () => { if (ref.current) Modal.getInstance(ref.current)?.dispose(); }, []);
  const show = useCallback(() => { if (ref.current) Modal.getOrCreateInstance(ref.current).show(); }, []);
  const hide = useCallback(() => { if (ref.current) Modal.getOrCreateInstance(ref.current).hide(); }, []);
  return { ref, show, hide };
}
