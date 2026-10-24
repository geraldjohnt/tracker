import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/shared.css';
import './weight.css';
import { applyAppearance, loadAppearance } from '../shared/appearance';
import { AuthGate } from '../shared/components/AuthGate';
import { weightStore } from './store';
import { WeightApp } from './WeightApp';

// Apply the saved appearance before the first paint (no light/dark flash).
applyAppearance('weighin', loadAppearance('weighin'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate title="WeighIn" subtitle="Weekly weight challenge" onUser={u => weightStore.start(u.uid)}>
      {u => <WeightApp user={u} />}
    </AuthGate>
  </StrictMode>,
);
