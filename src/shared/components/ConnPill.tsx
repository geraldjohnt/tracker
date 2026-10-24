import type { ConnStatus } from '../hooks';

const LABELS: Record<ConnStatus, [cls: string, label: string]> = {
  online: ['online', 'Synced'],
  offline: ['offline', 'Offline'],
  local: ['local', 'Local only'],
  unavailable: ['local', 'Unavailable'],
};

/** Header connection status: Synced / Offline / Local only. `null` = still connecting. */
export function ConnPill({ status, localLabel }: { status: ConnStatus | null; localLabel?: string }) {
  const [cls, label] = status ? LABELS[status] : ['', 'Connecting'];
  return (
    <span id="conn" className={'conn ' + cls}>
      <span className="dot"></span><span className="label">{status === 'local' && localLabel ? localLabel : label}</span>
    </span>
  );
}
