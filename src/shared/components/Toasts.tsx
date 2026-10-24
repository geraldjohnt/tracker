import { useSyncExternalStore } from 'react';
import { toastStore } from '../toast';

export function Toasts() {
  const items = useSyncExternalStore(toastStore.subscribe, toastStore.get);
  return (
    <div className="toast-wrap" id="toasts">
      {items.map(t => (
        <div key={t.id} className={'toast-x' + (t.bad ? ' bad' : '')}
          style={t.leaving ? { transition: 'opacity .25s', opacity: 0 } : undefined}>
          <i className={'bi ' + (t.bad ? 'bi-exclamation-circle' : 'bi-check-circle')}></i>{t.msg}
        </div>
      ))}
    </div>
  );
}
