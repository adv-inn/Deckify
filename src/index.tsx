import { useEffect, useState, useCallback, useRef, FC } from "react";
import {
  PanelSection,
  PanelSectionRow,
  ToggleField,
  Field,
  DropdownItem,
  ButtonItem,
  SliderField,
  Focusable,
  DialogButton,
  staticClasses,
} from "@decky/ui";
import {
  callable,
  addEventListener,
  removeEventListener,
  definePlugin,
  toaster,
} from "@decky/api";
import { FaMusic, FaSpotify, FaPlay, FaPause, FaStepBackward, FaStepForward } from "react-icons/fa";
import { QRCodeSVG } from "qrcode.react";

const backendStart = callable<[], { ok: boolean; error?: string; pid?: number }>("start_librespot");
const backendStop = callable<[], { ok: boolean }>("stop_librespot");
const backendGetStatus = callable<[], {
  running: boolean;
  binary_found: boolean;
  settings: Settings;
  last_event: LibrespotEvent | null;
  track_meta: TrackMetadata | null;
  active_device: { id: string; name: string; type: string } | null;
  is_playing: boolean;
  position_ms: number;
  duration_ms: number;
}>("get_status");
const backendSetSetting = callable<[string, any], { ok: boolean; settings?: Settings }>("set_setting");
const backendStartOAuth = callable<[], { ok: boolean; landing_url?: string; redirect_uri?: string; error?: string }>("start_oauth");
const backendGetAuthStatus = callable<[], { authenticated: boolean; needs_reauth: boolean }>("get_auth_status");
const backendLogout = callable<[], { ok: boolean }>("logout_spotify");
const backendControlPlayback = callable<[string, string], { ok: boolean; error?: string }>("control_playback");
const backendSetVolume = callable<[number], { ok: boolean; error?: string }>("set_volume");
const backendGetDashboardUrl = callable<[], { ok: boolean; url: string }>("get_dashboard_url");
const backendGetDevices = callable<[], { ok: boolean; devices?: SpotifyDevice[]; error?: string }>("get_devices");
const backendTransferPlayback = callable<[string], { ok: boolean; error?: string }>("transfer_playback");

interface Settings {
  device_name: string;
  bitrate: number;
  spotify_client_id: string;
}

interface LibrespotEvent {
  event: string;
  track_id?: string;
  old_track_id?: string;
  duration_ms?: number;
  position_ms?: number;
  volume?: number;
}

interface StatusPayload {
  running: boolean;
  error?: string | null;
  auto_restarting?: boolean;
}

interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent: number | null;
}

interface TrackMetadata {
  track_id: string;
  name: string;
  artist: string;
  album: string;
  artwork_url: string | null;
  duration_ms: number;
}

const BITRATE_OPTIONS = [
  { data: 96, label: "96 kbps" },
  { data: 160, label: "160 kbps" },
  { data: 320, label: "320 kbps" },
];

function playerEventToLabel(event: string | undefined): string {
  switch (event) {
    case "playing":
    case "started":
      return "Playing";
    case "paused":
      return "Paused";
    case "stopped":
    case "unavailable":
      return "Stopped";
    case "changed":
    case "preloading":
      return "Loading";
    case "volume_set":
      return "Playing";
    default:
      return event ?? "Unknown";
  }
}

