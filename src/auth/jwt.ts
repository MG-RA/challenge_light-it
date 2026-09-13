// Token manipulation for forged-token authorization tests. No secrets involved:
// forged tokens keep (or drop) the original signature, so a correct server rejects them.

type JwtPart = Record<string, unknown>;

function decodePart(part: string | undefined): JwtPart {
  if (!part) throw new Error('Not a JWT: expected header.payload.signature');
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as JwtPart;
}

function encodePart(value: JwtPart): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function decodeJwtPayload(token: string): JwtPart {
  return decodePart(token.split('.')[1]);
}

/** Re-encodes `token` with merged header/payload overrides, keeping its signature unless one is given. */
export function forgeJwt(
  token: string,
  overrides: { header?: JwtPart; payload?: JwtPart; signature?: string },
): string {
  const [header, payload, signature] = token.split('.');
  return [
    encodePart({ ...decodePart(header), ...overrides.header }),
    encodePart({ ...decodePart(payload), ...overrides.payload }),
    overrides.signature ?? signature ?? '',
  ].join('.');
}
