import { createClient } from "@/lib/supabase/server";
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
} from "./crypto";

export const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube";

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type YouTubeIntegration = {
  access_token_ciphertext: string;
  refresh_token_ciphertext: string | null;
  token_expires_at: string | null;
};

type PlaylistItem = {
  videoId: string;
};

function oauthConfig(origin: string) {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  const redirectUri =
    process.env.YOUTUBE_OAUTH_REDIRECT_URI ??
    `${origin}/api/integrations/youtube/callback`;
  if (!clientId || !clientSecret) {
    throw new Error("YOUTUBE_OAUTH_NOT_CONFIGURED");
  }
  return { clientId, clientSecret, redirectUri };
}

export function youtubeAuthorizationUrl(origin: string, state: string): string {
  const { clientId, redirectUri } = oauthConfig(origin);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: YOUTUBE_SCOPE,
    state,
  }).toString();
  return url.toString();
}

export async function exchangeYouTubeCode(origin: string, code: string) {
  const { clientId, clientSecret, redirectUri } = oauthConfig(origin);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const payload = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    console.error("YouTube OAuth exchange failed", response.status, payload.error);
    throw new Error("YOUTUBE_OAUTH_EXCHANGE_FAILED");
  }
  return payload;
}

async function refreshYouTubeToken(origin: string, refreshToken: string) {
  const { clientId, clientSecret } = oauthConfig(origin);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const payload = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    console.error("YouTube OAuth refresh failed", response.status, payload.error);
    throw new Error("YOUTUBE_OAUTH_REFRESH_FAILED");
  }
  return payload;
}

async function youtubeFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`https://www.googleapis.com/youtube/v3/${path}`, {
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
    console.error("YouTube API failed", path.split("?")[0], response.status, body.slice(0, 500));
    throw new Error(`YOUTUBE_API_${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function getYouTubeChannel(accessToken: string) {
  const payload = await youtubeFetch<{
    items?: Array<{ id?: string; snippet?: { title?: string } }>;
  }>(accessToken, "channels?part=id%2Csnippet&mine=true");
  const channel = payload.items?.[0];
  return {
    id: channel?.id ?? null,
    title: channel?.snippet?.title ?? "Conta YouTube conectada",
  };
}

async function validAccessToken(churchId: string, origin: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("church_music_integrations")
    .select(
      "access_token_ciphertext, refresh_token_ciphertext, token_expires_at"
    )
    .eq("church_id", churchId)
    .eq("provider", "YOUTUBE")
    .maybeSingle();

  const integration = data as YouTubeIntegration | null;
  if (!integration) return null;

  const expiresAt = integration.token_expires_at
    ? new Date(integration.token_expires_at).getTime()
    : 0;
  if (expiresAt > Date.now() + 60_000) {
    return decryptIntegrationSecret(integration.access_token_ciphertext);
  }
  if (!integration.refresh_token_ciphertext) {
    throw new Error("YOUTUBE_RECONNECT_REQUIRED");
  }

  const refreshToken = await decryptIntegrationSecret(
    integration.refresh_token_ciphertext
  );
  const refreshed = await refreshYouTubeToken(origin, refreshToken);
  const encryptedAccess = await encryptIntegrationSecret(refreshed.access_token!);
  const tokenExpiresAt = new Date(
    Date.now() + (refreshed.expires_in ?? 3600) * 1000
  ).toISOString();
  const { error } = await supabase
    .from("church_music_integrations")
    .update({
      access_token_ciphertext: encryptedAccess,
      token_expires_at: tokenExpiresAt,
      scopes: refreshed.scope?.split(" ") ?? [YOUTUBE_SCOPE],
    })
    .eq("church_id", churchId)
    .eq("provider", "YOUTUBE");
  if (error) throw new Error("YOUTUBE_TOKEN_SAVE_FAILED");
  return refreshed.access_token;
}

export async function syncYouTubePlaylist(input: {
  churchId: string;
  eventId: string;
  title: string;
  startsAt: string;
  existingPlaylistId: string | null;
  items: PlaylistItem[];
  origin: string;
}) {
  const accessToken = await validAccessToken(input.churchId, input.origin);
  if (!accessToken) return null;
  if (!input.items.length) throw new Error("YOUTUBE_PLAYLIST_NO_VIDEOS");

  let playlistId = input.existingPlaylistId;
  if (!playlistId) {
    const date = new Date(input.startsAt).toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
    const created = await youtubeFetch<{ id?: string }>(
      accessToken,
      "playlists?part=snippet%2Cstatus",
      {
        method: "POST",
        body: JSON.stringify({
          snippet: {
            title: `${input.title} · ${date} · LUNOR`,
            description:
              "Repertório de ensaio publicado no LUNOR. Letra e cifra oficiais permanecem no aplicativo.",
          },
          status: { privacyStatus: "unlisted" },
        }),
      }
    );
    if (!created.id) throw new Error("YOUTUBE_PLAYLIST_CREATE_FAILED");
    playlistId = created.id;
  } else {
    const existing = await youtubeFetch<{
      items?: Array<{ id?: string }>;
    }>(
      accessToken,
      `playlistItems?part=id&maxResults=50&playlistId=${encodeURIComponent(
        playlistId
      )}`
    );
    for (const item of existing.items ?? []) {
      if (!item.id) continue;
      await youtubeFetch<void>(
        accessToken,
        `playlistItems?id=${encodeURIComponent(item.id)}`,
        { method: "DELETE" }
      );
    }
  }

  for (let position = 0; position < input.items.length; position += 1) {
    await youtubeFetch(
      accessToken,
      "playlistItems?part=snippet",
      {
        method: "POST",
        body: JSON.stringify({
          snippet: {
            playlistId,
            position,
            resourceId: {
              kind: "youtube#video",
              videoId: input.items[position].videoId,
            },
          },
        }),
      }
    );
  }

  return {
    playlistId,
    playlistUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
  };
}
