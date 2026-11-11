import React, { useEffect, useRef } from 'react';
import { Hero } from './components/Hero';
import { Charge } from './sections/Charge';
import { Arrivals } from './sections/Arrivals';
import { MemeDesk } from './sections/MemeDesk';
import { Herd } from './sections/Herd';
import { Footer } from './components/Footer';
import { TickerTape } from './components/TickerTape';
import { SoundToggle } from './components/SoundToggle';
import { Toast } from './components/Toast';
import { showToast } from './utils/toast';
import { triggerStampede } from './utils/stampede';
import { EASTER_EGG_COPY } from './copy.js';

export default function App() {
  const wenIndexRef = useRef(0);
  const keyBufferRef = useRef('');

  // Global Easter Eggs: typing "wen" or "bull" anywhere on the page
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      if (e.key && e.key.length === 1) {
        keyBufferRef.current = (keyBufferRef.current + e.key.toLowerCase()).slice(-8);

        // Easter Egg 1: "wen" -> rotate bull one-liner toast
        if (keyBufferRef.current.endsWith('wen')) {
          const lines = EASTER_EGG_COPY.wenLines;
          const line = lines[wenIndexRef.current % lines.length];
          wenIndexRef.current++;
          showToast(line);
        }
        // Easter Egg 2: "bull" -> triggers herd stampede
        else if (keyBufferRef.current.endsWith('bull')) {
          triggerStampede();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="relative min-h-screen bg-black text-[#E8DFC9] flex flex-col selection:bg-[#C97B1A] selection:text-black">
      {/* Halftone texture dots */}
      <div className="fixed inset-0 halftone-overlay z-10 pointer-events-none opacity-40" />

      {/* Comic Film Grain SVG Overlay */}
      <svg className="comic-grain" xmlns="http://www.w3.org/2000/svg">
        <filter id="noiseFilter">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="3"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#noiseFilter)" />
      </svg>

      {/* Unified Fixed Corner Sound Toggle (Top-Right) */}
      <SoundToggle />

      {/* Shared Global Toast Notification */}
      <Toast />

      {/* Main Content: Hero, The Charge, The Arrivals Board, The Meme Desk, Join The Herd, and Footer */}
      <main className="relative z-20 flex-1 flex flex-col">
        <Hero />
        <Charge />
        <Arrivals />
        <MemeDesk />
        <Herd />
        <Footer />
      </main>

      {/* Fixed bottom scrolling ticker tape */}
      <TickerTape />
    </div>
  );
}
