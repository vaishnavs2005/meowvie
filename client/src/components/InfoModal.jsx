import React from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import logoImg from '../assets/logo.png';

export default function InfoModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 110 }}>
      <div
        className="modal-card info-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="brand-logo" style={{ width: '44px', height: '44px' }}>
              <img src={logoImg} alt="Meowvie Logo" className="brand-logo-img" />
            </div>
            <div>
              <h2 className="sticker-title-red" style={{ fontSize: '1.45rem', marginBottom: '2px' }}>
                How Meowvie Works
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>
                Quick 3-step guide for you and your friends
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ctrl-btn"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--bg-cream-tint)',
              border: '2px solid var(--border-olive)',
              boxShadow: '1px 1px 0px #1A1A1A',
              cursor: 'pointer'
            }}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="info-sections">
          {/* Golden Rule */}
          <div className="info-box requirement" style={{ padding: '12px 14px', marginBottom: '16px' }}>
            <div className="info-box-header" style={{ marginBottom: '4px' }}>
              <CheckCircle2 size={17} color="var(--accent-red)" />
              <strong style={{ color: 'var(--text-dark)', fontSize: '0.88rem' }}>The Only Rule: Same Movie File</strong>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-dark)', lineHeight: 1.45, margin: 0 }}>
              Everyone in the room must select the <strong>exact same video file</strong> locally. Nothing is uploaded to any server—it stays 100% private with zero buffering.
            </p>
          </div>

          {/* Step 1 */}
          <div className="info-step" style={{ marginBottom: '12px' }}>
            <div className="step-num">1</div>
            <div className="step-content">
              <h4>Pick Your Movie</h4>
              <p>
                Choose your local video file. It loads instantly in original HD/4K quality.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="info-step" style={{ marginBottom: '12px' }}>
            <div className="step-num">2</div>
            <div className="step-content">
              <h4>Share the Room Code</h4>
              <p>
                Create a room and send the 5-letter code (or invite link) to up to 4 friends (5 viewers max).
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="info-step" style={{ marginBottom: '14px' }}>
            <div className="step-num">3</div>
            <div className="step-content">
              <h4>Watch Together in Sync</h4>
              <p>
                Play, pause, or seek together in lockstep. If anyone falls behind, Meowvie snaps you right back in sync automatically.
              </p>
            </div>
          </div>

          {/* Handy Shortcuts & Tips */}
          <div className="info-tips-grid">
            <div className="info-tip-item">
              <span className="tip-badge">🎙️ Voice Chat</span>
              <span>Hold <strong>Ctrl</strong> to talk, or toggle Open Mic in the header.</span>
            </div>
            <div className="info-tip-item">
              <span className="tip-badge">💬 Fullscreen Chat</span>
              <span>Press <strong>Shift</strong> in fullscreen to pop open chat anytime.</span>
            </div>
            <div className="info-tip-item">
              <span className="tip-badge">📝 Subtitles</span>
              <span>Drag & drop any <code>.srt</code> file right onto the video.</span>
            </div>
            <div className="info-tip-item">
              <span className="tip-badge">⏱️ Jump Scene</span>
              <span>Click any <code>@MM:SS</code> timecode in chat to jump there together.</span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="submit-btn"
          style={{ width: '100%', marginTop: '18px' }}
        >
          🎬 GOT IT, LET'S WATCH!
        </button>
      </div>
    </div>
  );
}
