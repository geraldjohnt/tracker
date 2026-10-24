import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/shared.css';
import './spending.css';
import { applyAppearance, loadAppearance } from '../shared/appearance';
import { AuthGate } from '../shared/components/AuthGate';
import { SpendingApp } from './SpendingApp';
import { spendingStore } from './store';

// Apply the saved appearance before the first paint (no light/dark flash).
applyAppearance('spendly', loadAppearance('spendly'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate title="Spendly" subtitle="Daily spending tracker" onUser={u => spendingStore.start(u.uid)}>
      {u => <SpendingApp user={u} />}
    </AuthGate>
  </StrictMode>,
);
