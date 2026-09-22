import { Injectable, Logger } from '@nestjs/common';

export interface GoogleUser {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Handles Google OAuth 2.0 authorization URL creation, token exchange, and profile verification.
 */
@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  /**
   * Reads OAuth credentials and derives callback redirect URI.
   * Returns null if Google OAuth is not configured in the environment.
   */
  getConfig(): GoogleOAuthConfig | null {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) return null;

    const base =
      process.env.API_BASE_URL?.trim().replace(/\/$/, '') ||
      (process.env.PUBLIC_BASE_URL
        ? `${process.env.PUBLIC_BASE_URL.trim().replace(/\/$/, '')}/api/v1`
        : 'http://localhost:4000/api/v1');

    const redirectUri =
      process.env.GOOGLE_CALLBACK_URL?.trim() || `${base}/candidate-auth/google/callback`;

    return { clientId, clientSecret, redirectUri };
  }

  /** Check whether Google OAuth is configured and available. */
  isEnabled(): boolean {
    return Boolean(this.getConfig());
  }

  /** Build the Google OAuth 2.0 consent screen redirect URL with an anti-forgery state. */
  getAuthorizationUrl(state: string): string {
    const config = this.getConfig();
    if (!config) throw new Error('Google login is not configured.');

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', config.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'select_account');
    return url.toString();
  }

  /**
   * Exchange the authorization code for an access token and retrieve verified userinfo.
   * Rejects unverified email accounts.
   */
  async exchangeCode(code: string): Promise<GoogleUser> {
    const config = this.getConfig();
    if (!config) throw new Error('Google login is not configured.');

    const body = new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    });

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(15_000),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Google token exchange failed (${tokenResponse.status}).`);
    }

    const token = (await tokenResponse.json()) as { access_token?: string };
    if (!token.access_token) {
      throw new Error('Google did not return an access token.');
    }

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(15_000),
    });

    if (!profileResponse.ok) {
      throw new Error(`Google profile request failed (${profileResponse.status}).`);
    }

    const profile = (await profileResponse.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
    };

    if (!profile.sub || !profile.email || profile.email_verified !== true) {
      throw new Error('Google email is not verified.');
    }

    return {
      sub: profile.sub,
      email: profile.email,
      emailVerified: true,
      name: profile.name,
    };
  }
}
