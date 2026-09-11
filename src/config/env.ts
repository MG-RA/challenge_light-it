import fs from 'node:fs';
import path from 'node:path';

// CI injects vars directly, so a missing .env is fine. Vars already set in the
// environment win over the file.
const ENV_FILE = path.resolve(__dirname, '../../.env');
if (fs.existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var "${name}" (see .env.example)`);
  return value;
}

function port(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`Env var "${name}" must be a port number, got "${raw}"`);
  }
  return value;
}

export const env = {
  baseUrl: required('BASE_URL'),
  apiBaseUrl: required('API_BASE_URL'),
  swaggerUrl: process.env.SWAGGER_URL,

  // Credential sections are validated on first access, not at import, so each
  // layer only needs its own secrets (e.g. `npm run test:db` works without app creds).
  get user() {
    return {
      email: required('APP_USER_EMAIL'),
      password: required('APP_USER_PASSWORD'),
      alias: process.env.APP_USER_ALIAS,
    };
  },

  get db() {
    return {
      host: required('DB_HOST'),
      port: port('DB_PORT', 5432),
      database: required('DB_NAME'),
      user: required('DB_USER'),
      password: required('DB_PASSWORD'),
    };
  },
};
