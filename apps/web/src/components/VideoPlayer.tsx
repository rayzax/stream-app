import { useEffect, useRef, useState } from 'react';
import type Hls from 'hls.js';
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
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<ReturnType<typeof mpegts.createPlayer> | null>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!started) return;
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;

    async function attach() {
      const nativeHls = video!.canPlayType('application/vnd.apple.mpegurl');
      if (nativeHls) {
        video!.src = src;
        video!.play().catch(() => {});
        return;
      }

      // hls.js / mpegts.js are only fetched once playback actually starts —
      // keeps them out of the initial bundle (cellular-friendly).
      const { default: Hls } = await import('hls.js');
      if (cancelled) return;

      if (Hls.isSupported()) {
        const hls = new Hls({ lowLatencyMode: isLive });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video!);
        hls.on(Hls.Events.ERROR, async (_evt, data) => {
          if (data.fatal) {
            hls.destroy();
            hlsRef.current = null;
            const { default: mpegts } = await import('mpegts.js');
            if (mpegts.isSupported()) {
              const player = mpegts.createPlayer({ type: 'mse', isLive, url: src });
              mpegtsRef.current = player;
              player.attachMediaElement(video!);
              player.load();
              player.play();
            }
          }
        });
      } else {
        const { default: mpegts } = await import('mpegts.js');
        if (cancelled) return;
        if (mpegts.isSupported()) {
          const player = mpegts.createPlayer({ type: 'mse', isLive, url: src });
          mpegtsRef.current = player;
          player.attachMediaElement(video!);
          player.load();
        } else {
          video!.src = src;
        }
      }
      video!.play().catch(() => {});
    }
    attach();

    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
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
    <div className="video-wrap">
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
          style={{ position: 'absolute', bottom: 8, left: 8, right: 8, background: 'rgba(0,0,0,0.5)', borderRadius: 10, padding: 6 }}
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
