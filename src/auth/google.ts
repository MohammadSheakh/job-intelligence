export interface GoogleUser {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

function requiredConfig(): { clientId: string; clientSecret: string; redirectUri: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const base = process.env.PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
  if (!clientId || !clientSecret || !base) return null;
  return { clientId, clientSecret, redirectUri: `${base}/auth/google/callback` };
}

export function googleLoginEnabled(): boolean {
  return Boolean(requiredConfig());
}

export function googleAuthorizationUrl(state: string): string {
  const config = requiredConfig();
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

export async function exchangeGoogleCode(code: string): Promise<GoogleUser> {
  const config = requiredConfig();
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
  });
  if (!tokenResponse.ok) throw new Error(`Google token exchange failed (${tokenResponse.status}).`);
  const token = await tokenResponse.json() as { access_token?: string };
  if (!token.access_token) throw new Error('Google did not return an access token.');

  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  if (!profileResponse.ok) throw new Error(`Google profile request failed (${profileResponse.status}).`);
  const profile = await profileResponse.json() as { sub?:string; email?:string; email_verified?:boolean; name?:string };
  if (!profile.sub || !profile.email || profile.email_verified !== true) throw new Error('Google email is not verified.');
  return { sub:profile.sub, email:profile.email, emailVerified:true, name:profile.name };
}
