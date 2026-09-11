import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var "${name}" (see .env.example)`);
  return value;
}

export const env = {
  baseUrl: required('BASE_URL'),
  apiBaseUrl: required('API_BASE_URL'),
  swaggerUrl: process.env.SWAGGER_URL,
  user: {
    email: required('APP_USER_EMAIL'),
    password: required('APP_USER_PASSWORD'),
    alias: process.env.APP_USER_ALIAS,
  },
  db: {
    host: required('DB_HOST'),
    port: Number(process.env.DB_PORT ?? 5432),
    database: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
  },
} as const;
