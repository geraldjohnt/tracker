import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/shared.css';
import './dashboard.css';
import { applyAppearance, loadAppearance } from '../shared/appearance';
import { AuthGate } from '../shared/components/AuthGate';
import { Dashboard } from './Dashboard';

// Apply the saved appearance before the first paint (no light/dark flash).
applyAppearance('dashboard', loadAppearance('dashboard'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate title="Dashboard" subtitle="Tracker overview">
      {u => <Dashboard user={u} />}
    </AuthGate>
  </StrictMode>,
);
