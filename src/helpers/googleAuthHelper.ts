import * as connectionsService from "../services/connectionsService";
import * as auth from "../integrations/googleOAuthIntegrations";

export async function getValidGoogleAccessToken(userId: string): Promise<string | null> {
  const conn = await connectionsService.getConnectionByProvider(userId, "google");
  if (!conn) return null;

  if (conn.expires_at && new Date(conn.expires_at) < new Date()) {
    const refreshed = await auth.refreshAccessToken(conn.refresh_token);

    await connectionsService.updateConnection(conn.id, {
      access_token: refreshed.access_token,
      expires_at: new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000),
    });

    return refreshed.access_token;
  }

  return conn.access_token;
}
