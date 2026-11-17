import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GAME_COMING_SOON } from '../config.js';
import { ComingSoon } from './ComingSoon';
import '../index.css';

const root = createRoot(document.getElementById('root')!);

if (!GAME_COMING_SOON) {
  void import('./Play').then(({ Play }) => {
    root.render(
      <StrictMode>
        <Play />
      </StrictMode>
    );
  });
} else {
  root.render(
    <StrictMode>
      <ComingSoon />
    </StrictMode>
  );
}