const Content: FC = () => {
  const [running, setRunning] = useState(false);
  const [binaryFound, setBinaryFound] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<LibrespotEvent | null>(null);
  const [settings, setSettings] = useState<Settings>({
    device_name: "Steam Deck",
    bitrate: 320,
    spotify_client_id: "",
  });
  const [toggling, setToggling] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [trackMeta, setTrackMeta] = useState<TrackMetadata | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [restartNeeded, setRestartNeeded] = useState(false);
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const activeDeviceIdRef = useRef<string>("");
  const updateDevices = useCallback((devs: SpotifyDevice[]) => {
    setDevices(devs);
    activeDeviceIdRef.current = devs.find((d) => d.is_active)?.id ?? devs[0]?.id ?? "";
  }, []);
  const volumeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeChangeSourceRef = useRef<"user" | "remote">("remote");

  useEffect(() => {
    backendGetStatus().then((status) => {
      setRunning(status.running);
      setBinaryFound(status.binary_found);
      setSettings(status.settings);
      setLastEvent(status.last_event);
      if (status.track_meta) {
        setTrackMeta(status.track_meta);
      }
      if (status.is_playing) {
        setIsPlaying(true);
      }
    });
    backendGetAuthStatus().then((s) => {
      setAuthenticated(s.authenticated);
      setNeedsReauth(s.needs_reauth);
      if (s.authenticated) {
        backendGetDevices().then((r) => { if (r.ok && r.devices && r.devices.length > 0) updateDevices(r.devices); });
      }
    });
  }, [updateDevices]);

  // Periodic device list refresh
  useEffect(() => {
    if (!authenticated) return;
    const interval = setInterval(async () => {
      const r = await backendGetDevices();
      if (r.ok && r.devices && r.devices.length > 0) updateDevices(r.devices);
    }, 30000);
    return () => clearInterval(interval);
  }, [authenticated]);

  // Listen to backend events
  useEffect(() => {
    const onStatus = (payload: StatusPayload) => {
      setRunning(payload.running);
      setError(payload.error ?? null);
      if (payload.error) {
        toaster.toast({
          title: "Deckify",
          body: payload.error,
          duration: 5000,
          icon: <FaMusic />,
        });
      }
    };
    const onEvent = (event: LibrespotEvent) => {
      setLastEvent(event);
      const etype = event.event;
      if (etype === "playing" || etype === "started") {
        setIsPlaying(true);
      } else if (etype === "paused") {
        setIsPlaying(false);
      } else if (etype === "stopped" || etype === "unavailable") {
        setIsPlaying(false);
        setTrackMeta(null);
      } else if (etype === "volume_set" && event.volume !== undefined) {
        if (volumeChangeSourceRef.current !== "user") {
          setVolume(event.volume);
        }
      }
    };
    const onOAuthComplete = (payload: { authenticated: boolean }) => {
      setAuthenticated(payload.authenticated);
      setNeedsReauth(false);
      setOauthLoading(false);
      setQrCodeUrl(null);
      toaster.toast({
        title: "Deckify",
        body: "Spotify account connected!",
        duration: 3000,
        icon: <FaSpotify />,
      });
    };
    const onTrackMeta = (meta: TrackMetadata) => {
      setTrackMeta(meta);
    };

    const onDeviceChanged = () => {
      backendGetDevices().then((r) => { if (r.ok && r.devices && r.devices.length > 0) updateDevices(r.devices); });
    };

    const regStatus = addEventListener<[StatusPayload]>("librespot_status", onStatus);
    const regEvent = addEventListener<[LibrespotEvent]>("librespot_event", onEvent);
    const regOAuth = addEventListener<[{ authenticated: boolean }]>("oauth_complete", onOAuthComplete);
    const regMeta = addEventListener<[TrackMetadata]>("track_metadata", onTrackMeta);
    const regDevice = addEventListener("device_changed", onDeviceChanged);

    return () => {
      removeEventListener("librespot_status", regStatus);
      removeEventListener("librespot_event", regEvent);
      removeEventListener("oauth_complete", regOAuth);
      removeEventListener("track_metadata", regMeta);
      removeEventListener("device_changed", regDevice);
    };
  }, []);

  // Progress bar tick
const handleToggle = useCallback(async (checked: boolean) => {
    setToggling(true);
    try {
      if (checked) {
        const result = await backendStart();
        if (!result.ok) {
          setError(result.error ?? "Failed to start");
        }
      } else {
        await backendStop();
        setLastEvent(null);
        setTrackMeta(null);
        setIsPlaying(false);
      }
    } finally {
      setToggling(false);
    }
  }, []);

  const handleSettingChange = useCallback(async (key: string, value: any) => {
    const result = await backendSetSetting(key, value);
    if (result.ok && result.settings) {
      setSettings(result.settings);
      if ((key === "device_name" || key === "bitrate") && running) {
        setRestartNeeded(true);
      }
    }
  }, [running]);

  const handleOAuthStart = useCallback(async () => {
    setOauthLoading(true);
    try {
      const result = await backendStartOAuth();
      if (result.ok && result.landing_url) {
        setQrCodeUrl(result.landing_url);
      } else {
        setOauthLoading(false);
        toaster.toast({
          title: "Deckify",
          body: result.error ?? "Failed to start OAuth",
          duration: 5000,
          icon: <FaMusic />,
        });
      }
    } catch {
      setOauthLoading(false);
    }
  }, []);

  const handleOAuthCancel = useCallback(() => {
    setOauthLoading(false);
    setQrCodeUrl(null);
  }, []);

  const handleLogout = useCallback(async () => {
    await backendLogout();
    setAuthenticated(false);
    setNeedsReauth(false);
    setTrackMeta(null);
    setQrCodeUrl(null);
  }, []);

  const handlePlaybackControl = useCallback(async (action: string) => {
    const result = await backendControlPlayback(action, activeDeviceIdRef.current);
    if (!result.ok) {
      toaster.toast({
        title: "Deckify",
        body: result.error ?? "Playback control failed",
        duration: 3000,
        icon: <FaMusic />,
      });
    }
  }, []);

  const handleVolumeChange = useCallback((value: number) => {
    setVolume(value);
    volumeChangeSourceRef.current = "user";
    if (volumeDebounceRef.current) clearTimeout(volumeDebounceRef.current);
    volumeDebounceRef.current = setTimeout(async () => {
      await backendSetVolume(value);
      // Allow remote updates again after a short delay
      setTimeout(() => { volumeChangeSourceRef.current = "remote"; }, 500);
    }, 300);
  }, []);

  const handleRefreshDevices = useCallback(async () => {
    const result = await backendGetDevices();
    if (result.ok && result.devices && result.devices.length > 0) {
      updateDevices(result.devices);
    }
  }, [updateDevices]);

  const handleTransferPlayback = useCallback(async (opt: { data: string; label: string }) => {
    const result = await backendTransferPlayback(opt.data);
    if (!result.ok) {
      toaster.toast({ title: "Deckify", body: result.error ?? "Transfer failed", duration: 3000, icon: <FaMusic /> });
    } else {
      activeDeviceIdRef.current = opt.data;
      setTimeout(() => handleRefreshDevices(), 1000);
    }
  }, [handleRefreshDevices]);

  const handleRestart = useCallback(async () => {
    await backendStop();
    setLastEvent(null);
    setTrackMeta(null);
    setIsPlaying(false);
    const result = await backendStart();
    if (!result.ok) {
      setError(result.error ?? "Failed to restart");
    }
    setRestartNeeded(false);
  }, []);

  const playState = lastEvent ? playerEventToLabel(lastEvent.event) : "Idle";
  const trackId = lastEvent?.track_id ?? "—";
  const showRichMedia = (authenticated || running) && trackMeta;
  return (
    <>
      <PanelSection title="Deckify">
        {!binaryFound && (
          <PanelSectionRow>
            <Field
              label="librespot Not Found"
              description="Download the librespot binary from github.com/librespot-org/librespot/releases and place it at plugin/bin/librespot on your Steam Deck."
            >
              <span style={{ color: "#ff4444" }}>Setup Required</span>
            </Field>
          </PanelSectionRow>
        )}

        <PanelSectionRow>
          <ToggleField
            label="Spotify Connect"
            description={running ? "Running" : "Stopped"}
            checked={running}
            disabled={toggling || !binaryFound}
            onChange={handleToggle}
          />
        </PanelSectionRow>

        {error && (
          <PanelSectionRow>
            <Field label="Error">
              <span style={{ color: "#ff4444" }}>{error}</span>
            </Field>
          </PanelSectionRow>
        )}

        {showRichMedia ? (
          <>
            <PanelSectionRow>
              <Field
                label={trackMeta.name}
                description={`${trackMeta.artist} — ${trackMeta.album}`}
                icon={
                  trackMeta.artwork_url ? (
                    <img
                      src={trackMeta.artwork_url}
                      width={40}
                      height={40}
                      style={{ borderRadius: 4 }}
                    />
                  ) : (
                    <FaMusic />
                  )
                }
              >
                {playState}
              </Field>
            </PanelSectionRow>
          </>
        ) : running ? (
          <>
            <PanelSectionRow>
              <Field label="Status">{playState}</Field>
            </PanelSectionRow>
            {lastEvent?.track_id && (
              <PanelSectionRow>
                <Field label="Track ID">
                  <span style={{ fontSize: "0.8em", wordBreak: "break-all" }}>{trackId}</span>
                </Field>
              </PanelSectionRow>
            )}
          </>
        ) : null}

        {authenticated && (
          <>
            <PanelSectionRow>
              <Focusable style={{ display: "flex", justifyContent: "center", gap: "12px" }} flow-children="right">
                <DialogButton
                  style={{ minWidth: "auto", padding: "10px 16px" }}
                  onClick={(e: MouseEvent) => { (e.currentTarget as HTMLElement).blur(); handlePlaybackControl("previous"); }}
                >
                  <FaStepBackward />
                </DialogButton>
                <DialogButton
                  style={{ minWidth: "auto", padding: "10px 20px" }}
                  onClick={(e: MouseEvent) => { (e.currentTarget as HTMLElement).blur(); handlePlaybackControl(isPlaying ? "pause" : "play"); }}
                >
                  {isPlaying ? <FaPause /> : <FaPlay />}
                </DialogButton>
                <DialogButton
                  style={{ minWidth: "auto", padding: "10px 16px" }}
                  onClick={(e: MouseEvent) => { (e.currentTarget as HTMLElement).blur(); handlePlaybackControl("next"); }}
                >
                  <FaStepForward />
                </DialogButton>
              </Focusable>
            </PanelSectionRow>
            <PanelSectionRow>
              <SliderField
                label="Volume"
                value={volume}
                min={0}
                max={100}
                step={1}
                showValue
                valueSuffix="%"
                onChange={handleVolumeChange}
              />
            </PanelSectionRow>
            {devices.length > 0 && (
              <PanelSectionRow>
                <DropdownItem
                  label="Device"
                  rgOptions={devices.map((d) => ({
                    data: d.id,
                    label: d.name,
                  }))}
                  selectedOption={devices.find((d) => d.is_active)?.id ?? devices[0]?.id}
                  onChange={handleTransferPlayback}
                />
              </PanelSectionRow>
            )}
            <PanelSectionRow>
              <ButtonItem label="Refresh Devices" onClick={handleRefreshDevices}>
                Refresh
              </ButtonItem>
            </PanelSectionRow>
          </>
        )}
      </PanelSection>

      <PanelSection title="Spotify Account">
        {authenticated && needsReauth && (
          <PanelSectionRow>
            <ButtonItem
              label="Reconnect Required"
              description="New features need updated permissions. Please reconnect your Spotify account."
              onClick={handleOAuthStart}
            >
              {oauthLoading ? "Waiting..." : "Reconnect"}
            </ButtonItem>
          </PanelSectionRow>
        )}
        {qrCodeUrl ? (
          <>
            <PanelSectionRow>
              <Field
                label="Scan with Phone"
                description="Scan this QR code to login with Spotify"
              >
                <></>
              </Field>
            </PanelSectionRow>
            <PanelSectionRow>
              <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
                <QRCodeSVG value={qrCodeUrl} size={160} bgColor="#1a1a2e" fgColor="#ffffff" />
              </div>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem label="Cancel" onClick={handleOAuthCancel}>
                Cancel
              </ButtonItem>
            </PanelSectionRow>
          </>
        ) : (
          <PanelSectionRow>
            {authenticated ? (
              <ButtonItem label="Connected" description="Spotify account linked" onClick={handleLogout}>
                Disconnect
              </ButtonItem>
            ) : (
              <ButtonItem
                label="Spotify Login"
                description="Scan QR code on your phone to connect"
                disabled={oauthLoading}
                onClick={handleOAuthStart}
              >
                {oauthLoading ? "Waiting..." : "Connect"}
              </ButtonItem>
            )}
          </PanelSectionRow>
        )}
        <PanelSectionRow>
          <ButtonItem
            label="Dashboard"
            description="Open full control panel in browser"
            onClick={async () => {
              const res = await backendGetDashboardUrl();
              if (res.ok) {
                (window as any).SteamClient?.System?.OpenInSystemBrowser?.(res.url);
              }
            }}
          >
            Open Dashboard
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Settings">
        {restartNeeded && (
          <PanelSectionRow>
            <ButtonItem
              label="Restart Required"
              description="Settings changed. Restart librespot to apply."
              onClick={handleRestart}
            >
              Restart Now
            </ButtonItem>
          </PanelSectionRow>
        )}

        <PanelSectionRow>
          <DropdownItem
            label="Audio Quality"
            rgOptions={BITRATE_OPTIONS}
            selectedOption={settings.bitrate}
            onChange={(opt) => handleSettingChange("bitrate", opt.data)}
          />
        </PanelSectionRow>

      </PanelSection>
    </>
  );
};

export default definePlugin(() => {
  console.log("Deckify initializing");

  return {
    name: "Deckify",
    titleView: <div className={staticClasses.Title}>Deckify</div>,
    content: <Content />,
    icon: <FaMusic />,
    onDismount() {
      console.log("Deckify dismounting");
    },
  };
});
