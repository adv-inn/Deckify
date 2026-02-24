async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return jsonOrThrow(res);
}

export interface TrackMeta {
  track_id: string;
  name: string;
  artist: string;
  album: string;
  artwork_url: string | null;
  duration_ms: number;
}

export interface StatusResponse {
  authenticated: boolean;
  librespot_running: boolean;
  play_state: string | null;
  track: TrackMeta | null;
  position_ms: number;
  is_playing: boolean;
  volume: number | null;
}

export async function fetchStatus(): Promise<StatusResponse> {
  const res = await fetch("/api/status");
  return jsonOrThrow(res);
}

export async function controlPlayback(action: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/control?action=${encodeURIComponent(action)}`, { method: "POST" });
  return jsonOrThrow(res);
}

export async function setVolume(value: number): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/volume?value=${encodeURIComponent(value)}`, { method: "POST" });
  return jsonOrThrow(res);
}

// ── Playlist types & API ─────────────────────────────────────

export interface Playlist {
  id: string;
  name: string;
  image_url: string | null;
  track_count: number;
  owner_id: string;
}

export interface PlaylistTrack {
  id: string | null;
  name: string;
  artist: string;
  album: string;
  uri: string;
  duration_ms: number;
  image_url: string | null;
}

export interface PlaylistsResponse {
  ok: boolean;
  playlists: Playlist[];
  total: number;
  offset: number;
  error?: string;
}

export interface TracksResponse {
  ok: boolean;
  tracks: PlaylistTrack[];
  total: number;
  offset: number;
  error?: string;
}

export async function fetchPlaylists(offset = 0): Promise<PlaylistsResponse> {
  const res = await fetch(`/api/playlists?offset=${offset}`);
  return jsonOrThrow(res);
}

export async function fetchPlaylistTracks(id: string, offset = 0): Promise<TracksResponse> {
  const res = await fetch(`/api/playlists/${encodeURIComponent(id)}/tracks?offset=${offset}`);
  return jsonOrThrow(res);
}

export async function playInContext(contextUri: string, offsetUri: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/play", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context_uri: contextUri, offset_uri: offsetUri }),
  });
  return jsonOrThrow(res);
}

export async function playUris(uris: string[], position = 0): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/play", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uris, position }),
  });
  return jsonOrThrow(res);
}

// ── Library types & API ──────────────────────────────────────

export interface Artist {
  id: string;
  name: string;
  image_url: string | null;
}

export interface Episode {
  id: string;
  name: string;
  show_name: string;
  uri: string;
  duration_ms: number;
  image_url: string | null;
}

export interface ArtistsResponse {
  ok: boolean;
  artists: Artist[];
  error?: string;
}

export interface EpisodesResponse {
  ok: boolean;
  episodes: Episode[];
  total: number;
  offset: number;
  error?: string;
}

export interface Album {
  id: string;
  name: string;
  artist: string;
  image_url: string | null;
  track_count: number;
  uri: string;
}

export interface AlbumsResponse {
  ok: boolean;
  albums: Album[];
  total: number;
  offset: number;
  error?: string;
}

export async function fetchLikedTracks(offset = 0): Promise<TracksResponse> {
  const res = await fetch(`/api/liked-tracks?offset=${offset}`);
  return jsonOrThrow(res);
}

export async function fetchSavedEpisodes(offset = 0): Promise<EpisodesResponse> {
  const res = await fetch(`/api/episodes?offset=${offset}`);
  return jsonOrThrow(res);
}

export async function fetchFollowedArtists(): Promise<ArtistsResponse> {
  const res = await fetch("/api/artists");
  return jsonOrThrow(res);
}

export async function fetchSavedAlbums(offset = 0): Promise<AlbumsResponse> {
  const res = await fetch(`/api/albums?offset=${offset}`);
  return jsonOrThrow(res);
}

export async function fetchAlbumTracks(id: string, offset = 0): Promise<TracksResponse> {
  const res = await fetch(`/api/albums/${encodeURIComponent(id)}/tracks?offset=${offset}`);
  return jsonOrThrow(res);
}

export async function fetchArtistAlbums(id: string, offset = 0): Promise<AlbumsResponse> {
  const res = await fetch(`/api/artists/${encodeURIComponent(id)}/albums?offset=${offset}`);
  return jsonOrThrow(res);
}

// ── Search API ───────────────────────────────────────────────

export interface SearchResponse {
  ok: boolean;
  tracks: PlaylistTrack[];
  artists: Artist[];
  albums: Album[];
  playlists: Playlist[];
  error?: string;
}

export async function searchSpotify(q: string, offset = 0): Promise<SearchResponse> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&offset=${offset}`);
  return jsonOrThrow(res);
}
