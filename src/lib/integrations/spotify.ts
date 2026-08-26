import { createClient } from "@/lib/supabase/server";
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
} from "./crypto";

export const SPOTIFY_SCOPES = [
  "playlist-modify-private",
  "user-read-private",
] as const;

type SpotifyTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
};

type SpotifyIntegration = {
  account_external_id: string | null;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string | null;
  token_expires_at: string | null;
};

function oauthConfig(origin: string) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI ??
    `${origin}/api/integrations/spotify/callback`;
  if (!clientId || !clientSecret) throw new Error("SPOTIFY_NOT_CONFIGURED");
  return { clientId, clientSecret, redirectUri };
}

function basicAuthorization(clientId: string, clientSecret: string) {
  return `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
}

export function spotifyAuthorizationUrl(origin: string, state: string) {
  const { clientId, redirectUri } = oauthConfig(origin);
  const url = new URL("https://accounts.spotify.com/authorize");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SPOTIFY_SCOPES.join(" "),
    show_dialog: "true",
    state,
  }).toString();
  return url.toString();
}

export async function exchangeSpotifyCode(origin: string, code: string) {
  const { clientId, clientSecret, redirectUri } = oauthConfig(origin);
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: basicAuthorization(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const payload = (await response.json()) as SpotifyTokenResponse;
  if (!response.ok || !payload.access_token) {
    console.error("Spotify OAuth exchange failed", response.status, payload.error);
    throw new Error("SPOTIFY_OAUTH_EXCHANGE_FAILED");
  }
  return payload;
}

async function refreshSpotifyToken(origin: string, refreshToken: string) {
  const { clientId, clientSecret } = oauthConfig(origin);
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: basicAuthorization(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const payload = (await response.json()) as SpotifyTokenResponse;
  if (!response.ok || !payload.access_token) {
    console.error("Spotify OAuth refresh failed", response.status, payload.error);
    throw new Error("SPOTIFY_OAUTH_REFRESH_FAILED");
  }
  return payload;
}

async function spotifyFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`https://api.spotify.com/v1/${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    console.error("Spotify API failed", path.split("?")[0], response.status, body.slice(0, 500));
    throw new Error(`SPOTIFY_API_${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function getSpotifyProfile(accessToken: string) {
  return spotifyFetch<{
    id: string;
    display_name: string | null;
    external_urls?: { spotify?: string };
  }>(accessToken, "me");
}

async function validSpotifyAccess(churchId: string, origin: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("church_music_integrations")
    .select(
      "account_external_id, access_token_ciphertext, refresh_token_ciphertext, token_expires_at"
    )
    .eq("church_id", churchId)
    .eq("provider", "SPOTIFY")
    .maybeSingle();
  const integration = data as SpotifyIntegration | null;
  if (!integration) return null;

  const expiresAt = integration.token_expires_at
    ? new Date(integration.token_expires_at).getTime()
    : 0;
  if (expiresAt > Date.now() + 60_000) {
    return {
      accessToken: await decryptIntegrationSecret(
        integration.access_token_ciphertext
      ),
      userId: integration.account_external_id,
    };
  }
  if (!integration.refresh_token_ciphertext) {
    throw new Error("SPOTIFY_RECONNECT_REQUIRED");
  }

  const refreshToken = await decryptIntegrationSecret(
    integration.refresh_token_ciphertext
  );
  const refreshed = await refreshSpotifyToken(origin, refreshToken);
  const encryptedAccess = await encryptIntegrationSecret(refreshed.access_token!);
  const { error } = await supabase
    .from("church_music_integrations")
    .update({
      access_token_ciphertext: encryptedAccess,
      token_expires_at: new Date(
        Date.now() + (refreshed.expires_in ?? 3600) * 1000
      ).toISOString(),
      scopes: refreshed.scope?.split(" ") ?? [...SPOTIFY_SCOPES],
    })
    .eq("church_id", churchId)
    .eq("provider", "SPOTIFY");
  if (error) throw new Error("SPOTIFY_TOKEN_SAVE_FAILED");
  return {
    accessToken: refreshed.access_token,
    userId: integration.account_external_id,
  };
}

export type SpotifyTrackCandidate = {
  trackId: string;
  title: string;
  artists: string;
  album: string;
  imageUrl: string | null;
  spotifyUrl: string;
};

export async function searchSpotifyTracks(input: {
  churchId: string;
  query: string;
  origin: string;
}): Promise<SpotifyTrackCandidate[] | null> {
  const connection = await validSpotifyAccess(input.churchId, input.origin);
  if (!connection) return null;
  const params = new URLSearchParams({
    q: input.query,
    type: "track",
    market: "BR",
    limit: "8",
  });
  const payload = await spotifyFetch<{
    tracks?: {
      items?: Array<{
        id?: string;
        name?: string;
        artists?: Array<{ name?: string }>;
        album?: {
          name?: string;
          images?: Array<{ url?: string }>;
        };
        external_urls?: { spotify?: string };
      }>;
    };
  }>(connection.accessToken, `search?${params.toString()}`);

  return (payload.tracks?.items ?? []).flatMap((track) => {
    if (!track.id || !track.name) return [];
    return [{
      trackId: track.id,
      title: track.name,
      artists: (track.artists ?? []).flatMap((artist) =>
        artist.name ? [artist.name] : []
      ).join(", "),
      album: track.album?.name ?? "",
      imageUrl: track.album?.images?.[1]?.url ?? track.album?.images?.[0]?.url ?? null,
      spotifyUrl:
        track.external_urls?.spotify ??
        `https://open.spotify.com/track/${track.id}`,
    }];
  });
}

export async function syncSpotifyPlaylist(input: {
  churchId: string;
  title: string;
  startsAt: string;
  existingPlaylistId: string | null;
  trackIds: string[];
  origin: string;
}) {
  const connection = await validSpotifyAccess(input.churchId, input.origin);
  if (!connection) return null;
  if (!connection.userId) throw new Error("SPOTIFY_PROFILE_MISSING");
  if (!input.trackIds.length) throw new Error("SPOTIFY_PLAYLIST_NO_TRACKS");

  let playlistId = input.existingPlaylistId;
  if (!playlistId) {
    const date = new Date(input.startsAt).toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
    const playlist = await spotifyFetch<{
      id?: string;
      external_urls?: { spotify?: string };
    }>(
      connection.accessToken,
      `users/${encodeURIComponent(connection.userId)}/playlists`,
      {
        method: "POST",
        body: JSON.stringify({
          name: `${input.title} · ${date} · LUNOR`,
          description:
            "Repertório de ensaio publicado no LUNOR. Letra e cifra oficiais permanecem no aplicativo.",
          public: false,
          collaborative: false,
        }),
      }
    );
    if (!playlist.id) throw new Error("SPOTIFY_PLAYLIST_CREATE_FAILED");
    playlistId = playlist.id;
  }

  await spotifyFetch(
    connection.accessToken,
    `playlists/${encodeURIComponent(playlistId)}/tracks`,
    {
      method: "PUT",
      body: JSON.stringify({
        uris: input.trackIds.map((id) => `spotify:track:${id}`),
      }),
    }
  );

  return {
    playlistId,
    playlistUrl: `https://open.spotify.com/playlist/${playlistId}`,
  };
}
