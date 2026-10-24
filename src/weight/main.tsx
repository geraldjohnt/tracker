import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/shared.css';
import './weight.css';
import { applyAppearance, loadAppearance } from '../shared/appearance';
import { weightStore } from './store';
import { WeightApp } from './WeightApp';

// Apply the saved appearance before the first paint (no light/dark flash).
applyAppearance('weighin', loadAppearance('weighin'));
weightStore.start();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WeightApp />
  </StrictMode>,
);
