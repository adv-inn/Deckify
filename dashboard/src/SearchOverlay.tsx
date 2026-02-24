import { useState, useCallback, useRef, useEffect } from "react";
import { FaTimes, FaSearch, FaMusic, FaUser, FaCompactDisc } from "react-icons/fa";
import {
  searchSpotify,
  playUris,
  playInContext,
  fetchPlaylistTracks,
  fetchAlbumTracks,
  fetchArtistAlbums,
  type SearchResponse,
  type PlaylistTrack,
  type Album,
  type Artist,
  type Playlist,
} from "./api";
import { formatMs } from "./utils";

type DrillView = null | "album" | "artist" | "playlist";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SearchOverlay({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Drill-in state
  const [drillView, setDrillView] = useState<DrillView>(null);
  const [drillTitle, setDrillTitle] = useState("");
  const [drillTracks, setDrillTracks] = useState<PlaylistTrack[]>([]);
  const [drillAlbums, setDrillAlbums] = useState<Album[]>([]);
  const [drillContextUri, setDrillContextUri] = useState<string | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const handleInput = useCallback((value: string) => {
    setQuery(value);
    setDrillView(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await searchSpotify(value.trim());
        setResults(r.ok ? r : null);
      } catch (e) {
        console.error("Search failed:", e);
        setResults(null);
      }
      setLoading(false);
    }, 300);
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(() => {
      setQuery(""); setResults(null); setDrillView(null); setDrillTracks([]); setDrillAlbums([]);
    }, 300);
  }, [onClose]);

  // Drill-in handlers
  const openAlbum = useCallback(async (al: Album) => {
    setDrillView("album");
    setDrillTitle(al.name);
    setDrillContextUri(al.uri);
    setDrillTracks([]);
    setDrillLoading(true);
    try {
      const r = await fetchAlbumTracks(al.id, 0);
      if (r.ok) setDrillTracks(r.tracks);
    } catch (e) {
      console.error("Failed to load album tracks:", e);
    }
    setDrillLoading(false);
  }, []);

  const openArtist = useCallback(async (a: Artist) => {
    setDrillView("artist");
    setDrillTitle(a.name);
    setDrillAlbums([]);
    setDrillTracks([]);
    setDrillLoading(true);
    try {
      const r = await fetchArtistAlbums(a.id);
      if (r.ok) setDrillAlbums(r.albums);
    } catch (e) {
      console.error("Failed to load artist albums:", e);
    }
    setDrillLoading(false);
  }, []);

  const openPlaylist = useCallback(async (pl: Playlist) => {
    setDrillView("playlist");
    setDrillTitle(pl.name);
    setDrillContextUri(`spotify:playlist:${pl.id}`);
    setDrillTracks([]);
    setDrillLoading(true);
    try {
      const r = await fetchPlaylistTracks(pl.id, 0);
      if (r.ok) setDrillTracks(r.tracks);
    } catch (e) {
      console.error("Failed to load playlist tracks:", e);
    }
    setDrillLoading(false);
  }, []);

  const openDrillAlbum = useCallback(async (al: Album) => {
    setDrillView("album");
    setDrillTitle(al.name);
    setDrillContextUri(al.uri);
    setDrillAlbums([]);
    setDrillTracks([]);
    setDrillLoading(true);
    try {
      const r = await fetchAlbumTracks(al.id, 0);
      if (r.ok) setDrillTracks(r.tracks);
    } catch (e) {
      console.error("Failed to load album tracks:", e);
    }
    setDrillLoading(false);
  }, []);

  const handlePlayDrillTrack = useCallback(async (track: PlaylistTrack, index: number) => {
    if (drillContextUri) {
      await playInContext(drillContextUri, track.uri);
    } else {
      await playUris(drillTracks.map((t) => t.uri), index);
    }
  }, [drillContextUri, drillTracks]);

  const backToResults = useCallback(() => {
    setDrillView(null);
    setDrillTracks([]);
    setDrillAlbums([]);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-neutral-800 shrink-0">
        {drillView ? (
          <button onClick={backToResults} className="text-neutral-400 hover:text-white text-sm shrink-0">Back</button>
        ) : (
          <FaSearch className="text-neutral-500 shrink-0" size={18} />
        )}
        {drillView ? (
          <span className="text-lg font-semibold truncate flex-1">{drillTitle}</span>
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Search songs, artists, albums..."
            className="flex-1 bg-transparent text-xl text-white placeholder-neutral-600 outline-none"
          />
        )}
        <button onClick={handleClose} className="text-neutral-500 hover:text-white p-1 shrink-0">
          <FaTimes size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Drill-in view */}
        {drillView && (
          drillLoading ? (
            <div className="text-neutral-500 text-sm">Loading...</div>
          ) : drillView === "artist" ? (
            <div className="max-w-2xl mx-auto">
              {drillAlbums.map((al) => (
                <button key={al.id} onClick={() => openDrillAlbum(al)} className="w-full flex items-center gap-3 py-2.5 hover:bg-neutral-800/50 rounded-lg px-3 transition-colors text-left">
                  {al.image_url ? (
                    <img src={al.image_url} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-neutral-800 flex items-center justify-center shrink-0">
                      <FaCompactDisc className="text-neutral-600" size={14} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{al.name}</div>
                    <div className="text-xs text-neutral-500 truncate">{al.artist}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              {drillTracks.map((t, i) => (
                <button key={t.uri + i} onClick={() => handlePlayDrillTrack(t, i)} className="w-full flex items-center justify-between py-3 hover:bg-neutral-800/50 rounded-lg px-3 transition-colors text-left">
                  <div className="min-w-0 flex-1 mr-3">
                    <div className="text-sm truncate">{t.name}</div>
                    <div className="text-xs text-neutral-500 truncate">{t.artist}</div>
                  </div>
                  <span className="text-xs text-neutral-600 shrink-0">{formatMs(t.duration_ms)}</span>
                </button>
              ))}
            </div>
          )
        )}

        {/* Search results */}
        {!drillView && (
          loading ? (
            <div className="text-neutral-500 text-sm">Searching...</div>
          ) : !query.trim() ? (
            <div className="text-neutral-600 text-sm mt-8 text-center">Type to search Spotify</div>
          ) : results ? (
            <div className="max-w-2xl mx-auto space-y-6">
              {results.tracks.length > 0 && (
                <section>
                  <h3 className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Tracks</h3>
                  {results.tracks.slice(0, 6).map((t, i) => (
                    <button key={t.uri + i} onClick={() => playUris([t.uri])} className="w-full flex items-center gap-3 py-2.5 hover:bg-neutral-800/50 rounded-lg px-3 transition-colors text-left">
                      {t.image_url ? (
                        <img src={t.image_url} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-neutral-800 flex items-center justify-center shrink-0">
                          <FaMusic className="text-neutral-600" size={14} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm truncate">{t.name}</div>
                        <div className="text-xs text-neutral-500 truncate">{t.artist}</div>
                      </div>
                      <span className="text-xs text-neutral-600 shrink-0">{formatMs(t.duration_ms)}</span>
                    </button>
                  ))}
                </section>
              )}

              {results.artists.length > 0 && (
                <section>
                  <h3 className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Artists</h3>
                  {results.artists.slice(0, 4).map((a) => (
                    <button key={a.id} onClick={() => openArtist(a)} className="w-full flex items-center gap-3 py-2.5 hover:bg-neutral-800/50 rounded-lg px-3 transition-colors text-left">
                      {a.image_url ? (
                        <img src={a.image_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center shrink-0">
                          <FaUser className="text-neutral-600" size={14} />
                        </div>
                      )}
                      <span className="text-sm font-medium truncate">{a.name}</span>
                    </button>
                  ))}
                </section>
              )}

              {results.albums.length > 0 && (
                <section>
                  <h3 className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Albums</h3>
                  {results.albums.slice(0, 4).map((al) => (
                    <button key={al.id} onClick={() => openAlbum(al)} className="w-full flex items-center gap-3 py-2.5 hover:bg-neutral-800/50 rounded-lg px-3 transition-colors text-left">
                      {al.image_url ? (
                        <img src={al.image_url} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-neutral-800 flex items-center justify-center shrink-0">
                          <FaCompactDisc className="text-neutral-600" size={14} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{al.name}</div>
                        <div className="text-xs text-neutral-500 truncate">{al.artist}</div>
                      </div>
                    </button>
                  ))}
                </section>
              )}

              {results.playlists.length > 0 && (
                <section>
                  <h3 className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Playlists</h3>
                  {results.playlists.slice(0, 4).map((pl) => (
                    <button key={pl.id} onClick={() => openPlaylist(pl)} className="w-full flex items-center gap-3 py-2.5 hover:bg-neutral-800/50 rounded-lg px-3 transition-colors text-left">
                      {pl.image_url ? (
                        <img src={pl.image_url} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-neutral-800 flex items-center justify-center shrink-0">
                          <FaMusic className="text-neutral-600" size={14} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{pl.name}</div>
                        <div className="text-xs text-neutral-500">{pl.track_count} tracks</div>
                      </div>
                    </button>
                  ))}
                </section>
              )}

              {results.tracks.length === 0 && results.artists.length === 0 && results.albums.length === 0 && results.playlists.length === 0 && (
                <div className="text-neutral-500 text-sm mt-8 text-center">No results found</div>
              )}
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
