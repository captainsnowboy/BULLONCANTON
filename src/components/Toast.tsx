import React, { useState, useEffect } from 'react';
import { subscribeToast } from '../utils/toast';

export const Toast: React.FC = () => {
  const [toastText, setToastText] = useState('');

  useEffect(() => {
    return subscribeToast((text) => setToastText(text));
  }, []);

  if (!toastText) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[90%] sm:w-auto px-4 py-2.5 bg-[#0E0D0C] border-2 border-[#C97B1A] text-[#E8DFC9] shadow-[4px_4px_0_#000] text-center pointer-events-none select-none"
    >
      <div className="flex items-center justify-center gap-2">
        <span className="w-2 h-2 bg-[#C97B1A] rotate-45 inline-block shrink-0" />
        <span className="font-plex text-xs font-bold uppercase tracking-wider text-[#F2B24A]">
          {toastText}
        </span>
      </div>
    </div>
  );
};
