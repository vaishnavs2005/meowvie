import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Clock, FastForward } from 'lucide-react';

function formatMovieLength(seconds) {
  if (!isFinite(seconds) || seconds === null || seconds <= 0) return '';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
  }
  if (mins > 0) {
    return `${mins}m ${secs > 0 ? `${secs.toString().padStart(2, '0')}s` : ''}`.trim();
  }
  return `${secs}s`;
}

/**
 * High-fidelity Vintage 35mm Cinema Projector Audio Synthesizer
 * Uses Web Audio API with zero external audio assets.
 */
class VintageProjectorAudio {
  constructor() {
    this.ctx = null;
    this.motorOsc = null;
    this.motorGain = null;
    this.tickInterval = null;
    this.isDestroyed = false;
  }

  init() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch (e) {
      console.debug('Projector audio init note:', e);
    }
  }

  playLampIgnition() {
    if (!this.ctx || this.isDestroyed) return;
    try {
      const now = this.ctx.currentTime;
      // 1. Relay snap (filtered pulse)
      const snapBuf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.05), this.ctx.sampleRate);
      const snapData = snapBuf.getChannelData(0);
      for (let i = 0; i < snapBuf.length; i++) {
        snapData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.008));
      }
      const snapSrc = this.ctx.createBufferSource();
      snapSrc.buffer = snapBuf;
      const snapFilter = this.ctx.createBiquadFilter();
      snapFilter.type = 'bandpass';
      snapFilter.frequency.setValueAtTime(1400, now);
      snapFilter.Q.setValueAtTime(2.0, now);

      const snapGain = this.ctx.createGain();
      snapGain.gain.setValueAtTime(0.28, now);
      snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      snapSrc.connect(snapFilter);
      snapFilter.connect(snapGain);
      snapGain.connect(this.ctx.destination);
      snapSrc.start(now);

      // 2. High-voltage arc hum swell
      const arcOsc = this.ctx.createOscillator();
      const arcGain = this.ctx.createGain();
      arcOsc.type = 'sawtooth';
      arcOsc.frequency.setValueAtTime(120, now);
      arcGain.gain.setValueAtTime(0.001, now);
      arcGain.gain.linearRampToValueAtTime(0.08, now + 0.04);
      arcGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      const arcFilter = this.ctx.createBiquadFilter();
      arcFilter.type = 'lowpass';
      arcFilter.frequency.setValueAtTime(650, now);

      arcOsc.connect(arcFilter);
      arcFilter.connect(arcGain);
      arcGain.connect(this.ctx.destination);
      arcOsc.start(now);
      arcOsc.stop(now + 0.38);
    } catch (e) {
      console.debug('Projector lamp audio note:', e);
    }
  }

  playCountdownPip(freq = 1000) {
    if (!this.ctx || this.isDestroyed || this.ctx.state === 'closed') return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.065);
    } catch (_) {}
  }

  startRunning() {
    if (!this.ctx || this.isDestroyed) return;
    try {
      const now = this.ctx.currentTime;

      // Deep motor chassis resonance (~72Hz)
      this.motorOsc = this.ctx.createOscillator();
      this.motorGain = this.ctx.createGain();
      this.motorOsc.type = 'triangle';
      this.motorOsc.frequency.setValueAtTime(68, now);
      this.motorOsc.frequency.linearRampToValueAtTime(76, now + 0.4);

      this.motorGain.gain.setValueAtTime(0.001, now);
      this.motorGain.gain.linearRampToValueAtTime(0.09, now + 0.3);

      this.motorOsc.connect(this.motorGain);
      this.motorGain.connect(this.ctx.destination);
      this.motorOsc.start(now);

      // 24fps Shutter & Sprocket Ticking Rhythm (~41.6ms interval)
      let tickCount = 0;
      this.tickInterval = setInterval(() => {
        if (!this.ctx || this.isDestroyed || this.ctx.state === 'closed') return;
        try {
          const tNow = this.ctx.currentTime;
          const tickBuf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.016), this.ctx.sampleRate);
          const tData = tickBuf.getChannelData(0);
          const decayRate = 0.0025;
          for (let i = 0; i < tickBuf.length; i++) {
            tData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * decayRate));
          }
          const tSrc = this.ctx.createBufferSource();
          tSrc.buffer = tickBuf;

          const tFilter = this.ctx.createBiquadFilter();
          tFilter.type = 'bandpass';
          const isAccent = tickCount % 3 === 0;
          tFilter.frequency.setValueAtTime(isAccent ? 1850 : 2200, tNow);
          tFilter.Q.setValueAtTime(2.2, tNow);

          const tGain = this.ctx.createGain();
          const amp = isAccent ? 0.065 : 0.045;
          tGain.gain.setValueAtTime(amp, tNow);
          tGain.gain.exponentialRampToValueAtTime(0.0005, tNow + 0.016);

          tSrc.connect(tFilter);
          tFilter.connect(tGain);
          tGain.connect(this.ctx.destination);
          tSrc.start(tNow);
          tickCount++;
        } catch (_) {}
      }, 42);
    } catch (e) {
      console.debug('Projector running audio note:', e);
    }
  }

  stop() {
    this.isDestroyed = true;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    if (this.ctx && this.motorGain) {
      try {
        const now = this.ctx.currentTime;
        this.motorGain.gain.cancelScheduledValues(now);
        this.motorGain.gain.setValueAtTime(this.motorGain.gain.value, now);
        this.motorGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
        setTimeout(() => {
          if (this.motorOsc) {
            try { this.motorOsc.stop(); } catch (_) {}
            this.motorOsc.disconnect();
          }
        }, 360);
      } catch (_) {}
    }
  }
}

