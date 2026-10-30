import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  Upload,
  Film,
  Sparkles,
  Sun,
  Lock,
  Shield,
  Crown,
  AlertTriangle,
  Headphones,
  Check,
  Radio,
  Sliders
} from 'lucide-react';
import FloatingReactions from './FloatingReactions';
import FullscreenChatOverlay from './FullscreenChatOverlay';
import { generateSampleMovieBlob } from '../services/sampleVideoGenerator';
import { parseMkvMetadata } from '../services/mkvParser';

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds === null || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function VideoPlayer({
  onPlaybackAction, // (type: 'play' | 'pause' | 'seek', time: number)
  onMetadataLoaded, // (fileInfo: { fileName, duration, fileSize })
  onTimeUpdate,     // (currentTime: number)
  remoteAction,     // { type, time, timestamp }
  reactions = [],
  onShowToast,
  videoRefExternal,
  messages = [],
  currentUser,
  isHost,
  controlMode = 'co-op',
  onToggleControlMode,
  onRegisterChangeVideoTrigger,
  onSendMessage,
  onSendReaction,
  onSeekToTime,
  toasts = [],
  onDismissToast,
  onFullscreenChange,
  activeSpeakers,
  users = [],
}) {
  const localVideoRef = useRef(null);
  const videoRef = videoRefExternal || localVideoRef;
  const containerRef = useRef(null);
  const seekerRef = useRef(null);
  const fileInputRef = useRef(null);
  const sampleDurationRef = useRef(null);
  const currentFileNameRef = useRef('Local Video');

  const [currentFileObj, setCurrentFileObj] = useState(null);
  const [videoSrc, setVideoSrc] = useState(null);
  const [videoName, setVideoName] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ambientGlow, setAmbientGlow] = useState(true);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [videoError, setVideoError] = useState(null);

  // Volume OSD overlay state
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const [volumePopupLevel, setVolumePopupLevel] = useState(1);
  const [volumePopupMuted, setVolumePopupMuted] = useState(false);
  const volumePopupTimerRef = useRef(null);

  // Seek OSD overlay state
  const [showSeekPopup, setShowSeekPopup] = useState(false);
  const [seekPopupDirection, setSeekPopupDirection] = useState('forward');
  const [seekAnimKey, setSeekAnimKey] = useState(0);
  const seekPopupTimerRef = useRef(null);

  // MKV Metadata (Audio Settings & Multi-Audio Tracks)
  const [mkvData, setMkvData] = useState(null);
  const [selectedAudioTrackIndex, setSelectedAudioTrackIndex] = useState(0);
  const [showAudioMenu, setShowAudioMenu] = useState(false);

  // Seeker hover tooltip state
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverPosition, setHoverPosition] = useState(0);

  // Independent hover detection for top bar and bottom cinema controls
  const [isTopBarHovered, setIsTopBarHovered] = useState(false);
  const [isBottomBarHovered, setIsBottomBarHovered] = useState(false);
  const [isCursorActive, setIsCursorActive] = useState(true);

  const hideTopBarTimerRef = useRef(null);
  const hideBottomBarTimerRef = useRef(null);
  const idleCursorTimerRef = useRef(null);
  const isDirectHoverTopRef = useRef(false);
  const isDirectHoverBottomRef = useRef(false);

  // Register the external change video trigger callback
  useEffect(() => {
    if (onRegisterChangeVideoTrigger) {
      onRegisterChangeVideoTrigger(() => {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
          fileInputRef.current.click();
        }
      });
    }
  }, [onRegisterChangeVideoTrigger]);

  const handleContainerMouseMove = (e) => {
    // Keep cursor arrow visible while actively moving
    setIsCursorActive(true);
    if (idleCursorTimerRef.current) {
      clearTimeout(idleCursorTimerRef.current);
    }
    idleCursorTimerRef.current = setTimeout(() => {
      setIsCursorActive(false);
    }, 3000);

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const containerHeight = rect.height;

    // Hotspot zones: Top 75px for movie name/top bar, Bottom 115px for down slider & controls
    const TOP_THRESHOLD = 75;
    const BOTTOM_THRESHOLD = containerHeight - 115;

    // Top Bar: only pop up if arrow is placed at the extreme top / above top bar
    if (mouseY <= TOP_THRESHOLD) {
      if (hideTopBarTimerRef.current) {
        clearTimeout(hideTopBarTimerRef.current);
        hideTopBarTimerRef.current = null;
      }
      setIsTopBarHovered(true);
    } else if (!isDirectHoverTopRef.current) {
      if (!hideTopBarTimerRef.current) {
        hideTopBarTimerRef.current = setTimeout(() => {
          setIsTopBarHovered(false);
          hideTopBarTimerRef.current = null;
        }, 250);
      }
    }

    // Down Slider / Bottom Controls: only pop up if arrow is placed at the extreme bottom / above controls
    if (mouseY >= BOTTOM_THRESHOLD) {
      if (hideBottomBarTimerRef.current) {
        clearTimeout(hideBottomBarTimerRef.current);
        hideBottomBarTimerRef.current = null;
      }
      setIsBottomBarHovered(true);
    } else if (!isDirectHoverBottomRef.current && !showAudioMenu) {
      if (!hideBottomBarTimerRef.current) {
        hideBottomBarTimerRef.current = setTimeout(() => {
          setIsBottomBarHovered(false);
          hideBottomBarTimerRef.current = null;
        }, 250);
      }
    }
  };

  const handleContainerMouseLeave = () => {
    if (hideTopBarTimerRef.current) clearTimeout(hideTopBarTimerRef.current);
    if (hideBottomBarTimerRef.current) clearTimeout(hideBottomBarTimerRef.current);
    isDirectHoverTopRef.current = false;
    isDirectHoverBottomRef.current = false;
    setIsTopBarHovered(false);
    if (!showAudioMenu) {
      setIsBottomBarHovered(false);
    }
    setIsCursorActive(false);
  };

  const handleContainerClick = () => {
    setIsCursorActive(true);
  };

  useEffect(() => {
    return () => {
      if (hideTopBarTimerRef.current) clearTimeout(hideTopBarTimerRef.current);
      if (hideBottomBarTimerRef.current) clearTimeout(hideBottomBarTimerRef.current);
      if (idleCursorTimerRef.current) clearTimeout(idleCursorTimerRef.current);
    };
  }, []);

  // Guard flag to prevent local DOM events from echo-triggering remote actions
  const isApplyingRemote = useRef(false);

  // Switch Audio Track
  const handleSelectAudioTrack = (index) => {
    setSelectedAudioTrackIndex(index);
    setShowAudioMenu(false);
    const track = mkvData?.audioTracks?.[index];

    // If browser supports HTMLMediaElement.audioTracks API
    const video = videoRef.current;
    if (video && video.audioTracks && video.audioTracks.length > index) {
      for (let i = 0; i < video.audioTracks.length; i++) {
        video.audioTracks[i].enabled = (i === index);
      }
    }

    if (track && onShowToast) {
      onShowToast(`Switched Audio Setting: ${track.name} (${track.codecName} • ${track.channelString})`);
    }
  };

  // Handle Loading Local Video File (Supports .mkv, .mp4, .webm, etc.)
  const handleFileSelect = useCallback(async (file) => {
    if (!file) return;

    setVideoError(null);
    sampleDurationRef.current = null;
    currentFileNameRef.current = file.name;
    setCurrentFileObj(file);

    const objectUrl = URL.createObjectURL(file);
    setVideoSrc(objectUrl);
    setVideoName(file.name);
    setIsPlaying(false);

    // Briefly show title and controls for 3.5s upon loading, then auto-hide
    setIsTopBarHovered(true);
    setIsBottomBarHovered(true);
    setTimeout(() => {
      if (!isDirectHoverTopRef.current) setIsTopBarHovered(false);
      if (!isDirectHoverBottomRef.current) setIsBottomBarHovered(false);
    }, 3500);

    // Parse Matroska (MKV / WebM) EBML track metadata
    try {
      const parsed = await parseMkvMetadata(file);
      if (parsed) {
        setMkvData(parsed);

        // Find default or first audio track
        const defaultAudioIdx = parsed.audioTracks.findIndex((t) => t.isDefault);
        setSelectedAudioTrackIndex(defaultAudioIdx >= 0 ? defaultAudioIdx : 0);

        const audioMsg = parsed.audioTracks.length > 0 ? `${parsed.audioTracks.length} Audio setting(s)` : '';
        if (audioMsg && onShowToast) {
          onShowToast(`Loaded MKV: ${file.name} (${audioMsg})`);
        } else if (onShowToast) {
          onShowToast(`Loaded: ${file.name}`);
        }
      } else {
        setMkvData(null);
        if (onShowToast) onShowToast(`Loaded: ${file.name}`);
      }
    } catch (err) {
      console.warn('Metadata inspection note:', err);
      setMkvData(null);
      if (onShowToast) onShowToast(`Loaded: ${file.name}`);
    }
  }, [onShowToast]);

  // Handle Drag and Drop
  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Generate Sample Cinema Video for instant testing
  const handleGenerateSampleVideo = async () => {
    try {
      setIsGeneratingDemo(true);
      setVideoError(null);
      if (onShowToast) onShowToast('Generating animated cinema test reel (1-2s)...');

      const sample = await generateSampleMovieBlob(10, 'Meowvie Cinema Reel');
      sampleDurationRef.current = sample.duration;
      currentFileNameRef.current = sample.name;

      setVideoSrc(sample.url);
      setVideoName(sample.name);
      setDuration(sample.duration);
      setIsPlaying(false);

      if (onShowToast) onShowToast('Cinema test reel ready! Press play to test sync.');
    } catch (err) {
      console.error('Failed to generate sample video:', err);
      if (onShowToast) onShowToast('Failed to generate sample reel');
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  // Listen for video duration and metadata
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    let dur = video.duration;
    if (!isFinite(dur) || isNaN(dur) || dur <= 0) {
      dur = sampleDurationRef.current || mkvData?.duration || 0;
    }
    setDuration(dur);
    setVideoError(null);

    if (onMetadataLoaded) {
      onMetadataLoaded({
        fileName: currentFileNameRef.current || videoName || 'Local Video',
        duration: dur,
        fileSize: 0,
      });
    }
  };

  // Video Time & Progress Updates
  const handleNativeTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const cur = video.currentTime;
    setCurrentTime(cur);
    if (onTimeUpdate) onTimeUpdate(cur);

    if (video.buffered.length > 0) {
      for (let i = video.buffered.length - 1; i >= 0; i--) {
        if (video.buffered.start(i) <= cur) {
          setBuffered(video.buffered.end(i));
          break;
        }
      }
    }
  };

  // Check if current user has permission to control playback
  const canControlPlayback = controlMode === 'co-op' || isHost;

  // Play / Pause Local Trigger
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    // Check host-only permission
    if (!canControlPlayback) {
      if (onShowToast) onShowToast('🔒 Host-Only Mode is active: Only the room host can control playback.');
      return;
    }

    if (video.paused) {
      video.play()
        .then(() => {
          setIsPlaying(true);
          setVideoError(null);
          if (!isApplyingRemote.current && onPlaybackAction) {
            onPlaybackAction('play', video.currentTime);
          }
        })
        .catch((err) => {
          console.warn('Playback play() was blocked or failed:', err);
          if (err.name === 'NotAllowedError') {
            if (onShowToast) onShowToast('Autoplay blocked by browser. Click video to play.');
          } else {
            setVideoError('Browser could not decode this video/audio format (common with HEVC/DTS in MKV). Try an MP4 (H.264) or WebM file.');
          }
        });
    } else {
      video.pause();
      setIsPlaying(false);
      if (!isApplyingRemote.current && onPlaybackAction) {
        onPlaybackAction('pause', video.currentTime);
      }
    }
  };

  // Volume OSD Popup trigger (auto fades out after 1 second)
  const triggerVolumeOverlay = useCallback((level, muted) => {
    setVolumePopupLevel(level);
    setVolumePopupMuted(muted);
    setShowVolumePopup(true);

    if (volumePopupTimerRef.current) {
      clearTimeout(volumePopupTimerRef.current);
    }
    volumePopupTimerRef.current = setTimeout(() => {
      setShowVolumePopup(false);
      volumePopupTimerRef.current = null;
    }, 1000);
  }, []);

  // Seek OSD Popup trigger (auto fades out after 1 second)
  const triggerSeekOverlay = useCallback((direction) => {
    setSeekPopupDirection(direction);
    setSeekAnimKey((k) => k + 1);
    setShowSeekPopup(true);

    if (seekPopupTimerRef.current) {
      clearTimeout(seekPopupTimerRef.current);
    }
    seekPopupTimerRef.current = setTimeout(() => {
      setShowSeekPopup(false);
      seekPopupTimerRef.current = null;
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (volumePopupTimerRef.current) {
        clearTimeout(volumePopupTimerRef.current);
      }
      if (seekPopupTimerRef.current) {
        clearTimeout(seekPopupTimerRef.current);
      }
    };
  }, []);

  // Relative Seek (-5s, +5s)
  const handleRelativeSeek = useCallback((delta) => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    if (!canControlPlayback) {
      if (onShowToast) onShowToast('🔒 Host-Only Mode is active: Only the room host can seek.');
      return;
    }

    const maxDuration = isFinite(duration) && duration > 0 ? duration : (video.duration || 0);
    const newTime = Math.max(0, Math.min(maxDuration, (video.currentTime || 0) + delta));
    if (!isFinite(newTime)) return;

    setCurrentTime(newTime);
    video.currentTime = newTime;

    triggerSeekOverlay(delta > 0 ? 'forward' : 'backward');

    if (!isApplyingRemote.current && onPlaybackAction) {
      onPlaybackAction('seek', newTime);
    }
  }, [videoSrc, canControlPlayback, duration, onShowToast, onPlaybackAction, triggerSeekOverlay]);

  // Seeker Click / Scrub
  const handleSeekClick = (e) => {
    const video = videoRef.current;
    const seeker = seekerRef.current;
    if (!video || !seeker || !duration || !isFinite(duration) || duration <= 0) return;

    if (!canControlPlayback) {
      if (onShowToast) onShowToast('🔒 Host-Only Mode: Only the room host can seek.');
      return;
    }

    const rect = seeker.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = pos * duration;
    if (!isFinite(targetTime)) return;

    setCurrentTime(targetTime);
    video.currentTime = targetTime;

    if (!isApplyingRemote.current && onPlaybackAction) {
      onPlaybackAction('seek', targetTime);
    }
  };

  // Seeker Hover for Tooltip
  const handleSeekerMouseMove = (e) => {
    const seeker = seekerRef.current;
    if (!seeker || !duration) return;
    const rect = seeker.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(e.clientX - rect.left);
    setHoverTime(pos * duration);
  };

  const handleSeekerMouseLeave = () => {
    setHoverTime(null);
  };

  // Volume & Mute
  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    const muted = val === 0;
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = muted;
    }
    setIsMuted(muted);
    triggerVolumeOverlay(val, muted);
  };

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
    let targetVol = volume;
    if (!newMuted && volume === 0) {
      targetVol = 0.5;
      setVolume(0.5);
      if (videoRef.current) videoRef.current.volume = 0.5;
    }
    triggerVolumeOverlay(newMuted ? 0 : targetVol, newMuted);
  }, [isMuted, volume, triggerVolumeOverlay]);

  const adjustVolume = useCallback((delta) => {
    setVolume((prevVol) => {
      const current = isMuted ? 0 : prevVol;
      let newVol = Math.round((current + delta) * 100) / 100;
      newVol = Math.max(0, Math.min(1, newVol));
      const muted = newVol === 0;

      if (videoRef.current) {
        videoRef.current.volume = newVol;
        videoRef.current.muted = muted;
      }
      setIsMuted(muted);
      triggerVolumeOverlay(newVol, muted);
      return newVol;
    });
  }, [isMuted, triggerVolumeOverlay]);

  // Fullscreen: Expands the video container to fill the entire physical screen (F11 effect)
  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    const isDocFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    const isWindowFs = (
      window.matchMedia?.('(display-mode: fullscreen)')?.matches ||
      (window.innerWidth >= window.screen.width - 2 && window.innerHeight >= window.screen.height - 2)
    );
    const isCurrentlyFs = isDocFs || isWindowFs || isFullscreen;

    if (!isCurrentlyFs) {
      const opts = { navigationUI: 'hide' };
      // Request native fullscreen with navigationUI: 'hide' to hide browser tabs and address bar
      if (container.requestFullscreen) {
        container.requestFullscreen(opts).catch((err) => {
          console.warn('container.requestFullscreen failed, trying documentElement:', err);
          document.documentElement.requestFullscreen?.(opts).catch(console.error);
        });
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen(opts).catch(console.error);
      }
      setIsFullscreen(true);
      if (onFullscreenChange) onFullscreenChange(true);
    } else {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(console.error);
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
      setIsFullscreen(false);
      if (onFullscreenChange) onFullscreenChange(false);
    }
  };

  // Sync fullscreen state with document events and hardware F11 window expansion
  useEffect(() => {
    const checkFullscreen = () => {
      const isDocFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      const isWindowFs = (
        window.matchMedia?.('(display-mode: fullscreen)')?.matches ||
        (window.innerWidth >= window.screen.width - 2 && window.innerHeight >= window.screen.height - 2)
      );
      const fs = isDocFs || isWindowFs;
      setIsFullscreen(fs);
      if (onFullscreenChange) onFullscreenChange(fs);
    };

    document.addEventListener('fullscreenchange', checkFullscreen);
    document.addEventListener('webkitfullscreenchange', checkFullscreen);
    window.addEventListener('resize', checkFullscreen);

    return () => {
      document.removeEventListener('fullscreenchange', checkFullscreen);
      document.removeEventListener('webkitfullscreenchange', checkFullscreen);
      window.removeEventListener('resize', checkFullscreen);
    };
  }, [onFullscreenChange]);

  // Remote Action Handling (Applying peer's play/pause/seek)
  useEffect(() => {
    if (!remoteAction || !videoRef.current) return;
    const video = videoRef.current;

    isApplyingRemote.current = true;
    const targetTime = remoteAction.time;

    if (remoteAction.type === 'seek') {
      setCurrentTime(targetTime);
      video.currentTime = targetTime;
    } else if (remoteAction.type === 'play') {
      if (Math.abs(video.currentTime - targetTime) > 0.4) {
        setCurrentTime(targetTime);
        video.currentTime = targetTime;
      }
      video.play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          console.warn('Remote play blocked by browser:', err);
          if (err.name === 'NotAllowedError') {
            video.muted = true;
            setIsMuted(true);
            video.play().then(() => setIsPlaying(true)).catch(() => {});
            if (onShowToast) onShowToast('🔇 Partner started playback (click unmute to enable audio)');
          }
        });
    } else if (remoteAction.type === 'pause') {
      video.currentTime = targetTime;
      video.pause();
      setIsPlaying(false);
    }

    const t = setTimeout(() => {
      isApplyingRemote.current = false;
    }, 350);

    return () => clearTimeout(t);
  }, [remoteAction, onShowToast]);

  // Keyboard Shortcuts: Space (Play/Pause), Left/Right Arrow (Seek), Up/Down Arrow (Volume), M (Mute), F (Fullscreen)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Never intercept if user is typing in chat, text inputs, or contentEditable
      const tag = document.activeElement?.tagName;
      const isTextInput = (
        (tag === 'INPUT' && document.activeElement?.type !== 'range') ||
        tag === 'TEXTAREA' ||
        document.activeElement?.isContentEditable
      );
      if (isTextInput) {
        return;
      }

      if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        e.stopPropagation();
        if (document.activeElement && document.activeElement.tagName === 'BUTTON') {
          document.activeElement.blur();
        }
        togglePlay();
        setIsCursorActive(true);
      } else if (e.code === 'ArrowLeft' || e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        handleRelativeSeek(-5);
        setIsCursorActive(true);
      } else if (e.code === 'ArrowRight' || e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        handleRelativeSeek(5);
        setIsCursorActive(true);
      } else if (e.code === 'ArrowUp' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        adjustVolume(0.05);
        setIsCursorActive(true);
      } else if (e.code === 'ArrowDown' || e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        adjustVolume(-0.05);
        setIsCursorActive(true);
      } else if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        e.stopPropagation();
        toggleMute();
        setIsCursorActive(true);
      } else if (e.code === 'KeyF' || e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
        setIsCursorActive(true);
      } else if (e.code === 'F11' || e.key === 'F11') {
        // Let the browser toggle F11 window mode, and sync our internal fullscreen layout state
        setTimeout(() => {
          const isDocFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
          const isWindowFs = (
            window.matchMedia?.('(display-mode: fullscreen)')?.matches ||
            (window.innerWidth >= window.screen.width - 2 && window.innerHeight >= window.screen.height - 2)
          );
          setIsFullscreen(isDocFs || isWindowFs);
        }, 150);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [togglePlay, handleRelativeSeek, adjustVolume, toggleMute, toggleFullscreen]);

  const triggerOpenVideoPicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const activeAudioTrack = mkvData?.audioTracks?.[selectedAudioTrackIndex];

  return (
    <div className="player-wrapper" onDrop={handleDrop} onDragOver={handleDragOver}>
      {/* Ambient backlight glow effect behind the player */}
      <div className={`ambient-glow ${!ambientGlow || !isPlaying ? 'dim' : ''}`} />

      <div
        className={`video-container ${isFullscreen ? 'is-fullscreen' : ''} ${(!isCursorActive && isPlaying && !isTopBarHovered && !isBottomBarHovered && !showAudioMenu) ? 'controls-hidden' : ''}`}
        ref={containerRef}
        onMouseMove={handleContainerMouseMove}
        onMouseLeave={handleContainerMouseLeave}
        onTouchStart={(e) => {
          setIsCursorActive(true);
          setIsBottomBarHovered((prev) => !prev);
        }}
        onClick={handleContainerClick}
      >
        {/* Floating Reactions Overlay */}
        <FloatingReactions reactions={reactions} />

        {/* Fullscreen Interactive Chat Overlay */}
        <FullscreenChatOverlay
          isFullscreen={isFullscreen}
          messages={messages}
          currentUser={currentUser}
          currentVideoTime={currentTime}
          onSendMessage={onSendMessage}
          onSendReaction={onSendReaction}
          onSeekToTime={onSeekToTime}
        />

        {/* Fullscreen Toast Notifications (Playback sync, seeks, partner actions) */}
        {isFullscreen && toasts && toasts.length > 0 && (
          <div className="toast-container fullscreen-toast-container" aria-live="polite">
            {toasts.map((toast) => (
              <div
                key={toast.id}
                className="toast"
                onClick={() => onDismissToast && onDismissToast(toast.id)}
                title="Click to dismiss"
              >
                <span>{toast.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Fullscreen Walkie Talkie Speaking Indicator (Shown whenever someone turns on mic/speaks, both playing & paused/not playing) */}
        {isFullscreen && activeSpeakers && activeSpeakers.size > 0 && (
          <div className="walkie-talkie-indicator video-player-speaker-indicator" aria-live="polite">
            <span style={{ fontSize: '1.2rem' }}>🎙️</span>
            <span>
              {Array.from(activeSpeakers).map(id => {
                if (id === 'local') return 'You';
                const user = users?.find(u => u.id === id);
                return user ? user.username : 'Someone';
              }).join(', ')} speaking...
            </span>
          </div>
        )}

        {/* Left-Side Screen Volume OSD Overlay */}
        <div
          className={`volume-osd-overlay ${showVolumePopup ? 'visible' : ''}`}
          aria-live="polite"
        >
          <div className="volume-osd-icon">
            {volumePopupMuted || volumePopupLevel === 0 ? (
              <VolumeX size={22} />
            ) : volumePopupLevel < 0.5 ? (
              <Volume1 size={22} />
            ) : (
              <Volume2 size={22} />
            )}
          </div>
          <div className="volume-osd-bar-track">
            <div
              className="volume-osd-bar-fill"
              style={{
                height: `${volumePopupMuted ? 0 : Math.round(volumePopupLevel * 100)}%`
              }}
            />
          </div>
          <span className="volume-osd-value">
            {volumePopupMuted || volumePopupLevel === 0
              ? '0%'
              : `${Math.round(volumePopupLevel * 100)}%`}
          </span>
        </div>

        {/* Seek OSD Overlay (5s left and right) */}
        <div
          className={`seek-osd-overlay ${seekPopupDirection} ${showSeekPopup ? 'visible' : ''}`}
          aria-live="polite"
        >
          <div key={seekAnimKey} className="seek-osd-badge">
            {seekPopupDirection === 'forward' ? (
              <>
                <span className="seek-osd-arrows">&gt;&gt;&gt;</span>
                <span className="seek-osd-text">+5</span>
              </>
            ) : (
              <>
                <span className="seek-osd-text">-5</span>
                <span className="seek-osd-arrows">&lt;&lt;&lt;</span>
              </>
            )}
          </div>
        </div>

        {/* Top Header Bar inside Video Player - Only pops up when arrow is placed at the extreme top */}
        {videoSrc && !videoError && (
          <div
            className={`player-top-bar ${isTopBarHovered ? 'visible' : ''}`}
            onMouseEnter={() => {
              isDirectHoverTopRef.current = true;
              if (hideTopBarTimerRef.current) {
                clearTimeout(hideTopBarTimerRef.current);
                hideTopBarTimerRef.current = null;
              }
              setIsTopBarHovered(true);
            }}
            onMouseLeave={() => {
              isDirectHoverTopRef.current = false;
              hideTopBarTimerRef.current = setTimeout(() => {
                setIsTopBarHovered(false);
                hideTopBarTimerRef.current = null;
              }, 250);
            }}
          >
            <div className="player-file-info">
              <Film size={15} color="#ff2a6d" />
              <span className="player-file-name" title={videoName}>{videoName}</span>
            </div>

            <div className="player-top-actions">
              {controlMode === 'host-only' && (
                <div
                  className={`player-mode-badge ${isHost ? 'host' : 'guest'}`}
                  title={isHost ? 'You have full playback control' : 'Only the host can control playback'}
                >
                  {isHost ? <Crown size={13} color="#f59e0b" /> : <Lock size={13} color="#ff2a6d" />}
                  <span>{isHost ? 'Host Controls Active' : 'Host-Only Mode (Locked)'}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Video Element */}
        {videoSrc && (
          <video
            ref={videoRef}
            src={videoSrc}
            playsInline
            className="video-element"
            onTimeUpdate={handleNativeTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onDoubleClick={toggleFullscreen}
            onError={(e) => {
              console.error('HTML5 video playback error:', e);
              setVideoError(
                'Browser could not decode this video/audio format (common with HEVC/DTS in MKV). Try an MP4 (H.264) or WebM file.'
              );
            }}
          />
        )}

        {/* Error View */}
        {videoError && (
          <div className="video-error-overlay">
            <div className="video-error-icon">
              <AlertTriangle size={42} color="#f43f5e" />
            </div>
            <h3 className="video-error-title">Unable to Play Video</h3>
            <p className="video-error-desc">{videoError}</p>

            {mkvData && (
              <div className="mkv-error-details">
                <strong>Detected File Tracks:</strong>
                <div className="mkv-tracks-preview">
                  {mkvData.videoTrack && <div>🎬 Video: {mkvData.videoTrack.codecName} ({mkvData.videoTrack.width}x{mkvData.videoTrack.height})</div>}
                  {mkvData.audioTracks.map((a, i) => (
                    <div key={i}>🔊 Audio {i + 1}: {a.name} ({a.codecName} • {a.channelString})</div>
                  ))}
                </div>
              </div>
            )}

            <div className="video-error-actions">
              <button
                className="btn-file-select"
                onClick={triggerOpenVideoPicker}
              >
                <Upload size={18} /> Choose Another Video File
              </button>
            </div>
          </div>
        )}

        {/* Dropzone View if no file loaded */}
        {!videoSrc && (
          <div className="dropzone-overlay">
            <div className="dropzone-icon">
              <Film size={36} />
            </div>
            <h3 className="dropzone-title">Load Movie File</h3>
            <p className="dropzone-desc">
              Drag & drop your local video file (<strong>.mkv</strong>, <strong>.mp4</strong>, <strong>.webm</strong>, .mov).
              Files stay 100% on your device and are never uploaded. Multiple audio settings are automatically detected!
            </p>

            <button
              className="btn-file-select"
              onClick={triggerOpenVideoPicker}
            >
              <Upload size={18} /> Choose Video File (.mkv, .mp4, .webm)
            </button>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="video/*,.mkv,.mp4,.webm,.mov,.m4v"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
          }}
        />

        {/* Cinema Controls Bar - Only pops up when arrow is placed at the extreme bottom */}
        {videoSrc && !videoError && (
          <div
            className={`cinema-controls ${(isBottomBarHovered || showAudioMenu) ? 'visible' : ''}`}
            onMouseEnter={() => {
              isDirectHoverBottomRef.current = true;
              if (hideBottomBarTimerRef.current) {
                clearTimeout(hideBottomBarTimerRef.current);
                hideBottomBarTimerRef.current = null;
              }
              setIsBottomBarHovered(true);
            }}
            onMouseLeave={() => {
              isDirectHoverBottomRef.current = false;
              if (!showAudioMenu) {
                hideBottomBarTimerRef.current = setTimeout(() => {
                  setIsBottomBarHovered(false);
                  hideBottomBarTimerRef.current = null;
                }, 250);
              }
            }}
          >
            {/* Seeker / Progress */}
            <div
              className={`seeker-wrapper ${!canControlPlayback ? 'locked' : ''}`}
              ref={seekerRef}
              onClick={handleSeekClick}
              onMouseMove={handleSeekerMouseMove}
              onMouseLeave={handleSeekerMouseLeave}
              title={!canControlPlayback ? 'Seek locked: Host-Only Mode is active' : ''}
            >
              <div className="seeker-track">
                {/* Buffered bar */}
                <div
                  className="seeker-buffer"
                  style={{ width: `${isFinite(duration) && duration > 0 ? (buffered / duration) * 100 : 0}%` }}
                />
                {/* Current progress fill */}
                <div
                  className="seeker-fill"
                  style={{ width: `${isFinite(duration) && duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
                {/* Scrubber thumb */}
                <div
                  className="seeker-thumb"
                  style={{ left: `${isFinite(duration) && duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>

              {/* Hover Tooltip */}
              {hoverTime !== null && canControlPlayback && (
                <div className="seeker-tooltip" style={{ left: `${hoverPosition}px` }}>
                  {formatTime(hoverTime)}
                </div>
              )}
            </div>

            {/* Controls Row */}
            <div className="controls-row">
              <div className="controls-left">
                <button
                  className={`ctrl-btn play-pause-btn ${!canControlPlayback ? 'locked-btn' : ''}`}
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  title={!canControlPlayback ? 'Host-Only Mode (Only host can play/pause)' : (isPlaying ? 'Pause' : 'Play')}
                >
                  {!canControlPlayback ? (
                    <Lock size={18} color="#ff2a6d" />
                  ) : isPlaying ? (
                    <Pause size={20} />
                  ) : (
                    <Play size={20} style={{ marginLeft: '2px' }} />
                  )}
                </button>

                <button
                  className={`ctrl-btn ${!canControlPlayback ? 'disabled' : ''}`}
                  onClick={() => handleRelativeSeek(-5)}
                  title={canControlPlayback ? 'Rewind 5 seconds (-5 <<<)' : 'Rewind locked to Host'}
                  disabled={!canControlPlayback}
                >
                  <RotateCcw size={17} />
                </button>

                <button
                  className={`ctrl-btn ${!canControlPlayback ? 'disabled' : ''}`}
                  onClick={() => handleRelativeSeek(5)}
                  title={canControlPlayback ? 'Forward 5 seconds (>>> +5)' : 'Forward locked to Host'}
                  disabled={!canControlPlayback}
                >
                  <RotateCw size={17} />
                </button>

                <div className="volume-container">
                  <button className="ctrl-btn" onClick={toggleMute} title="Mute/Unmute (M)">
                    {isMuted || volume === 0 ? (
                      <VolumeX size={18} />
                    ) : volume < 0.5 ? (
                      <Volume1 size={18} />
                    ) : (
                      <Volume2 size={18} />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="volume-slider"
                    style={{
                      '--volume-percent': `${isMuted ? 0 : Math.round(volume * 100)}%`
                    }}
                    aria-label="Volume"
                  />
                </div>

                <div className="time-display">
                  <span className="time-current">{formatTime(currentTime)}</span>
                  <span> / </span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="controls-right">
                {/* Audio Settings & Multiple Tracks Popover Menu */}
                {mkvData?.audioTracks && mkvData.audioTracks.length > 0 && (
                  <div className="track-menu-wrapper">
                    <button
                      className={`ctrl-btn ${showAudioMenu || (mkvData.audioTracks.length > 1) ? 'active' : ''}`}
                      onClick={() => setShowAudioMenu(!showAudioMenu)}
                      title="Audio Settings & Multiple Tracks"
                    >
                      <Headphones size={17} />
                      {mkvData.audioTracks.length > 1 && (
                        <span className="ctrl-badge">{mkvData.audioTracks.length}</span>
                      )}
                    </button>

                    {showAudioMenu && (
                      <div className="track-popover-menu audio-popover">
                        <div className="track-popover-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Headphones size={15} color="#ff2a6d" />
                            <strong>Audio Settings & Tracks</strong>
                          </div>
                          <button className="track-popover-close" onClick={() => setShowAudioMenu(false)}>✕</button>
                        </div>

                        <div className="track-popover-list">
                          {mkvData.audioTracks.map((track, idx) => (
                            <button
                              key={track.uid || idx}
                              className={`track-option-item ${selectedAudioTrackIndex === idx ? 'selected' : ''}`}
                              onClick={() => handleSelectAudioTrack(idx)}
                            >
                              <div className="track-option-left">
                                <span className={`track-radio ${selectedAudioTrackIndex === idx ? 'checked' : ''}`} />
                                <div className="track-option-text">
                                  <div className="track-option-title">
                                    {track.name}
                                    {track.isDefault && <span className="track-tag default">Default</span>}
                                  </div>
                                  <div className="track-option-meta">
                                    {track.codecName} • {track.channelString} • {track.samplingFrequency ? `${Math.round(track.samplingFrequency / 1000)}kHz` : ''}
                                  </div>
                                </div>
                              </div>
                              {selectedAudioTrackIndex === idx && <Check size={16} color="#ff2a6d" />}
                            </button>
                          ))}
                        </div>

                        <div className="track-popover-footer">
                          <span>Select audio track to switch stream</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Ambient glow toggle */}
                <button
                  type="button"
                  className={`ctrl-btn ${ambientGlow ? 'active' : ''}`}
                  onClick={() => setAmbientGlow(!ambientGlow)}
                  title="Ambient Backlight Glow"
                >
                  <Sun size={17} />
                </button>

                {/* Fullscreen (F) */}
                <button
                  type="button"
                  className={`ctrl-btn ${isFullscreen ? 'active' : ''}`}
                  onClick={toggleFullscreen}
                  title={isFullscreen ? "Exit Fullscreen (F / Esc)" : "Fullscreen (F)"}
                >
                  {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
