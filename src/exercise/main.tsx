import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/shared.css';
import './exercise.css';
import { applyAppearance, loadAppearance } from '../shared/appearance';
import { AuthGate } from '../shared/components/AuthGate';
import { ExerciseApp } from './ExerciseApp';
import { exerciseStore } from './store';

// Apply the saved appearance before the first paint (no light/dark flash).
applyAppearance('exercise', loadAppearance('exercise'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate title="LevelUp" subtitle="Calisthenics quests" onUser={u => exerciseStore.start(u.uid, u.username)}>
      {u => <ExerciseApp user={u} />}
    </AuthGate>
  </StrictMode>,
);
