import { useEffect, useState, useRef, useCallback } from "react";
import { FaPlay, FaPause, FaStepBackward, FaStepForward, FaVolumeUp, FaBars, FaSearch } from "react-icons/fa";
import { fetchStatus, controlPlayback, setVolume, type StatusResponse } from "./api";
import Sidebar from "./Sidebar";
import SearchOverlay from "./SearchOverlay";
import { formatMs } from "./utils";

export default function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [localVolume, setLocalVolume] = useState<number>(50);
  const [progress, setProgress] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const anchorRef = useRef<{ positionMs: number; startTime: number; durationMs: number } | null>(null);
  const volumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeDragging = useRef(false);

  // Poll /api/status
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const s = await fetchStatus();
        if (!active) return;
        setStatus(s);

        // Update anchor for progress estimation
        const dur = s.track?.duration_ms ?? 0;
        if (s.is_playing && dur > 0) {
          anchorRef.current = { positionMs: s.position_ms, startTime: Date.now(), durationMs: dur };
        } else if (!s.is_playing && dur > 0) {
          anchorRef.current = { positionMs: s.position_ms, startTime: Date.now(), durationMs: dur };
        } else {
          anchorRef.current = null;
          setProgress(0);
        }

        // Sync volume from remote (only if not actively dragging)
        if (s.volume !== null && !volumeDragging.current) {
          setLocalVolume(s.volume);
        }
        setError(null);
      } catch (e) {
        console.error("Status poll failed:", e);
        if (active) setError("Cannot reach backend");
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => { active = false; clearInterval(id); };
  }, []);

  // Progress tick
  useEffect(() => {
    if (!status?.is_playing) return;
    const id = setInterval(() => {
      const a = anchorRef.current;
      if (!a || a.durationMs <= 0) return;
      const current = a.positionMs + (Date.now() - a.startTime);
      setProgress(Math.min(current / a.durationMs, 1));
    }, 250);
    return () => clearInterval(id);
  }, [status?.is_playing]);

  // Sync progress when paused
  useEffect(() => {
    if (status && !status.is_playing) {
      const a = anchorRef.current;
      if (a && a.durationMs > 0) {
        setProgress(Math.min(a.positionMs / a.durationMs, 1));
      }
    }
  }, [status]);

  const handleControl = useCallback(async (action: string) => {
    try {
      await controlPlayback(action);
    } catch (e) {
      console.error("Playback control failed:", e);
    }
    // Quick re-poll after action
    setTimeout(async () => {
      try {
        const s = await fetchStatus();
        setStatus(s);
      } catch (e) {
        console.error("Re-poll failed:", e);
      }
    }, 500);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setLocalVolume(val);
    volumeDragging.current = true;
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = setTimeout(async () => {
      await setVolume(val);
      volumeDragging.current = false;
    }, 300);
  }, []);

  const track = status?.track;
  const isPlaying = status?.is_playing ?? false;
  const durationMs = track?.duration_ms ?? 0;
  const currentMs = anchorRef.current
    ? anchorRef.current.positionMs + (isPlaying ? Date.now() - anchorRef.current.startTime : 0)
    : 0;

  return (
    <div className="h-screen overflow-hidden bg-neutral-950 text-white flex flex-col items-center justify-center p-4 relative">
      {/* Hamburger menu */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="absolute top-4 left-4 text-neutral-400 hover:text-white transition-colors p-2"
      >
        <FaBars size={20} />
      </button>
      {/* Search button */}
      <button
        onClick={() => setSearchOpen(true)}
        className="absolute top-4 right-4 text-neutral-400 hover:text-white transition-colors p-2"
      >
        <FaSearch size={18} />
      </button>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Album art */}
      <div className="shrink-0">
        {track?.artwork_url ? (
          <img
            src={track.artwork_url}
            alt="Album art"
            className="w-48 h-48 rounded-2xl shadow-2xl object-cover"
          />
        ) : (
          <div className="w-48 h-48 rounded-2xl bg-neutral-800 flex items-center justify-center">
            <FaPlay className="text-neutral-600 text-4xl" />
          </div>
        )}
      </div>

      {/* Track info */}
      <div className="text-center mt-5 shrink-0 w-full max-w-md px-4">
        <h1 className="text-xl font-bold truncate">
          {track?.name ?? "Not Playing"}
        </h1>
        <p className="text-neutral-400 truncate">
          {track ? `${track.artist} — ${track.album}` : "Waiting for playback..."}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-md px-4 mt-5 shrink-0">
        <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-green-500 h-full rounded-full transition-[width] duration-200"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-neutral-500 mt-1">
          <span>{formatMs(Math.min(currentMs, durationMs))}</span>
          <span>{durationMs > 0 ? formatMs(durationMs) : "--:--"}</span>
        </div>
      </div>

      {/* Playback controls */}
      <div className="flex items-center justify-center gap-8 mt-5 shrink-0">
        <button
          onClick={() => handleControl("previous")}
          className="text-neutral-400 hover:text-white transition-colors p-3"
        >
          <FaStepBackward size={22} />
        </button>
        <button
          onClick={() => handleControl(isPlaying ? "pause" : "play")}
          className="bg-white text-black rounded-full p-4 hover:scale-105 transition-transform"
        >
          {isPlaying ? <FaPause size={24} /> : <FaPlay size={24} className="ml-0.5" />}
        </button>
        <button
          onClick={() => handleControl("next")}
          className="text-neutral-400 hover:text-white transition-colors p-3"
        >
          <FaStepForward size={22} />
        </button>
      </div>

      {/* Volume slider */}
      <div className="flex items-center gap-3 mt-5 w-full max-w-md px-4 shrink-0">
        <FaVolumeUp className="text-neutral-500 shrink-0" />
        <input
          type="range"
          min={0}
          max={100}
          value={localVolume}
          onChange={handleVolumeChange}
          className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-green-500"
        />
        <span className="text-neutral-500 text-sm w-8 text-right">{localVolume}</span>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mt-4 px-4 py-2 bg-red-900/60 text-red-200 text-xs rounded-lg shrink-0">
          {error}
        </div>
      )}

      {/* Status bar */}
      <div className="mt-4 text-center text-xs text-neutral-600 shrink-0">
        {status?.librespot_running ? "Spotify Connect active" : "Spotify Connect inactive"}
        {status?.authenticated ? "" : " · Not authenticated"}
      </div>
    </div>
  );
}