export default function ProjectorStartupOverlay({ movieTitle, duration = 0, onComplete }) {
  // Directly start in 'projecting' phase so the ray of light and countdown are visible at once
  const [phase, setPhase] = useState('projecting');
  const [countdownNum, setCountdownNum] = useState(3);
  const audioRef = useRef(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const handleFinish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (audioRef.current) {
      audioRef.current.stop();
    }
    if (onCompleteRef.current) {
      onCompleteRef.current();
    }
  }, []);

  useEffect(() => {
    // 1. Initialize audio engine
    const audio = new VintageProjectorAudio();
    audioRef.current = audio;
    audio.init();
    audio.startRunning();
    audio.playLampIgnition();
    audio.playCountdownPip(1000); // Initial pip on 3

    // 2. Exactly 3 seconds of countdown: 3 (0-1s) -> 2 (1-2s) -> 1 (2-3s)
    const t2 = setTimeout(() => {
      setCountdownNum(2);
      audio.playCountdownPip(1000); // Pip on 2
    }, 1000);

    const t1 = setTimeout(() => {
      setCountdownNum(1);
      audio.playCountdownPip(1000); // Pip on 1
    }, 2000);

    const tTitle = setTimeout(() => {
      setCountdownNum(0); // Reveal Title card at exactly 3.0s
    }, 3000);

    // 3. Exactly 2 seconds of Title card display: 3s to 5s
    const tBloom = setTimeout(() => setPhase('blooming'), 4700);
    const tEnd = setTimeout(() => handleFinish(), 5000);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        handleFinish();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(t2);
      clearTimeout(t1);
      clearTimeout(tTitle);
      clearTimeout(tBloom);
      clearTimeout(tEnd);
      window.removeEventListener('keydown', handleKeyDown);
      audio.stop();
    };
  }, [handleFinish]);

  const cleanTitle = typeof movieTitle === 'string' && movieTitle.trim()
    ? movieTitle.replace(/\.[^/.]+$/, '').replace(/[_.-]+/g, ' ')
    : 'FEATURE PRESENTATION';

  const formattedLength = formatMovieLength(duration);

  return (
    <div
      className={`projector-startup-stage ${phase}`}
      onClick={handleFinish}
      role="button"
      tabIndex={0}
      title="Click or press Esc to skip projector intro"
      aria-label="Cinema Projector Startup Animation"
    >
      {/* ── Vintage Cinema Ambient Texture & Vignette ── */}
      <div className="projector-ambient-vignette" />
      <div className="projector-film-grain" />

      {/* ── Skip Button Top-Right ── */}
      <button
        className="projector-skip-pill"
        onClick={(e) => {
          e.stopPropagation();
          handleFinish();
        }}
        title="Skip intro (Esc)"
      >
        <FastForward size={13} style={{ marginRight: '4px' }} />
        <span>SKIP</span>
        <kbd className="projector-skip-kbd">ESC</kbd>
      </button>

      {/* ── Main Perspective Scene Layout ── */}
      <div className="projector-scene-layout">

        {/* ── 1. LEFT: Vintage 35mm Cinema Projector Unit ── */}
        <div className="projector-unit-wrapper">
          <div className="projector-shadow" />

          {/* SVG Projector Machine */}
          <svg
            className="projector-machine-svg"
            viewBox="0 0 280 340"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="projBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3d3d36" />
                <stop offset="50%" stopColor="#252520" />
                <stop offset="100%" stopColor="#1a1a16" />
              </linearGradient>
              <linearGradient id="reelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#D8C4A9" />
                <stop offset="50%" stopColor="#B49F82" />
                <stop offset="100%" stopColor="#7A6850" />
              </linearGradient>
              <linearGradient id="filmWoundGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1E1E1E" />
                <stop offset="50%" stopColor="#333333" />
                <stop offset="100%" stopColor="#181818" />
              </linearGradient>
              <linearGradient id="brassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFE082" />
                <stop offset="50%" stopColor="#E7A227" />
                <stop offset="100%" stopColor="#B37400" />
              </linearGradient>
              <radialGradient id="lampCoreGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="40%" stopColor="#FFE8A3" />
                <stop offset="80%" stopColor="#E8402C" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#E8402C" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Stand / Pedestal */}
            <path d="M 125 245 L 90 325 L 80 330 L 175 330 L 165 325 L 135 245 Z" fill="#1C1C18" stroke="#1A1A1A" strokeWidth="2.5" />
            <circle cx="130" cy="255" r="9" fill="url(#brassGrad)" stroke="#1A1A1A" strokeWidth="1.5" />
            <rect x="75" y="325" width="110" height="7" rx="3" fill="#2E2E28" stroke="#1A1A1A" strokeWidth="2" />

            {/* Projector Support Arms for the Reeling Spools */}
            {/* Top Arm */}
            <path d="M 116 132 L 72 58 L 82 48 L 126 122 Z" fill="#2D2D27" stroke="#1A1A1A" strokeWidth="2" />
            <circle cx="75" cy="52" r="11" fill="#252520" stroke="#1A1A1A" strokeWidth="1.5" />

            {/* Bottom Arm */}
            <path d="M 120 185 L 67 241 L 77 249 L 130 195 Z" fill="#2D2D27" stroke="#1A1A1A" strokeWidth="2" />
            <circle cx="70" cy="245" r="11" fill="#252520" stroke="#1A1A1A" strokeWidth="1.5" />

            {/* Moving Threaded Film Strip */}
            <path
              d="M 75 90 Q 95 105 110 130 L 110 180 Q 95 205 70 209"
              fill="none"
              stroke="#E8402C"
              strokeWidth="3.5"
              strokeDasharray="4 2"
              className="projector-film-thread"
            />

            {/* ── TOP FEED SPOOL (Rotates in place via native SVG animation) ── */}
            <g transform="translate(75, 52)">
              <g>
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 0 0"
                  to="360 0 0"
                  dur="0.44s"
                  repeatCount="indefinite"
                />
                <circle cx="0" cy="0" r="38" fill="url(#filmWoundGrad)" stroke="#111" strokeWidth="1.5" />
                <circle cx="0" cy="0" r="42" fill="none" stroke="url(#reelGrad)" strokeWidth="3" />
                <g className="spool-spokes">
                  <line x1="0" y1="-40" x2="0" y2="40" stroke="url(#reelGrad)" strokeWidth="2.5" />
                  <line x1="-38" y1="-15" x2="38" y2="15" stroke="url(#reelGrad)" strokeWidth="2.5" />
                  <line x1="-38" y1="15" x2="38" y2="-15" stroke="url(#reelGrad)" strokeWidth="2.5" />
                  <circle cx="0" cy="-22" r="6" fill="#1C1C18" stroke="url(#reelGrad)" strokeWidth="1.2" />
                  <circle cx="19" cy="-11" r="6" fill="#1C1C18" stroke="url(#reelGrad)" strokeWidth="1.2" />
                  <circle cx="19" cy="11" r="6" fill="#1C1C18" stroke="url(#reelGrad)" strokeWidth="1.2" />
                  <circle cx="0" cy="22" r="6" fill="#1C1C18" stroke="url(#reelGrad)" strokeWidth="1.2" />
                  <circle cx="-19" cy="11" r="6" fill="#1C1C18" stroke="url(#reelGrad)" strokeWidth="1.2" />
                  <circle cx="-19" cy="-11" r="6" fill="#1C1C18" stroke="url(#reelGrad)" strokeWidth="1.2" />
                </g>
              </g>
              <circle cx="0" cy="0" r="10" fill="url(#brassGrad)" stroke="#1A1A1A" strokeWidth="2" />
              <circle cx="0" cy="0" r="3.5" fill="#1A1A1A" />
            </g>

            {/* ── BOTTOM TAKE-UP SPOOL (Rotates in place via native SVG animation) ── */}
            <g transform="translate(70, 245)">
              <g>
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 0 0"
                  to="360 0 0"
                  dur="0.48s"
                  repeatCount="indefinite"
                />
                <circle cx="0" cy="0" r="36" fill="url(#filmWoundGrad)" stroke="#111" strokeWidth="1.5" />
                <circle cx="0" cy="0" r="42" fill="none" stroke="url(#reelGrad)" strokeWidth="3" />
                <g className="spool-spokes">
                  <line x1="0" y1="-40" x2="0" y2="40" stroke="url(#reelGrad)" strokeWidth="2.5" />
                  <line x1="-38" y1="-15" x2="38" y2="15" stroke="url(#reelGrad)" strokeWidth="2.5" />
                  <line x1="-38" y1="15" x2="38" y2="-15" stroke="url(#reelGrad)" strokeWidth="2.5" />
                  <circle cx="0" cy="-22" r="6" fill="#1C1C18" stroke="url(#reelGrad)" strokeWidth="1.2" />
                  <circle cx="19" cy="-11" r="6" fill="#1C1C18" stroke="url(#reelGrad)" strokeWidth="1.2" />
                  <circle cx="19" cy="11" r="6" fill="#1C1C18" stroke="url(#reelGrad)" strokeWidth="1.2" />
                  <circle cx="0" cy="22" r="6" fill="#1C1C18" stroke="url(#reelGrad)" strokeWidth="1.2" />
                  <circle cx="-19" cy="11" r="6" fill="#1C1C18" stroke="url(#reelGrad)" strokeWidth="1.2" />
                  <circle cx="-19" cy="-11" r="6" fill="#1C1C18" stroke="url(#reelGrad)" strokeWidth="1.2" />
                </g>
              </g>
              <circle cx="0" cy="0" r="10" fill="url(#brassGrad)" stroke="#1A1A1A" strokeWidth="2" />
              <circle cx="0" cy="0" r="3.5" fill="#1A1A1A" />
            </g>

            {/* ── PROJECTOR MAIN CHASSIS / HOUSING ── */}
            <rect
              x="105"
              y="110"
              width="105"
              height="135"
              rx="12"
              fill="url(#projBodyGrad)"
              stroke="#1A1A1A"
              strokeWidth="3.5"
            />

            {/* Cooling Vent Louvers */}
            <g className="projector-louvers">
              <rect x="118" y="125" width="38" height="3" rx="1.5" fill="#E7A227" opacity="0.85" />
              <rect x="118" y="132" width="38" height="3" rx="1.5" fill="#E7A227" opacity="0.85" />
              <rect x="118" y="139" width="38" height="3" rx="1.5" fill="#E7A227" opacity="0.85" />
              <rect x="118" y="146" width="38" height="3" rx="1.5" fill="#E7A227" opacity="0.85" />
            </g>

            {/* Vintage Analog Voltage Dial */}
            <g transform="translate(138, 185)">
              <circle cx="0" cy="0" r="15" fill="#FBF3E7" stroke="#1A1A1A" strokeWidth="2" />
              <path d="M -11 3 A 11 11 0 0 1 11 3" fill="none" stroke="#574D42" strokeWidth="1" strokeDasharray="1.5 1.5" />
              <line x1="0" y1="0" x2="6" y2="-9" stroke="#E8402C" strokeWidth="1.8" strokeLinecap="round" className="projector-meter-needle" />
              <circle cx="0" cy="0" r="2.5" fill="#1A1A1A" />
            </g>

            {/* Brass Control Knobs */}
            <circle cx="180" cy="180" r="7" fill="url(#brassGrad)" stroke="#1A1A1A" strokeWidth="1.5" />
            <circle cx="180" cy="205" r="7" fill="url(#brassGrad)" stroke="#1A1A1A" strokeWidth="1.5" />

            {/* "MEOWVIE 35MM" Vintage Nameplate */}
            <rect x="116" y="218" width="82" height="15" rx="3" fill="#E7A227" stroke="#1A1A1A" strokeWidth="1.5" />
            <text x="157" y="229" fill="#1A1A1A" fontSize="7.5" fontWeight="900" fontFamily="monospace" textAnchor="middle" letterSpacing="0.8">
              MEOWVIE • 35MM
            </text>

            {/* ── PROJECTOR LENS BARREL (Facing Right) ── */}
            <rect x="208" y="140" width="16" height="50" rx="3" fill="#2E2E28" stroke="#1A1A1A" strokeWidth="2.5" />
            <rect x="224" y="144" width="22" height="42" rx="2" fill="url(#brassGrad)" stroke="#1A1A1A" strokeWidth="2" />
            <rect x="246" y="148" width="14" height="34" rx="2" fill="#1A1A1A" stroke="#2E2E28" strokeWidth="2" />

            {/* Front Aperture Ring & Glowing Lamp Bulb */}
            <ellipse cx="260" cy="165" rx="4" ry="17" fill="#FFE8A3" stroke="#FFF" strokeWidth="1.5" className="projector-lens-rim" />
            <ellipse cx="260" cy="165" rx="2" ry="11" fill="url(#lampCoreGlow)" className="projector-lens-core" />
          </svg>

          {/* Intense Lens Flare Star & Anamorphic Streak at Lens Tip */}
          <div className="projector-lamp-flare">
            <div className="flare-core-burst" />
            <div className="flare-horizontal-streak" />
            <div className="flare-halo-ring" />
          </div>
        </div>

        {/* ── 2. MIDDLE: CONNECTING RAY OF LIGHT (Directly bridges projector lens to screen) ── */}
        <div className="projector-connecting-ray">
          <div className="ray-volumetric-beam">
            <div className="ray-beam-outer" />
            <div className="ray-beam-core" />
            <div className="ray-beam-flicker" />

            {/* Floating dust motes caught in the connecting ray */}
            <div className="ray-dust-chamber">
              {[...Array(14)].map((_, i) => (
                <span
                  key={i}
                  className={`ray-dust-mote dust-${i + 1}`}
                  style={{
                    left: `${8 + ((i * 19) % 82)}%`,
                    top: `${18 + ((i * 27) % 64)}%`,
                    animationDelay: `${(i * 0.14).toFixed(2)}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── 3. RIGHT: THE PROJECTED CINEMA SCREEN TARGET ── */}
        <div className="projector-screen-target">
          <div className="projected-canvas-frame">
            {/* Luminous light wash projected onto the screen surface */}
            <div className="projected-light-wash" />
            <div className="projected-gate-flicker" />
            <div className="projected-crosshair-lines" />

            {/* Countdown Stage (3... 2... 1...) */}
            {countdownNum > 0 ? (
              <div className="projected-countdown-wrapper">
                <div className="countdown-vintage-ring">
                  <div className="countdown-sweep-arm" />
                  <div className="countdown-inner-ring" />
                  <span key={countdownNum} className="countdown-number">{countdownNum}</span>
                </div>
                <div className="countdown-label">MEOWVIE THEATER • 24 FPS</div>
              </div>
            ) : (
              /* Only Movie Title and Movie Length (Feature presentation red box and subtext removed) */
              <div className="projected-title-card">
                <div className="title-card-filename">
                  <div className="title-card-text" title={cleanTitle}>
                    {cleanTitle}
                  </div>
                </div>

                {formattedLength && (
                  <div className="title-card-duration">
                    <Clock size={16} className="duration-icon" />
                    <span>{formattedLength}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Final White/Golden Bloom Dissolve (Fades cleanly into video) ── */}
      <div className="projector-bloom-flash" />
    </div>
  );
}