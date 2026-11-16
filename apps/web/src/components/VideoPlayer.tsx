import { useEffect, useRef, useState } from 'react';
import type mpegts from 'mpegts.js';
import { PlayIcon, PauseIcon, VolumeIcon, PipIcon, FullscreenIcon } from './icons';

export interface VideoPlayerProps {
  src: string;
  isLive: boolean;
  via: 'cloud' | 'homelab';
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
}

export default function VideoPlayer({ src, isLive, via }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mpegtsRef = useRef<ReturnType<typeof mpegts.createPlayer> | null>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleHide() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
  }

  function showControls() {
    setControlsVisible(true);
    scheduleHide();
  }

  useEffect(() => {
    if (!started) return;
    scheduleHide();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;

    async function attach() {
      if (isLive) {
        // Our backend serves live channels as a continuous raw MPEG-TS
        // stream, not real segmented HLS (this provider's .m3u8 "HLS"
        // output is a non-functional wrapper — see xtreamUpstream.ts).
        // mpegts.js (MSE) is what actually plays continuous TS-over-HTTP.
        const { default: mpegts } = await import('mpegts.js');
        if (cancelled) return;
        if (mpegts.isSupported()) {
          const player = mpegts.createPlayer({ type: 'mse', isLive: true, url: src });
          mpegtsRef.current = player;
          player.attachMediaElement(video!);
          player.load();
          try {
            void player.play();
          } catch {
            /* ignore — e.g. autoplay restrictions; user already tapped play */
          }
        } else {
          // No MSE support (some older iOS Safari versions) — best-effort
          // native playback; Safari has some native MPEG-TS support.
          video!.src = src;
          video!.play().catch(() => {});
        }
        return;
      }

      // VOD: the backend passes the real movie file straight through with
      // Range support (not HLS either) — native <video> playback just
      // works for anything the browser's codec support covers (MKV titles
      // are flagged elsewhere as possibly unplayable).
      video!.src = src;
      video!.play().catch(() => {});
    }
    attach();

    return () => {
      cancelled = true;
      mpegtsRef.current?.destroy();
      mpegtsRef.current = null;
    };
  }, [started, src, isLive]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  function enterFullscreen() {
    const video = videoRef.current;
    if (!video) return;
    const iosVideo = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
    if (isIos() && iosVideo.webkitEnterFullscreen) {
      iosVideo.webkitEnterFullscreen();
      return;
    }
    video.requestFullscreen?.().then(() => {
      // Best-effort landscape lock on devices that support it (not iOS Safari).
      const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      orientation.lock?.('landscape').catch(() => {});
    }).catch(() => {});
  }

  function enterPip() {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) return;
    video.requestPictureInPicture?.().catch(() => {});
  }

  return (
    <div
      className="video-wrap"
      onClick={() => started && showControls()}
      onTouchStart={() => started && showControls()}
    >
      <video
        ref={videoRef}
        playsInline
        controls={false}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      {!started && (
        <button className="play-overlay" aria-label="Play" onClick={() => setStarted(true)}>
          <span className="play-overlay-btn">
            <PlayIcon width={32} height={32} />
          </span>
        </button>
      )}
      {started && (
        <div
          className="player-controls"
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            right: 8,
            background: 'rgba(0,0,0,0.5)',
            borderRadius: 10,
            padding: 6,
            opacity: controlsVisible ? 1 : 0,
            transform: controlsVisible ? 'translateY(0)' : 'translateY(6px)',
            pointerEvents: controlsVisible ? 'auto' : 'none',
          }}
        >
          <button className="ctl" aria-pressed={playing} onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button className="ctl" aria-pressed={muted} onClick={toggleMute} aria-label="Mute">
            <VolumeIcon />
          </button>
          {isLive && <span className="pill">LIVE</span>}
          <span className="source-badge">Streaming via {via === 'homelab' ? 'Homelab' : 'Cloud'}</span>
          <button className="ctl" onClick={enterPip} aria-label="Picture in picture" style={{ marginLeft: 'auto' }}>
            <PipIcon />
          </button>
          <button className="ctl" onClick={enterFullscreen} aria-label="Fullscreen">
            <FullscreenIcon />
          </button>
        </div>
      )}
    </div>
  );
}
