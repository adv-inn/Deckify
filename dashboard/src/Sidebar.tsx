import { useState, useEffect, useCallback, useRef } from "react";
import { FaTimes, FaChevronLeft, FaMusic, FaHeart, FaPodcast, FaUser, FaCompactDisc, FaStar } from "react-icons/fa";
import {
  fetchPlaylists,
  fetchPlaylistTracks,
  fetchLikedTracks,
  fetchSavedEpisodes,
  fetchSavedAlbums,
  fetchAlbumTracks,
  fetchFollowedArtists,
  fetchArtistAlbums,
  playInContext,
  playUris,
  type Playlist,
  type PlaylistTrack,
  type Album,
  type Artist,
  type Episode,
} from "./api";
import { formatMs } from "./utils";

type View = "library" | "playlist" | "liked" | "episodes" | "album" | "artist";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: Props) {
  const [view, setView] = useState<View>("library");
  const [loading, setLoading] = useState(false);

  // Library data
  const [madeForYou, setMadeForYou] = useState<Playlist[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistsTotal, setPlaylistsTotal] = useState(0);
  const [playlistsOffset, setPlaylistsOffset] = useState(0);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);

  // Drill-in: tracks (shared by playlist, liked, album, artist)
  const [drillTitle, setDrillTitle] = useState("");
  const [drillSubtitle, setDrillSubtitle] = useState("");
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [tracksTotal, setTracksTotal] = useState(0);
  const [tracksOffset, setTracksOffset] = useState(0);
  const [loadingTracks, setLoadingTracks] = useState(false);

  // Drill-in: episodes
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodesTotal, setEpisodesTotal] = useState(0);
  const [episodesOffset, setEpisodesOffset] = useState(0);

  // Drill-in: artist albums
  const [artistAlbums, setArtistAlbums] = useState<Album[]>([]);

  // Context for play action
  const [activeContextId, setActiveContextId] = useState<string | null>(null);

  // Request ID to discard stale drill-in responses
  const drillReqId = useRef(0);

  const splitPlaylists = useCallback((items: Playlist[]) => {
    const made: Playlist[] = [];
    const user: Playlist[] = [];
    for (const p of items) {
      if (p.owner_id === "spotify") made.push(p);
      else user.push(p);
    }
    return { made, user };
  }, []);

  // Load library when drawer opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([fetchPlaylists(), fetchSavedAlbums(), fetchFollowedArtists()])
      .then(([pl, al, ar]) => {
        if (pl.ok) {
          const { made, user } = splitPlaylists(pl.playlists);
          setMadeForYou(made);
          setPlaylists(user);
          setPlaylistsTotal(pl.total);
          setPlaylistsOffset(pl.playlists.length);
        }
        if (al.ok) setAlbums(al.albums);
        if (ar.ok) setArtists(ar.artists);
      })
      .catch((e) => console.error("Failed to load library:", e))
      .finally(() => setLoading(false));
  }, [open, splitPlaylists]);

  // ── Load more playlists in library view ──

  const loadMorePlaylists = useCallback(async () => {
    setLoadingTracks(true);
    try {
      const r = await fetchPlaylists(playlistsOffset);
      if (r.ok) {
        const { made, user } = splitPlaylists(r.playlists);
        setMadeForYou((p) => [...p, ...made]);
        setPlaylists((p) => [...p, ...user]);
        setPlaylistsOffset((p) => p + r.playlists.length);
      }
    } catch (e) {
      console.error("Failed to load more playlists:", e);
    }
    setLoadingTracks(false);
  }, [playlistsOffset, splitPlaylists]);

  // ── Drill-in openers ──

  const openPlaylist = useCallback(async (pl: Playlist) => {
    const reqId = ++drillReqId.current;
    setView("playlist");
    setDrillTitle(pl.name);
    setDrillSubtitle(`${pl.track_count} tracks`);
    setActiveContextId(pl.id);
    setTracks([]);
    setTracksOffset(0);
    setLoadingTracks(true);
    try {
      const r = await fetchPlaylistTracks(pl.id, 0);
      if (reqId !== drillReqId.current) return;
      if (r.ok) { setTracks(r.tracks); setTracksTotal(r.total); setTracksOffset(r.tracks.length); }
    } catch (e) {
      console.error("Failed to load playlist tracks:", e);
    }
    if (reqId === drillReqId.current) setLoadingTracks(false);
  }, []);

  const openAlbum = useCallback(async (al: Album) => {
    const reqId = ++drillReqId.current;
    setView("album");
    setDrillTitle(al.name);
    setDrillSubtitle(al.artist);
    setActiveContextId(al.id);
    setTracks([]);
    setTracksOffset(0);
    setLoadingTracks(true);
    try {
      const r = await fetchAlbumTracks(al.id, 0);
      if (reqId !== drillReqId.current) return;
      if (r.ok) { setTracks(r.tracks); setTracksTotal(r.total); setTracksOffset(r.tracks.length); }
    } catch (e) {
      console.error("Failed to load album tracks:", e);
    }
    if (reqId === drillReqId.current) setLoadingTracks(false);
  }, []);

  const openLiked = useCallback(async () => {
    const reqId = ++drillReqId.current;
    setView("liked");
    setDrillTitle("Liked Songs");
    setDrillSubtitle("");
    setActiveContextId(null);
    setTracks([]);
    setTracksOffset(0);
    setLoadingTracks(true);
    try {
      const r = await fetchLikedTracks(0);
      if (reqId !== drillReqId.current) return;
      if (r.ok) { setTracks(r.tracks); setTracksTotal(r.total); setTracksOffset(r.tracks.length); setDrillSubtitle(`${r.total} tracks`); }
    } catch (e) {
      console.error("Failed to load liked tracks:", e);
    }
    if (reqId === drillReqId.current) setLoadingTracks(false);
  }, []);

  const openEpisodes = useCallback(async () => {
    const reqId = ++drillReqId.current;
    setView("episodes");
    setDrillTitle("Your Episodes");
    setDrillSubtitle("");
    setEpisodes([]);
    setEpisodesOffset(0);
    setLoadingTracks(true);
    try {
      const r = await fetchSavedEpisodes(0);
      if (reqId !== drillReqId.current) return;
      if (r.ok) { setEpisodes(r.episodes); setEpisodesTotal(r.total); setEpisodesOffset(r.episodes.length); setDrillSubtitle(`${r.total} episodes`); }
    } catch (e) {
      console.error("Failed to load episodes:", e);
    }
    if (reqId === drillReqId.current) setLoadingTracks(false);
  }, []);

  const openArtist = useCallback(async (artist: Artist) => {
    const reqId = ++drillReqId.current;
    setView("artist");
    setDrillTitle(artist.name);
    setDrillSubtitle("Albums");
    setArtistAlbums([]);
    setLoadingTracks(true);
    try {
      const r = await fetchArtistAlbums(artist.id);
      if (reqId !== drillReqId.current) return;
      if (r.ok) setArtistAlbums(r.albums);
    } catch (e) {
      console.error("Failed to load artist albums:", e);
    }
    if (reqId === drillReqId.current) setLoadingTracks(false);
  }, []);

  // ── Load more (drill-in) ──

  const loadMoreTracks = useCallback(async () => {
    setLoadingTracks(true);
    try {
      let r;
      if (view === "liked") r = await fetchLikedTracks(tracksOffset);
      else if (view === "album") r = await fetchAlbumTracks(activeContextId!, tracksOffset);
      else r = await fetchPlaylistTracks(activeContextId!, tracksOffset);
      if (r.ok) { setTracks((p) => [...p, ...r.tracks]); setTracksOffset((p) => p + r.tracks.length); }
    } catch (e) {
      console.error("Failed to load more tracks:", e);
    }
    setLoadingTracks(false);
  }, [view, activeContextId, tracksOffset]);

  const loadMoreEpisodes = useCallback(async () => {
    setLoadingTracks(true);
    try {
      const r = await fetchSavedEpisodes(episodesOffset);
      if (r.ok) { setEpisodes((p) => [...p, ...r.episodes]); setEpisodesOffset((p) => p + r.episodes.length); }
    } catch (e) {
      console.error("Failed to load more episodes:", e);
    }
    setLoadingTracks(false);
  }, [episodesOffset]);

  // ── Play handlers ──

  const handlePlayTrack = useCallback(async (track: PlaylistTrack, index: number) => {
    if (view === "playlist" && activeContextId) {
      await playInContext(`spotify:playlist:${activeContextId}`, track.uri);
    } else if (view === "album" && activeContextId) {
      await playInContext(`spotify:album:${activeContextId}`, track.uri);
    } else {
      const uris = tracks.map((t) => t.uri);
      await playUris(uris, index);
    }
  }, [view, activeContextId, tracks]);

  const handlePlayEpisode = useCallback(async (ep: Episode) => {
    await playUris([ep.uri]);
  }, []);

  // ── Navigation ──

  const goBack = useCallback(() => {
    setView("library");
    setTracks([]);
    setEpisodes([]);
    setArtistAlbums([]);
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(() => { setView("library"); setTracks([]); setEpisodes([]); }, 300);
  }, [onClose]);

  const inDrill = view !== "library";
  const allPlaylistsLoaded = playlistsOffset >= playlistsTotal;

  // Reusable playlist row
  const PlaylistRow = ({ pl, icon }: { pl: Playlist; icon?: React.ReactNode }) => (
    <button onClick={() => openPlaylist(pl)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-800 transition-colors text-left">
      {pl.image_url ? (
        <img src={pl.image_url} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded bg-neutral-800 flex items-center justify-center shrink-0">
          {icon || <FaMusic className="text-neutral-600" size={14} />}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{pl.name}</div>
        <div className="text-xs text-neutral-500">{pl.track_count} tracks</div>
      </div>
    </button>
  );

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/60" onClick={handleClose} />}

      <div className={`fixed inset-y-0 left-0 z-50 w-80 bg-neutral-900 shadow-2xl flex flex-col transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 shrink-0">
          {inDrill ? (
            <button onClick={goBack} className="text-neutral-400 hover:text-white flex items-center gap-1 text-sm">
              <FaChevronLeft size={12} /> Library
            </button>
          ) : (
            <span className="font-semibold text-sm">Library</span>
          )}
          <button onClick={handleClose} className="text-neutral-500 hover:text-white p-1">
            <FaTimes size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {view === "library" && (
            loading ? (
              <div className="p-4 text-neutral-500 text-sm">Loading...</div>
            ) : (
              <>
                {/* Special entries */}
                <button onClick={openLiked} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-800 transition-colors text-left">
                  <div className="w-10 h-10 rounded bg-gradient-to-br from-purple-700 to-blue-300 flex items-center justify-center shrink-0">
                    <FaHeart className="text-white" size={14} />
                  </div>
                  <span className="text-sm font-medium">Liked Songs</span>
                </button>
                <button onClick={openEpisodes} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-800 transition-colors text-left">
                  <div className="w-10 h-10 rounded bg-green-800 flex items-center justify-center shrink-0">
                    <FaPodcast className="text-white" size={14} />
                  </div>
                  <span className="text-sm font-medium">Your Episodes</span>
                </button>

                {/* Made For You */}
                {madeForYou.length > 0 && (
                  <>
                    <div className="px-4 pt-4 pb-1 text-xs text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                      <FaStar size={10} /> Made For You
                    </div>
                    {madeForYou.map((pl) => <PlaylistRow key={pl.id} pl={pl} />)}
                  </>
                )}

                {/* Artists */}
                {artists.length > 0 && (
                  <>
                    <div className="px-4 pt-4 pb-1 text-xs text-neutral-500 uppercase tracking-wider">Artists</div>
                    {artists.map((a) => (
                      <button key={a.id} onClick={() => openArtist(a)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-800 transition-colors text-left">
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
                  </>
                )}

                {/* Albums */}
                {albums.length > 0 && (
                  <>
                    <div className="px-4 pt-4 pb-1 text-xs text-neutral-500 uppercase tracking-wider">Albums</div>
                    {albums.map((al) => (
                      <button key={al.id} onClick={() => openAlbum(al)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-800 transition-colors text-left">
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
                  </>
                )}

                {/* Playlists */}
                {playlists.length > 0 && (
                  <>
                    <div className="px-4 pt-4 pb-1 text-xs text-neutral-500 uppercase tracking-wider">Playlists</div>
                    {playlists.map((pl) => <PlaylistRow key={pl.id} pl={pl} />)}
                  </>
                )}

                {/* Load more playlists */}
                {!allPlaylistsLoaded && (
                  <button onClick={loadMorePlaylists} className="w-full py-3 text-sm text-green-500 hover:text-green-400 transition-colors">
                    {loadingTracks ? "Loading..." : "Load more playlists"}
                  </button>
                )}
              </>
            )
          )}

          {/* Artist drill-in (albums) */}
          {view === "artist" && (
            <>
              <div className="px-4 py-3 border-b border-neutral-800">
                <div className="text-sm font-semibold truncate">{drillTitle}</div>
                {drillSubtitle && <div className="text-xs text-neutral-500">{drillSubtitle}</div>}
              </div>
              {artistAlbums.map((al) => (
                <button key={al.id} onClick={() => openAlbum(al)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-800 transition-colors text-left">
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
              {loadingTracks && <div className="px-4 py-3 text-neutral-500 text-sm">Loading...</div>}
            </>
          )}

          {/* Track drill-in (playlist / liked / album) */}
          {(view === "playlist" || view === "liked" || view === "album") && (
            <>
              <div className="px-4 py-3 border-b border-neutral-800">
                <div className="text-sm font-semibold truncate">{drillTitle}</div>
                {drillSubtitle && <div className="text-xs text-neutral-500">{drillSubtitle}</div>}
              </div>
              {tracks.map((t, i) => (
                <button key={t.uri + i} onClick={() => handlePlayTrack(t, i)} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-neutral-800 transition-colors text-left">
                  <div className="min-w-0 flex-1 mr-3">
                    <div className="text-sm truncate">{t.name}</div>
                    <div className="text-xs text-neutral-500 truncate">{t.artist}</div>
                  </div>
                  <span className="text-xs text-neutral-600 shrink-0">{formatMs(t.duration_ms)}</span>
                </button>
              ))}
              {loadingTracks && <div className="px-4 py-3 text-neutral-500 text-sm">Loading...</div>}
              {!loadingTracks && tracks.length < tracksTotal && (
                <button onClick={loadMoreTracks} className="w-full py-3 text-sm text-green-500 hover:text-green-400 transition-colors">Load more</button>
              )}
            </>
          )}

          {/* Episodes drill-in */}
          {view === "episodes" && (
            <>
              <div className="px-4 py-3 border-b border-neutral-800">
                <div className="text-sm font-semibold truncate">{drillTitle}</div>
                {drillSubtitle && <div className="text-xs text-neutral-500">{drillSubtitle}</div>}
              </div>
              {episodes.map((ep, i) => (
                <button key={ep.uri + i} onClick={() => handlePlayEpisode(ep)} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-neutral-800 transition-colors text-left">
                  <div className="min-w-0 flex-1 mr-3">
                    <div className="text-sm truncate">{ep.name}</div>
                    <div className="text-xs text-neutral-500 truncate">{ep.show_name}</div>
                  </div>
                  <span className="text-xs text-neutral-600 shrink-0">{formatMs(ep.duration_ms)}</span>
                </button>
              ))}
              {loadingTracks && <div className="px-4 py-3 text-neutral-500 text-sm">Loading...</div>}
              {!loadingTracks && episodes.length < episodesTotal && (
                <button onClick={loadMoreEpisodes} className="w-full py-3 text-sm text-green-500 hover:text-green-400 transition-colors">Load more</button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
