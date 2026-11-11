import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Share2, Copy, Twitter, Sparkles, Check, Move } from 'lucide-react';
import { MEME_DESK_COPY } from '../copy.js';

// Preload and cache HTMLImageElement
const imageCache = new Map();
function loadMemeImage(src) {
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src));
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

// Ensure fonts are ready before canvas painting
async function ensureFontsReady() {
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await Promise.all([
        document.fonts.load('bold 60px "Anton"'),
        document.fonts.load('bold 48px "Playfair Display"'),
        document.fonts.load('24px "IBM Plex Mono"')
      ]);
    } catch {
      // Fallback safe
    }
  }
}

export const MemeDesk = () => {
  // Step 1: Bull & Template selection
  const [selectedBull, setSelectedBull] = useState(MEME_DESK_COPY.bulls[0]);
  const [selectedTemplate, setSelectedTemplate] = useState('classic');

  // Step 2: Form Inputs
  const [topText, setTopText] = useState('MARKET CLOSED');
  const [bottomText, setBottomText] = useState("I'M STILL WORKING");
  const [frontHeadline, setFrontHeadline] = useState('BULL COMPLETES SETTLEMENT WITHOUT ASKING PERMISSION');
  const [frontCaption, setFrontCaption] = useState('The Bull in business suit, entirely unconcerned.');
  const [speechText, setSpeechText] = useState('Per my last block.');
  const [selectedStamp, setSelectedStamp] = useState('NONE');
  const [stampScale, setStampScale] = useState(1);
  const [stampPos, setStampPos] = useState({ x: 540, y: 540 }); // Center by default
  const [addWatermark, setAddWatermark] = useState(true);

  // Status & export state
  const [statusMsg, setStatusMsg] = useState('');
  const [canShare, setCanShare] = useState(false);
  const [canCopy, setCanCopy] = useState(false);
  const [activeTab, setActiveTab] = useState('pick'); // 'pick' | 'write' | 'send'

  const canvasRef = useRef(null);
  const isDraggingStampRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef(null);

  // Check Web Share and Clipboard API capabilities
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setCanCopy(Boolean(navigator.clipboard && window.ClipboardItem));
      if (navigator.canShare) {
        try {
          const testFile = new File([''], 'test.png', { type: 'image/png' });
          setCanShare(navigator.canShare({ files: [testFile] }));
        } catch {
          setCanShare(false);
        }
      }
    }
  }, []);

  // Text wrap and auto-shrink helper
  const drawWrappedText = (ctx, text, x, y, maxWidth, initialFontSize, fontFamily, stroke, fill, strokeWidth = 8) => {
    let fontSize = initialFontSize;
    let lines = [];

    while (fontSize >= 20) {
      ctx.font = `bold ${fontSize}px ${fontFamily}`;
      const words = text.split(' ');
      lines = [];
      let currentLine = words[0] || '';

      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine + ' ' + word;
        const testWidth = ctx.measureText(testLine).width;
        if (testWidth < maxWidth) {
          currentLine = testLine;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);

      // Check if all lines fit
      const allFit = lines.every((l) => ctx.measureText(l).width <= maxWidth);
      if (allFit && lines.length <= 4) break;
      fontSize -= 4;
    }

    const lineHeight = fontSize * 1.15;
    const startY = y - ((lines.length - 1) * lineHeight) / 2;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = fill;
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth * (fontSize / initialFontSize);
      ctx.lineJoin = 'miter';
      ctx.miterLimit = 2;
    }

    lines.forEach((line, idx) => {
      const lineY = startY + idx * lineHeight;
      if (stroke) {
        ctx.strokeText(line, x, lineY);
      }
      ctx.fillText(line, x, lineY);
    });
  };

  // Main Canvas Render Routine
  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    await ensureFontsReady();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions based on template
    const isFrontPage = selectedTemplate === 'frontpage';
    const width = 1080;
    const height = isFrontPage ? 1350 : 1080;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    // Load selected bull image
    let bullImg;
    try {
      bullImg = await loadMemeImage(`/assets/${selectedBull.file}`);
    } catch {
      // Fallback to hero
      bullImg = await loadMemeImage('/assets/bull-hero-final.png');
    }

    ctx.clearRect(0, 0, width, height);

    // =========================================================================
    // TEMPLATE A: CLASSIC (1080x1080)
    // Full bleed bull on solid black, top/bottom text in Anton
    // =========================================================================
    if (selectedTemplate === 'classic') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      // Center Bull full-bleed
      const imgSize = 980;
      ctx.drawImage(bullImg, (width - imgSize) / 2, (height - imgSize) / 2, imgSize, imgSize);

      // Top text
      if (topText.trim()) {
        drawWrappedText(
          ctx,
          topText.toUpperCase(),
          width / 2,
          95,
          width - 80,
          72,
          'Anton, sans-serif',
          '#000000',
          '#FFFFFF',
          12
        );
      }

      // Bottom text
      if (bottomText.trim()) {
        drawWrappedText(
          ctx,
          bottomText.toUpperCase(),
          width / 2,
          height - 105,
          width - 80,
          72,
          'Anton, sans-serif',
          '#000000',
          '#FFFFFF',
          12
        );
      }
    }

    // =========================================================================
    // TEMPLATE B: FRONT PAGE (1080x1350)
    // Newsprint background, The Daily Wait masthead, headline in Playfair Display,
    // and bull framed as an editorial photo with thick border
    // =========================================================================
    else if (selectedTemplate === 'frontpage') {
      // Newsprint background
      ctx.fillStyle = '#E8DFC9';
      ctx.fillRect(0, 0, width, height);

      // Halftone dot pattern across background
      ctx.fillStyle = 'rgba(14, 13, 12, 0.08)';
      for (let x = 12; x < width; x += 24) {
        for (let y = 12; y < height; y += 24) {
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Top Issue Header rules
      ctx.fillStyle = '#0E0D0C';
      ctx.fillRect(50, 40, width - 100, 3);

      // Masthead: THE DAILY WAIT
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#0E0D0C';
      ctx.font = 'bold 96px Anton, sans-serif';
      ctx.fillText('THE DAILY WAIT', width / 2, 52);

      // Subtitle & Date bar
      ctx.fillRect(50, 168, width - 100, 2);
      ctx.font = '600 18px "IBM Plex Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('VOL. XIV NO. 420 • (satire)', 54, 178);
      ctx.textAlign = 'right';
      const todayStr = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      ctx.fillText(`${todayStr.toUpperCase()} • PRICE: 2 SATOSHIS`, width - 54, 178);
      ctx.fillRect(50, 206, width - 100, 3);

      // Main Headline in Playfair Display bold
      const headlineY = 275;
      drawWrappedText(
        ctx,
        frontHeadline.toUpperCase(),
        width / 2,
        headlineY,
        width - 120,
        56,
        '"Playfair Display", serif',
        null,
        '#0E0D0C',
        0
      );

      // Framed Photo: Black background with 8px thick solid dark frame
      const frameX = 140;
      const frameY = 380;
      const frameW = 800;
      const frameH = 800;

      // Photo Frame Drop Shadow & Border
      ctx.fillStyle = '#0E0D0C';
      ctx.fillRect(frameX - 8, frameY - 8, frameW + 16, frameH + 16);

      // Solid Black Photo Mat (matches bull solid black background)
      ctx.fillStyle = '#000000';
      ctx.fillRect(frameX, frameY, frameW, frameH);

      // Draw Bull inside the framed photo
      ctx.drawImage(bullImg, frameX, frameY, frameW, frameH);

      // Inner subtle border
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 2;
      ctx.strokeRect(frameX, frameY, frameW, frameH);

      // Photo Caption
      if (frontCaption.trim()) {
        ctx.fillStyle = '#0E0D0C';
        ctx.font = 'italic 20px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`Fig 1. — ${frontCaption}`, width / 2, frameY + frameH + 18);
      }
    }

    // =========================================================================
    // TEMPLATE C: SPEECH BUBBLE (1080x1080)
    // Full bleed bull on black with comic callout bubble
    // =========================================================================
    else if (selectedTemplate === 'speech') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      // Bull positioned lower to accommodate top speech bubble
      const imgSize = 880;
      ctx.drawImage(bullImg, (width - imgSize) / 2, height - imgSize + 60, imgSize, imgSize);

      // Draw Comic Speech Bubble
      const bubbleX = 100;
      const bubbleY = 80;
      const bubbleW = width - 200;
      const bubbleH = 220;
      const radius = 24;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(bubbleX + radius, bubbleY);
      ctx.lineTo(bubbleX + bubbleW - radius, bubbleY);
      ctx.quadraticCurveTo(bubbleX + bubbleW, bubbleY, bubbleX + bubbleW, bubbleY + radius);
      ctx.lineTo(bubbleX + bubbleW, bubbleY + bubbleH - radius);
      ctx.quadraticCurveTo(bubbleX + bubbleW, bubbleY + bubbleH, bubbleX + bubbleW - radius, bubbleY + bubbleH);

      // Speech bubble tail pointing towards mouth (around 460, 480)
      ctx.lineTo(bubbleX + bubbleW * 0.45 + 50, bubbleY + bubbleH);
      ctx.lineTo(bubbleX + bubbleW * 0.45 - 20, bubbleY + bubbleH + 75);
      ctx.lineTo(bubbleX + bubbleW * 0.45, bubbleY + bubbleH);

      ctx.lineTo(bubbleX + radius, bubbleY + bubbleH);
      ctx.quadraticCurveTo(bubbleX, bubbleY + bubbleH, bubbleX, bubbleY + bubbleH - radius);
      ctx.lineTo(bubbleX, bubbleY + radius);
      ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + radius, bubbleY);
      ctx.closePath();

      // Shadow & Fill
      ctx.shadowColor = '#C97B1A';
      ctx.shadowOffsetX = 8;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = '#FFFDF7';
      ctx.fill();

      // Outline
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#0E0D0C';
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.restore();

      // Bubble text
      if (speechText.trim()) {
        drawWrappedText(
          ctx,
          speechText,
          width / 2,
          bubbleY + bubbleH / 2,
          bubbleW - 60,
          44,
          '"IBM Plex Mono", monospace',
          null,
          '#0E0D0C',
          0
        );
      }
    }

    // =========================================================================
    // OPTIONAL RED STAMP OVERLAY (Draggable & Resizable)
    // =========================================================================
    if (selectedStamp !== 'NONE') {
      ctx.save();
      ctx.translate(stampPos.x, stampPos.y);
      ctx.rotate((-12 * Math.PI) / 180);
      ctx.scale(stampScale, stampScale);

      const stampText = selectedStamp;
      ctx.font = 'bold 44px Anton, sans-serif';
      const textMetrics = ctx.measureText(stampText);
      const paddingX = 32;
      const paddingY = 16;
      const stampW = textMetrics.width + paddingX * 2;
      const stampH = 70;

      // Outer thick red border
      ctx.strokeStyle = '#C23B22';
      ctx.lineWidth = 8;
      ctx.fillStyle = 'rgba(14, 13, 12, 0.85)';
      ctx.fillRect(-stampW / 2, -stampH / 2, stampW, stampH);
      ctx.strokeRect(-stampW / 2, -stampH / 2, stampW, stampH);

      // Inner thin red border
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-stampW / 2 + 5, -stampH / 2 + 5, stampW - 10, stampH - 10);

      // Red Text
      ctx.fillStyle = '#C23B22';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(stampText, 0, 0);

      ctx.restore();
    }

    // =========================================================================
    // WATERMARK TAG (If enabled)
    // =========================================================================
    if (addWatermark) {
      ctx.save();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.font = '600 20px "IBM Plex Mono", monospace';

      // Subtle background badge
      const tagText = 'BULL ON CANTON';
      const tagW = ctx.measureText(tagText).width + 36;
      const tagH = 36;
      const tagX = width - 40;
      const tagY = height - 40;

      ctx.fillStyle = 'rgba(14, 13, 12, 0.88)';
      ctx.fillRect(tagX - tagW, tagY - tagH, tagW, tagH);
      ctx.strokeStyle = '#C97B1A';
      ctx.lineWidth = 2;
      ctx.strokeRect(tagX - tagW, tagY - tagH, tagW, tagH);

      // Small bronze square indicator
      ctx.fillStyle = '#C97B1A';
      ctx.fillRect(tagX - tagW + 10, tagY - tagH + 10, 14, 14);

      // Text
      ctx.fillStyle = '#E8DFC9';
      ctx.fillText(tagText, tagX - 10, tagY - 9);
      ctx.restore();
    }
  }, [
    selectedBull,
    selectedTemplate,
    topText,
    bottomText,
    frontHeadline,
    frontCaption,
    speechText,
    selectedStamp,
    stampScale,
    stampPos,
    addWatermark
  ]);

  // Debounced render trigger on input changes
  useEffect(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => {
      renderCanvas();
    });
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [renderCanvas]);

  // Give Me a Line button handler
  const handleRandomLine = (fieldSetter) => {
    const lines = MEME_DESK_COPY.starterLines;
    const random = lines[Math.floor(Math.random() * lines.length)];
    fieldSetter(random);
  };

  // Draggable stamp interaction (only the stamp itself uses touch-action: none)
  const handleStampPointerDown = (e) => {
    if (selectedStamp === 'NONE') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;

    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;

    isDraggingStampRef.current = true;
    dragStartRef.current = { x: canvasX - stampPos.x, y: canvasY - stampPos.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleStampPointerMove = (e) => {
    if (!isDraggingStampRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;

    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;

    setStampPos({
      x: Math.max(100, Math.min(canvas.width - 100, canvasX - dragStartRef.current.x)),
      y: Math.max(100, Math.min(canvas.height - 100, canvasY - dragStartRef.current.y))
    });
  };

  const handleStampPointerUp = (e) => {
    if (isDraggingStampRef.current) {
      isDraggingStampRef.current = false;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
  };

  // Download Action
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `bull-on-canton-${selectedTemplate}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setStatusMsg(MEME_DESK_COPY.status.saved);
    } catch {
      // iOS fallback
      const dataUrl = canvas.toDataURL('image/png');
      const win = window.open();
      if (win) {
        win.document.write(`<img src="${dataUrl}" style="max-width:100%" alt="Meme" />`);
        win.document.write(`<p style="font-family:sans-serif;text-align:center">${MEME_DESK_COPY.iosFallbackNotice}</p>`);
      }
    }
  };

  // Native Share Action
  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !navigator.share) return;

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], 'bull-on-canton-meme.png', { type: 'image/png' });
      try {
        await navigator.share({
          title: 'BULL ON CANTON Meme',
          text: MEME_DESK_COPY.xPrefillText,
          files: [file]
        });
        setStatusMsg(MEME_DESK_COPY.status.shared);
      } catch {
        // User cancelled or share dismissed
      }
    });
  };

  // Copy Image Action
  const handleCopy = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !navigator.clipboard) return;

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const item = new window.ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        setStatusMsg(MEME_DESK_COPY.status.copied);
      } catch {
        setStatusMsg(MEME_DESK_COPY.status.error);
      }
    });
  };

  // Post on X Action
  const handlePostOnX = () => {
    const text = encodeURIComponent(MEME_DESK_COPY.xPrefillText);
    const url = `https://twitter.com/intent/tweet?text=${text}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <section
      aria-label="The Meme Desk"
      className="relative w-full bg-black text-[#E8DFC9] py-12 sm:py-20 px-3 sm:px-6 border-t-2 border-[#C97B1A]/40 select-none pb-32 sm:pb-36"
    >
      <div className="max-w-6xl mx-auto flex flex-col">
        {/* Section Header */}
        <div className="border-b-2 border-[#C97B1A] pb-4 mb-6 sm:mb-8 text-center sm:text-left">
          <h2 className="font-anton text-3xl sm:text-5xl text-white uppercase tracking-wide">
            {MEME_DESK_COPY.heading}
          </h2>
          <p className="font-plex text-xs sm:text-sm text-[#F2B24A] font-bold tracking-widest uppercase mt-1">
            {MEME_DESK_COPY.subheading}
          </p>
        </div>

        {/* Live Accessibility Status Banner */}
        {statusMsg && (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 bg-[#2FD27A]/15 border border-[#2FD27A] text-[#2FD27A] px-4 py-2 font-plex text-xs flex items-center justify-between"
          >
            <span>{statusMsg}</span>
            <button
              type="button"
              onClick={() => setStatusMsg('')}
              className="text-[#2FD27A] hover:underline text-xs min-h-[44px] px-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Workspace: Canvas Preview + Controls (Two columns on desktop >= 900px, stacked with sticky preview on mobile < 900px) */}
        <div className="grid grid-cols-1 min-[900px]:grid-cols-12 gap-6 min-[900px]:gap-8 items-start">
          
          {/* Canvas Preview Stage (Sticky top: 8px on mobile, top: 24px on desktop) */}
          <div className="w-full min-[900px]:col-span-5 xl:col-span-6 sticky top-2 min-[900px]:top-6 z-30 flex flex-col items-center">
            <div className="relative w-full max-w-[480px] bg-[#0E0D0C] border-2 sm:border-3 border-[#C97B1A] shadow-[4px_4px_0_#000] sm:shadow-[8px_8px_0_#000] p-1.5 sm:p-2 flex flex-col items-center max-h-[42dvh] min-[900px]:max-h-none overflow-hidden">
              
              {/* Canvas viewport */}
              <div className="relative w-full flex-1 overflow-hidden bg-black flex items-center justify-center">
                <div className="relative inline-flex items-center justify-center max-w-full max-h-full">
                  <canvas
                    ref={canvasRef}
                    className="w-auto h-auto max-w-full max-h-[calc(42dvh-28px)] min-[900px]:max-h-[68vh] object-contain mx-auto block cursor-default"
                    style={{
                      aspectRatio: selectedTemplate === 'frontpage' ? '4/5' : '1/1',
                    }}
                  />

                  {/* Stamp Draggable Target: strictly only this element has touchAction: 'none' */}
                  {selectedStamp !== 'NONE' && (
                    <div
                      onPointerDown={handleStampPointerDown}
                      onPointerMove={handleStampPointerMove}
                      onPointerUp={handleStampPointerUp}
                      onPointerCancel={handleStampPointerUp}
                      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing border-2 border-dashed border-[#C23B22] rounded-xs select-none z-20 group"
                      style={{
                        left: `${(stampPos.x / (selectedTemplate === 'frontpage' ? 1080 : 1080)) * 100}%`,
                        top: `${(stampPos.y / (selectedTemplate === 'frontpage' ? 1350 : 1080)) * 100}%`,
                        width: `${Math.max(80, (selectedStamp.length * 28 + 64) * stampScale * (100 / 1080))}%`,
                        height: `${Math.max(40, 70 * stampScale * (100 / (selectedTemplate === 'frontpage' ? 1350 : 1080)))}%`,
                        transform: 'translate(-50%, -50%) rotate(-12deg)',
                        touchAction: 'none',
                      }}
                      aria-label="Draggable Stamp"
                    >
                      <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-black/90 border border-[#F2B24A] px-1.5 py-0.2 text-[8px] font-plex text-[#F2B24A] pointer-events-none whitespace-nowrap flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <Move className="w-2.5 h-2.5" />
                        <span>DRAG</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Resolution Label */}
              <div className="w-full flex items-center justify-between mt-1 px-1 text-[9px] sm:text-[10px] font-plex text-[#E8DFC9]/50 shrink-0">
                <span>EXPORT: {selectedTemplate === 'frontpage' ? '1080x1350' : '1080x1080'}</span>
                <span className="hidden sm:inline">100% PRIVATE CLIENT RENDER</span>
              </div>
            </div>
          </div>

          {/* Controls: Three Tabs on mobile, Stacked on desktop */}
          <div className="w-full min-[900px]:col-span-7 xl:col-span-6 flex flex-col gap-4 sm:gap-6">
            
            {/* Mobile Tab Bar (< 900px) */}
            <div
              className="flex min-[900px]:hidden border-2 border-[#C97B1A]/40 bg-[#0E0D0C] p-1 gap-1 shadow-[2px_2px_0_#000]"
              role="tablist"
              aria-label="Meme editor steps"
            >
              {[
                { id: 'pick', label: MEME_DESK_COPY.steps.pick },
                { id: 'write', label: MEME_DESK_COPY.steps.write },
                { id: 'send', label: MEME_DESK_COPY.steps.send },
              ].map((tab) => {
                const isCurrent = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isCurrent}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 py-2 px-1 text-xs font-anton tracking-wider uppercase transition-all min-h-[44px] cursor-pointer border ${
                      isCurrent
                        ? 'bg-[#F2B24A] text-black border-black shadow-[2px_2px_0_#C97B1A]'
                        : 'bg-black/60 text-[#E8DFC9]/70 border-transparent hover:text-white'
                    } focus-visible:ring-2 focus-visible:ring-[#F2B24A] focus-visible:outline-none`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* ========================================================= */}
            {/* STEP 1: PICK                                              */}
            {/* ========================================================= */}
            <div
              className={`${
                activeTab === 'pick' ? 'block' : 'hidden'
              } min-[900px]:block bg-[#0E0D0C] border-2 border-[#C97B1A]/60 p-4 sm:p-5 shadow-[4px_4px_0_#000]`}
            >
              <div className="flex items-center gap-2 border-b border-[#C97B1A]/40 pb-2 mb-3">
                <span className="w-2.5 h-2.5 bg-[#C97B1A] rotate-45 inline-block" />
                <h3 className="font-anton text-lg tracking-wider text-white uppercase">
                  {MEME_DESK_COPY.steps.pick}
                </h3>
              </div>

              {/* Expression Thumbnails */}
              <div className="mb-4">
                <label className="block text-[11px] font-plex text-[#F2B24A] font-bold tracking-wider uppercase mb-2">
                  Select Mascot Expression
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {MEME_DESK_COPY.bulls.map((bull) => {
                    const isSelected = selectedBull.id === bull.id;
                    return (
                      <button
                        key={bull.id}
                        type="button"
                        onClick={() => setSelectedBull(bull)}
                        aria-label={`Select ${bull.label} expression`}
                        className={`flex flex-col items-center p-1.5 border-2 transition-all outline-none min-h-[44px] cursor-pointer ${
                          isSelected
                            ? 'border-[#F2B24A] bg-[#F2B24A]/20 scale-105'
                            : 'border-black hover:border-[#C97B1A] bg-black'
                        } focus-visible:ring-2 focus-visible:ring-[#F2B24A]`}
                      >
                        <img
                          src={`/assets/${bull.file}`}
                          alt={bull.label}
                          width={80}
                          height={80}
                          loading="lazy"
                          className="w-full aspect-square object-cover"
                        />
                        <span className="text-[9px] font-plex text-[#E8DFC9] truncate mt-1">
                          {bull.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Template Selector */}
              <div>
                <label className="block text-[11px] font-plex text-[#F2B24A] font-bold tracking-wider uppercase mb-2">
                  Select Layout Template
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {MEME_DESK_COPY.templates.map((tpl) => {
                    const isSelected = selectedTemplate === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setSelectedTemplate(tpl.id)}
                        className={`p-2.5 border-2 text-left transition-all outline-none min-h-[44px] cursor-pointer ${
                          isSelected
                            ? 'border-[#F2B24A] bg-[#F2B24A]/15 shadow-[2px_2px_0_#F2B24A]'
                            : 'border-black hover:border-[#C97B1A]/60 bg-black'
                        } focus-visible:ring-2 focus-visible:ring-[#F2B24A]`}
                      >
                        <div className="font-anton text-sm text-white">{tpl.label}</div>
                        <div className="text-[10px] font-plex text-[#E8DFC9]/60 leading-tight mt-0.5">
                          {tpl.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mobile NEXT button */}
              <div className="mt-4 pt-3 border-t border-[#C97B1A]/30 flex justify-end min-[900px]:hidden">
                <button
                  type="button"
                  onClick={() => setActiveTab('write')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#F2B24A] hover:bg-[#ffc463] text-black font-anton text-xs tracking-wider uppercase shadow-[2px_2px_0_#000] min-h-[44px] cursor-pointer"
                >
                  <span>NEXT: WRITE</span>
                  <span>▶</span>
                </button>
              </div>
            </div>

            {/* ========================================================= */}
            {/* STEP 2: WRITE                                             */}
            {/* ========================================================= */}
            <div
              className={`${
                activeTab === 'write' ? 'block' : 'hidden'
              } min-[900px]:block bg-[#0E0D0C] border-2 border-[#C97B1A]/60 p-4 sm:p-5 shadow-[4px_4px_0_#000]`}
            >
              <div className="flex items-center gap-2 border-b border-[#C97B1A]/40 pb-2 mb-3">
                <span className="w-2.5 h-2.5 bg-[#C97B1A] rotate-45 inline-block" />
                <h3 className="font-anton text-lg tracking-wider text-white uppercase">
                  {MEME_DESK_COPY.steps.write}
                </h3>
              </div>

              {/* Dynamic text inputs by template */}
              {selectedTemplate === 'classic' && (
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label htmlFor="top-text" className="text-[11px] font-plex text-[#F2B24A] font-bold uppercase">
                        Top Caption
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRandomLine(setTopText)}
                        className="text-[10px] font-plex text-[#E8DFC9]/70 hover:text-white flex items-center gap-1 cursor-pointer min-h-[44px] py-1"
                      >
                        <Sparkles className="w-3 h-3 text-[#F2B24A]" />
                        <span>{MEME_DESK_COPY.giveMeLineButton}</span>
                      </button>
                    </div>
                    <input
                      id="top-text"
                      type="text"
                      maxLength={60}
                      value={topText}
                      onChange={(e) => setTopText(e.target.value)}
                      className="w-full bg-black border-2 border-[#C97B1A]/40 px-3 py-2 font-anton text-base text-white focus:outline-none focus:border-[#F2B24A] min-h-[44px]"
                    />
                    <div className="text-right text-[10px] font-plex text-[#E8DFC9]/40 mt-0.5">
                      {topText.length}/60
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label htmlFor="bottom-text" className="text-[11px] font-plex text-[#F2B24A] font-bold uppercase">
                        Bottom Caption
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRandomLine(setBottomText)}
                        className="text-[10px] font-plex text-[#E8DFC9]/70 hover:text-white flex items-center gap-1 cursor-pointer min-h-[44px] py-1"
                      >
                        <Sparkles className="w-3 h-3 text-[#F2B24A]" />
                        <span>{MEME_DESK_COPY.giveMeLineButton}</span>
                      </button>
                    </div>
                    <input
                      id="bottom-text"
                      type="text"
                      maxLength={60}
                      value={bottomText}
                      onChange={(e) => setBottomText(e.target.value)}
                      className="w-full bg-black border-2 border-[#C97B1A]/40 px-3 py-2 font-anton text-base text-white focus:outline-none focus:border-[#F2B24A] min-h-[44px]"
                    />
                    <div className="text-right text-[10px] font-plex text-[#E8DFC9]/40 mt-0.5">
                      {bottomText.length}/60
                    </div>
                  </div>
                </div>
              )}

              {selectedTemplate === 'frontpage' && (
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label htmlFor="headline-text" className="text-[11px] font-plex text-[#F2B24A] font-bold uppercase">
                        Newspaper Headline
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRandomLine(setFrontHeadline)}
                        className="text-[10px] font-plex text-[#E8DFC9]/70 hover:text-white flex items-center gap-1 cursor-pointer min-h-[44px] py-1"
                      >
                        <Sparkles className="w-3 h-3 text-[#F2B24A]" />
                        <span>{MEME_DESK_COPY.giveMeLineButton}</span>
                      </button>
                    </div>
                    <input
                      id="headline-text"
                      type="text"
                      maxLength={70}
                      value={frontHeadline}
                      onChange={(e) => setFrontHeadline(e.target.value)}
                      className="w-full bg-black border-2 border-[#C97B1A]/40 px-3 py-2 font-playfair font-bold text-base text-white focus:outline-none focus:border-[#F2B24A] min-h-[44px]"
                    />
                    <div className="text-right text-[10px] font-plex text-[#E8DFC9]/40 mt-0.5">
                      {frontHeadline.length}/70
                    </div>
                  </div>

                  <div>
                    <label htmlFor="caption-text" className="block text-[11px] font-plex text-[#F2B24A] font-bold uppercase mb-1">
                      Photo Caption
                    </label>
                    <input
                      id="caption-text"
                      type="text"
                      maxLength={60}
                      value={frontCaption}
                      onChange={(e) => setFrontCaption(e.target.value)}
                      className="w-full bg-black border-2 border-[#C97B1A]/40 px-3 py-2 font-plex text-xs text-white focus:outline-none focus:border-[#F2B24A] min-h-[44px]"
                    />
                    <div className="text-right text-[10px] font-plex text-[#E8DFC9]/40 mt-0.5">
                      {frontCaption.length}/60
                    </div>
                  </div>
                </div>
              )}

              {selectedTemplate === 'speech' && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="speech-text" className="text-[11px] font-plex text-[#F2B24A] font-bold uppercase">
                      Speech Bubble Text
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRandomLine(setSpeechText)}
                      className="text-[10px] font-plex text-[#E8DFC9]/70 hover:text-white flex items-center gap-1 cursor-pointer min-h-[44px] py-1"
                    >
                      <Sparkles className="w-3 h-3 text-[#F2B24A]" />
                      <span>{MEME_DESK_COPY.giveMeLineButton}</span>
                    </button>
                  </div>
                  <input
                    id="speech-text"
                    type="text"
                    maxLength={80}
                    value={speechText}
                    onChange={(e) => setSpeechText(e.target.value)}
                    className="w-full bg-black border-2 border-[#C97B1A]/40 px-3 py-2 font-plex text-sm text-white focus:outline-none focus:border-[#F2B24A] min-h-[44px]"
                  />
                  <div className="text-right text-[10px] font-plex text-[#E8DFC9]/40 mt-0.5">
                    {speechText.length}/80
                  </div>
                </div>
              )}

              {/* Rubber Stamp Selector */}
              <div className="mt-4 pt-3 border-t border-[#C97B1A]/20">
                <label className="block text-[11px] font-plex text-[#F2B24A] font-bold uppercase mb-2">
                  Optional Red Rubber Stamp
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {MEME_DESK_COPY.stamps.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setSelectedStamp(st)}
                      className={`px-2.5 py-1.5 text-xs font-anton tracking-wider uppercase border transition-colors min-h-[40px] cursor-pointer ${
                        selectedStamp === st
                          ? 'border-[#C23B22] text-[#C23B22] bg-[#C23B22]/15 font-bold shadow-[2px_2px_0_#C23B22]'
                          : 'border-black text-[#E8DFC9]/70 bg-black hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                {/* Stamp Size Slider if active */}
                {selectedStamp !== 'NONE' && (
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-[10px] font-plex text-[#E8DFC9]/70 whitespace-nowrap">
                      STAMP SIZE:
                    </span>
                    <input
                      type="range"
                      min="0.6"
                      max="1.6"
                      step="0.05"
                      value={stampScale}
                      onChange={(e) => setStampScale(parseFloat(e.target.value))}
                      className="w-full accent-[#C23B22] cursor-pointer"
                    />
                    <span className="text-[10px] font-plex text-[#E8DFC9]/70">
                      {Math.round(stampScale * 100)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Watermark Tag Toggle */}
              <div className="mt-4 pt-3 border-t border-[#C97B1A]/20">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-plex text-[#E8DFC9] min-h-[44px] py-1">
                  <input
                    type="checkbox"
                    checked={addWatermark}
                    onChange={(e) => setAddWatermark(e.target.checked)}
                    className="w-4 h-4 accent-[#C97B1A] rounded-none cursor-pointer"
                  />
                  <span>{MEME_DESK_COPY.watermarkToggle}</span>
                </label>
              </div>

              {/* Mobile Back & Next Buttons */}
              <div className="mt-4 pt-3 border-t border-[#C97B1A]/30 flex justify-between items-center min-[900px]:hidden">
                <button
                  type="button"
                  onClick={() => setActiveTab('pick')}
                  className="inline-flex items-center gap-1 px-3 py-2 text-[#E8DFC9]/70 hover:text-white font-plex text-xs uppercase min-h-[44px] cursor-pointer"
                >
                  <span>◀ BACK: PICK</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('send')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#F2B24A] hover:bg-[#ffc463] text-black font-anton text-xs tracking-wider uppercase shadow-[2px_2px_0_#000] min-h-[44px] cursor-pointer"
                >
                  <span>NEXT: SEND</span>
                  <span>▶</span>
                </button>
              </div>
            </div>

            {/* ========================================================= */}
            {/* STEP 3: SEND                                              */}
            {/* ========================================================= */}
            <div
              className={`${
                activeTab === 'send' ? 'block' : 'hidden'
              } min-[900px]:block bg-[#0E0D0C] border-2 border-[#C97B1A]/60 p-4 sm:p-5 shadow-[4px_4px_0_#000] pb-6`}
            >
              <div className="flex items-center gap-2 border-b border-[#C97B1A]/40 pb-2 mb-3">
                <span className="w-2.5 h-2.5 bg-[#C97B1A] rotate-45 inline-block" />
                <h3 className="font-anton text-lg tracking-wider text-white uppercase">
                  {MEME_DESK_COPY.steps.send}
                </h3>
              </div>

              {/* Export Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Download PNG */}
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center justify-center gap-2 bg-[#C97B1A] hover:bg-[#d88720] text-black font-anton text-base tracking-wider uppercase py-3 px-4 border-2 border-black shadow-[3px_3px_0_#000] active:translate-y-0.5 cursor-pointer min-h-[44px]"
                >
                  <Download className="w-4 h-4" />
                  <span>{MEME_DESK_COPY.buttons.download}</span>
                </button>

                {/* Copy Image (Clipboard API) */}
                {canCopy && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center justify-center gap-2 bg-black hover:bg-[#1f1a14] text-[#E8DFC9] font-plex text-xs font-bold tracking-wider uppercase py-3 px-4 border-2 border-[#C97B1A]/60 active:translate-y-0.5 cursor-pointer min-h-[44px]"
                  >
                    <Copy className="w-4 h-4 text-[#F2B24A]" />
                    <span>{MEME_DESK_COPY.buttons.copy}</span>
                  </button>
                )}

                {/* Share (Navigator.share) */}
                {canShare && (
                  <button
                    type="button"
                    onClick={handleShare}
                    className="inline-flex items-center justify-center gap-2 bg-black hover:bg-[#1f1a14] text-[#E8DFC9] font-plex text-xs font-bold tracking-wider uppercase py-3 px-4 border-2 border-[#C97B1A]/60 active:translate-y-0.5 cursor-pointer min-h-[44px]"
                  >
                    <Share2 className="w-4 h-4 text-[#2FD27A]" />
                    <span>{MEME_DESK_COPY.buttons.share}</span>
                  </button>
                )}

                {/* Post on X */}
                <button
                  type="button"
                  onClick={handlePostOnX}
                  className="inline-flex items-center justify-center gap-2 bg-[#1DA1F2] hover:bg-[#1a94df] text-white font-plex text-xs font-bold tracking-wider uppercase py-3 px-4 border-2 border-black shadow-[3px_3px_0_#000] active:translate-y-0.5 cursor-pointer min-h-[44px]"
                >
                  <Twitter className="w-4 h-4" />
                  <span>{MEME_DESK_COPY.buttons.postX}</span>
                </button>
              </div>

              {/* X limitation note */}
              <p className="font-plex text-[11px] text-[#E8DFC9]/60 mt-3 text-center sm:text-left leading-relaxed">
                {MEME_DESK_COPY.xNotice}
              </p>

              {/* Mobile Back Button */}
              <div className="mt-4 pt-2 flex justify-start min-[900px]:hidden">
                <button
                  type="button"
                  onClick={() => setActiveTab('write')}
                  className="inline-flex items-center gap-1 px-3 py-2 text-[#E8DFC9]/70 hover:text-white font-plex text-xs uppercase min-h-[44px] cursor-pointer"
                >
                  <span>◀ BACK: WRITE</span>
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
