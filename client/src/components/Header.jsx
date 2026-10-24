import React, { useState, useEffect, useRef } from 'react';
import { Check, Users, Shield, Radio, Copy, Upload, Mic, MicOff, HelpCircle, ChevronDown, Palette } from 'lucide-react';
import logoImg from '../assets/logo.png';
import titleImg from '../assets/title.png';

export default function Header({
  roomId,
  currentUser,
  usersCount = 1,
  isConnected,
  controlMode,
  isHost,
  onToggleControlMode,
  onShowToast,
  onOpenInfo,
  onChangeVideo,
  voiceMode = 'ptt',
  isOpenMicActive = false,
  isSpeaking = false,
  onToggleVoiceMode,
  onSetVoiceMode,
  onToggleMic,
  onPttStart,
  onPttEnd,
  theme = 'default',
  onSetTheme,
  className = '',
}) {
  const [copied, setCopied] = useState(false);
  const [isVoiceMenuOpen, setIsVoiceMenuOpen] = useState(false);
  const voiceMenuRef = useRef(null);

  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef(null);

  useEffect(() => {
    if (!isVoiceMenuOpen) return;
    const handleClickOutside = (e) => {
      if (voiceMenuRef.current && !voiceMenuRef.current.contains(e.target)) {
        setIsVoiceMenuOpen(false);
      }
    };
    const handleKey = (e) => { if (e.key === 'Escape') setIsVoiceMenuOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isVoiceMenuOpen]);

  useEffect(() => {
    if (!isThemeMenuOpen) return;
    const handleClickOutside = (e) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target)) {
        setIsThemeMenuOpen(false);
      }
    };
    const handleKey = (e) => { if (e.key === 'Escape') setIsThemeMenuOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isThemeMenuOpen]);

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      if (onShowToast) onShowToast('Room link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Mic state for display
  const micIsLive = voiceMode === 'ptt' ? isSpeaking : isOpenMicActive;

  return (
    <header className={`app-header ${className}`.trim()}>

      {/* ── LEFT: Brand + Info ──────────────────────────────────── */}
      <div className="brand-section">
        <div className="brand-logo">
          <img src={logoImg} alt="Meowvie Logo" className="brand-logo-img" />
        </div>
        <img
          src={titleImg}
          alt="Meowvie"
          className="brand-title-img-hdr"
          style={{
            height: '38px',
            width: 'auto',
            objectFit: 'contain',
            filter: 'drop-shadow(2px 2px 0px #1A1A1A)',
            display: 'block',
          }}
        />
        <button
          className="hdr-info-btn"
          onClick={onOpenInfo}
          title="How Meowvie works & requirements"
          aria-label="Help"
        >
          <HelpCircle size={16} />
        </button>
      </div>

      {/* ── CENTER: Room + Viewers ───────────────────────────────── */}
      <div className="header-center">
        {roomId && (
          <div className="room-pill" title="Click to copy invite link" onClick={handleCopyLink}>
            <span className="room-label">ROOM</span>
            <span className="room-code">{roomId.toUpperCase()}</span>
            <span className="copy-btn" aria-label="Copy Room Link">
              {copied ? <Check size={13} color="var(--status-connected)" /> : <Copy size={13} />}
            </span>
          </div>
        )}

        <div className="sync-badge" title={isConnected ? `${usersCount} of max 5 viewers connected` : 'Disconnected'}>
          <span className={`pulse-dot ${isConnected ? 'connected' : 'waiting'}`} />
          <span className="sync-badge-text">
            {isConnected ? `${usersCount}/5 ${usersCount === 1 ? 'Viewer' : 'Viewers'}` : 'Offline'}
          </span>
        </div>
      </div>

      {/* ── RIGHT: Actions + Voice + Mode + User ────────────────── */}
      <div className="header-right">

        {/* Change Video */}
        {roomId && (
          <button
            onClick={onChangeVideo}
            className="hdr-change-video-btn"
            title="Choose or switch video file"
          >
            <Upload size={14} />
            <span>Change Video</span>
          </button>
        )}

        {/* Voice controls */}
        <div className="voice-pill" ref={voiceMenuRef}>

          {/* Mic button */}
          {voiceMode === 'ptt' ? (
            <button
              type="button"
              className={`voice-mic-btn ${isSpeaking ? 'voice-mic-live' : 'voice-mic-idle'}`}
              onMouseDown={(e) => { if (e.button === 0) onPttStart?.(); }}
              onMouseUp={() => onPttEnd?.()}
              onMouseLeave={() => onPttEnd?.()}
              onTouchStart={(e) => { e.preventDefault(); onPttStart?.(); }}
              onTouchEnd={(e) => { e.preventDefault(); onPttEnd?.(); }}
              title={isSpeaking ? 'Transmitting… release to stop' : "Hold 'Z' or press & hold to speak"}
              aria-label="Push to Talk microphone"
            >
              {isSpeaking ? (
                <>
                  <Mic size={15} className="mic-icon" />
                  <div className="voice-bars" aria-hidden="true">
                    <span /><span /><span />
                  </div>
                </>
              ) : (
                <>
                  <MicOff size={15} className="mic-icon" />
                  <kbd className="ptt-hint">Z</kbd>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleMic}
              className={`voice-mic-btn ${isOpenMicActive ? 'voice-mic-live' : 'voice-mic-idle'}`}
              title={isOpenMicActive ? "Open Mic is live — click to mute" : "Microphone muted — click to unmute"}
              aria-label="Toggle microphone mute"
            >
              {isOpenMicActive ? (
                <>
                  <Mic size={15} className="mic-icon" />
                  <div className="voice-bars" aria-hidden="true">
                    <span /><span /><span />
                  </div>
                </>
              ) : (
                <>
                  <MicOff size={15} className="mic-icon" />
                  <span className="ptt-hint">OFF</span>
                </>
              )}
            </button>
          )}

          {/* Divider */}
          <span className="voice-divider" />

          {/* Mode selector trigger */}
          <button
            type="button"
            className={`voice-mode-btn ${isVoiceMenuOpen ? 'open' : ''}`}
            onClick={() => setIsVoiceMenuOpen(prev => !prev)}
            title={`Mode: ${voiceMode === 'ptt' ? 'Push-to-Talk' : 'Open Mic'} — click to switch`}
            aria-haspopup="true"
            aria-expanded={isVoiceMenuOpen}
          >
            <span className="voice-mode-tag">{voiceMode === 'ptt' ? 'PTT' : 'MIC'}</span>
            <ChevronDown size={11} className={`voice-chevron ${isVoiceMenuOpen ? 'rotated' : ''}`} />
          </button>

          {/* Mode popover */}
          {isVoiceMenuOpen && (
            <div className="voice-popover" role="menu">
              <div className="voice-popover-header">Voice Mode</div>

              <button
                type="button"
                className={`voice-popover-item ${voiceMode === 'ptt' ? 'selected' : ''}`}
                onClick={() => {
                  if (onSetVoiceMode) onSetVoiceMode('ptt');
                  else if (voiceMode !== 'ptt') onToggleVoiceMode?.();
                  setIsVoiceMenuOpen(false);
                }}
              >
                <Radio size={14} className="vp-icon" />
                <div className="vp-text">
                  <div className="vp-title">Push-to-Talk <kbd className="vp-kbd">Z</kbd></div>
                  <div className="vp-desc">Hold Z or button to speak</div>
                </div>
                {voiceMode === 'ptt' && <Check size={13} className="vp-check" />}
              </button>

              <button
                type="button"
                className={`voice-popover-item ${voiceMode === 'open' ? 'selected' : ''}`}
                onClick={() => {
                  if (onSetVoiceMode) onSetVoiceMode('open');
                  else if (voiceMode !== 'open') onToggleVoiceMode?.();
                  setIsVoiceMenuOpen(false);
                }}
              >
                <Mic size={14} className="vp-icon" />
                <div className="vp-text">
                  <div className="vp-title">Open Mic</div>
                  <div className="vp-desc">Always-on (use headphones)</div>
                </div>
                {voiceMode === 'open' && <Check size={13} className="vp-check" />}
              </button>
            </div>
          )}
        </div>

        {/* Control mode toggle (host) / badge (guest) */}
        {isHost ? (
          <div className="mode-toggle" title="Playback Control Permission">
            <button
              className={`mode-btn ${controlMode === 'co-op' ? 'active' : ''}`}
              onClick={() => onToggleControlMode('co-op')}
              title="Both partners can play, pause, and seek"
            >
              <Users size={12} /> Co-op
            </button>
            <button
              className={`mode-btn ${controlMode === 'host-only' ? 'active' : ''}`}
              onClick={() => onToggleControlMode('host-only')}
              title="Only you (the host) can play, pause, and seek"
            >
              <Shield size={12} /> Host Only
            </button>
          </div>
        ) : (
          <div
            className="mode-badge-guest"
            title={controlMode === 'host-only' ? 'Only the room host can control playback' : 'Both partners can control playback'}
          >
            {controlMode === 'host-only'
              ? <Shield size={12} color="var(--accent-red)" />
              : <Users size={12} color="var(--accent-mustard)" />}
            <span>{controlMode === 'host-only' ? 'Host-Only' : 'Co-op'}</span>
          </div>
        )}

        {/* Theme Selector Dropdown */}
        {roomId && (() => {
          const THEMES = [
            { id: 'default', name: 'Classic', desc: 'Retro Diner & Warm Red' },
            { id: 'horror', name: 'Horror', desc: 'Dark Black & Blood Red' },
            { id: 'scifi', name: 'Sci-Fi', desc: 'Neon Cyan & Cyber Pink' },
            { id: 'noir', name: 'Film Noir', desc: 'Monochrome Smoke & Silver' },
            { id: 'western', name: 'Western', desc: 'Desert Amber & Rawhide' },
            { id: 'fantasy', name: 'Fantasy', desc: 'Arcane Emerald & Gold' },
            { id: 'romance', name: 'Romance', desc: 'Velvet Plum & Rose Petal' },
          ];
          const activeThemeObj = THEMES.find(t => t.id === theme) || THEMES[0];

          return (
            <div className="theme-pill" ref={themeMenuRef}>
              <button
                type="button"
                className={`theme-dropdown-btn ${isThemeMenuOpen ? 'open' : ''}`}
                onClick={() => setIsThemeMenuOpen(prev => !prev)}
                title={`Theme: ${activeThemeObj.name} — click to switch`}
                aria-label="Theme dropdown"
                aria-haspopup="true"
                aria-expanded={isThemeMenuOpen}
              >
                <Palette size={13} className="theme-icon" />
                <span className="theme-label">Theme</span>
                <span className="theme-val">{activeThemeObj.name}</span>
                <ChevronDown size={11} className={`theme-chevron ${isThemeMenuOpen ? 'rotated' : ''}`} />
              </button>

              {isThemeMenuOpen && (
                <div className="theme-popover" role="menu">
                  <div className="theme-popover-header">Theme ({THEMES.length})</div>
                  <div className="theme-popover-scroll">
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`theme-popover-item ${theme === t.id ? 'selected' : ''}`}
                        onClick={() => {
                          onSetTheme?.(t.id);
                          setIsThemeMenuOpen(false);
                        }}
                      >
                        <span className={`theme-swatch ${t.id}`} />
                        <div className="theme-text">
                          <div className="theme-title">{t.name}</div>
                          <div className="theme-desc">{t.desc}</div>
                        </div>
                        {theme === t.id && <Check size={13} className="theme-check" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* User avatar */}
        {currentUser && (
          <div className="hdr-user">
            <span className="hdr-user-avatar" title={currentUser.username}>
              <img
                src={currentUser.avatar || `/emojis/avatars/${((currentUser.username?.charCodeAt(0) || 1) % 5) + 1}.png`}
                alt={currentUser.username || 'Avatar'}
                className="hdr-user-avatar-img"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.parentElement) {
                    e.currentTarget.parentElement.innerText = currentUser.username ? currentUser.username.charAt(0).toUpperCase() : 'U';
                  }
                }}
              />
            </span>
            <span className="hdr-user-name">
              {currentUser.username}
              {isHost && <span className="hdr-user-host">Host</span>}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
