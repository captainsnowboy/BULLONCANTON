import React, { useEffect, useRef, useState } from 'react';
import { Hero } from './components/Hero';
import { Charge } from './sections/Charge';
import { OfficeScene } from './sections/OfficeScene';
import { MemeDesk } from './sections/MemeDesk';
import { Herd } from './sections/Herd';
import { TheTape } from './sections/TheTape';
import { TheTapeBot } from './sections/TheTapeBot';
import { Footer } from './components/Footer';
import { Credits, startCreditsMusic } from './components/Credits';
import { useSupanovaLiveData } from './utils/supanova';
import { DebugHeightsPanel } from './components/DebugHeightsPanel';
import { TickerTape } from './components/TickerTape';
import { PlayButton } from './components/PlayButton';
import { SoundToggle } from './components/SoundToggle';
import { Toast } from './components/Toast';
import { showToast } from './utils/toast';
import { triggerStampede } from './utils/stampede';
import { EASTER_EGG_COPY } from './copy.js';
import { initTapFx } from './utils/tapFx';
import { initAudioUnlock } from './utils/audio';

export default function App() {
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);
  const [showDebugHeights] = useState(() =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('debug') === 'heights'
  );
  const wenIndexRef = useRef(0);
  const keyBufferRef = useRef('');
  const tapeState = useSupanovaLiveData();

  useEffect(() => {
    const cleanupTapFx = initTapFx();
    const cleanupAudio = initAudioUnlock();
    return () => {
      cleanupTapFx();
      cleanupAudio();
    };
  }, []);

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
    <div className="relative min-h-screen bg-[var(--ink)] text-[#E8DFC9] flex flex-col selection:bg-[#C97B1A] selection:text-black">
      {/* Halftone texture dots */}
      <div className="fixed inset-0 halftone-overlay z-10 pointer-events-none opacity-40" />

      {/* Static Film Grain (Pre-rendered 128px tile, zero runtime SVG filter) */}
      <div className="comic-grain pointer-events-none" />

      {/* Unified Fixed Corner Sound Toggle (Top-Right) */}
      <SoundToggle />

      {/* Shared Global Toast Notification */}
      <Toast />

      {/* Main Content: Hero, The Charge, The Desk (Receipts Monitor), The Meme Desk, Join The Herd, and Footer */}
      <main className="relative z-20 flex-1 flex flex-col">
        <Hero />
        <Charge />
        <div className="charge-desk-bridge" aria-hidden="true" />
        <OfficeScene />
        <MemeDesk />
        <Herd
          liveHoldersCount={tapeState.liveHoldersFormatted}
          onOpenCredits={() => {
            startCreditsMusic();
            setIsCreditsOpen(true);
          }}
        />
        <TheTape state={tapeState} />
        <TheTapeBot />
        <Footer />
      </main>

      {/* Optional End Credits Overlay */}
      <Credits isOpen={isCreditsOpen} onClose={() => setIsCreditsOpen(false)} />

      {/* Live viewport & section heights debug overlay (?debug=heights) */}
      {showDebugHeights && <DebugHeightsPanel />}

      {/* Fixed bottom-left Play shortcut pill */}
      <PlayButton isCreditsOpen={isCreditsOpen} />

      {/* Fixed bottom scrolling ticker tape */}
      <TickerTape />
    </div>
  );
}
