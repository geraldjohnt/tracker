import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/shared.css';
import './spending.css';
import { applyAppearance, loadAppearance } from '../shared/appearance';
import { SpendingApp } from './SpendingApp';
import { spendingStore } from './store';

// Apply the saved appearance before the first paint (no light/dark flash).
applyAppearance('spendly', loadAppearance('spendly'));
spendingStore.start();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SpendingApp />
  </StrictMode>,
);
