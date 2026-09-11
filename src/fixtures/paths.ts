import path from 'node:path';

const AUTH_DIR = path.resolve(__dirname, '../../.auth');

/** Browser storage state with the JWT seeded into localStorage. */
export const AUTH_STATE_FILE = path.join(AUTH_DIR, 'user.json');
/** Raw JWT for API tests. */
export const AUTH_TOKEN_FILE = path.join(AUTH_DIR, 'token.json');
