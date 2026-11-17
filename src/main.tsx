import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (
  typeof window !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  /iP(hone|ad|od)/.test(navigator.userAgent) &&
  CSS.supports('-webkit-touch-callout', 'none')
) {
  document.documentElement.classList.add('ios-safari');
}

createRoot(document.getElementById('root')!).render(<App />);
