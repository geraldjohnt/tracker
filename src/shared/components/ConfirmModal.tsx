import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { useBsModal } from './useBsModal';

export interface ConfirmHandle { ask(text: string, onYes: () => void): void }

/** "Are you sure?" dialog. Usage: confirmRef.current.ask('Delete…?', () => …). */
export function ConfirmModal({ ref }: { ref: Ref<ConfirmHandle> }) {
  const modal = useBsModal();
  const [text, setText] = useState('Are you sure?');
  const fn = useRef<(() => void) | null>(null);
  useImperativeHandle(ref, () => ({ ask(t, onYes) { setText(t); fn.current = onYes; modal.show(); } }), [modal]);
  return (
    <div className="modal fade" id="confirmModal" tabIndex={-1} ref={modal.ref}>
      <div className="modal-dialog modal-dialog-centered modal-sm">
        <div className="modal-content">
          <div className="modal-body text-center p-4">
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--bad-soft)', color: 'var(--bad)', display: 'grid', placeItems: 'center', margin: '0 auto 1rem', fontSize: '1.4rem' }}>
              <i className="bi bi-exclamation-triangle"></i>
            </div>
            <div id="confirmText" style={{ fontWeight: 600, fontSize: '.95rem' }}>{text}</div>
          </div>
          <div className="modal-footer border-0 pt-0 justify-content-center">
            <button type="button" className="btn btn-ghost" data-bs-dismiss="modal">Cancel</button>
            <button type="button" className="btn btn-danger fw-bold" id="confirmYes" style={{ borderRadius: 'var(--r-md)' }}
              onClick={() => { modal.hide(); fn.current?.(); fn.current = null; }}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}
