import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env';

const AUTH_DIR = path.resolve(__dirname, '../../.auth');
const TOKEN_FILE = path.join(AUTH_DIR, 'token.json');

/** Browser storage state with the JWT seeded into localStorage (the ui project's storageState). */
export const AUTH_STATE_FILE = path.join(AUTH_DIR, 'user.json');

/** Persists the JWT for the API fixtures and for the browser, where the SPA reads it from localStorage.token. */
export function saveSession(token: string): void {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token }));
  fs.writeFileSync(
    AUTH_STATE_FILE,
    JSON.stringify({
      cookies: [],
      origins: [{ origin: new URL(env.baseUrl).origin, localStorage: [{ name: 'token', value: token }] }],
    }),
  );
}

export function loadToken(): string {
  if (!fs.existsSync(TOKEN_FILE)) {
    throw new Error(`No auth token at ${TOKEN_FILE}. Run the "setup" project first (don't pass --no-deps).`);
  }
  return (JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')) as { token: string }).token;
}
