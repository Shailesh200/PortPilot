/** JWT signature verify (jwt.io-style) using Web Crypto. */

export type JwtVerifyResult =
  | { status: 'empty' }
  | { status: 'unsupported'; alg: string }
  | { status: 'ok' }
  | { status: 'invalid' }
  | { status: 'error'; message: string }

const HMAC: Record<string, string> = {
  HS256: 'SHA-256',
  HS384: 'SHA-384',
  HS512: 'SHA-512'
}

const RSA: Record<string, string> = {
  RS256: 'SHA-256',
  RS384: 'SHA-384',
  RS512: 'SHA-512'
}

const ECDSA: Record<string, { hash: string; namedCurve: string }> = {
  ES256: { hash: 'SHA-256', namedCurve: 'P-256' },
  ES384: { hash: 'SHA-384', namedCurve: 'P-384' },
  ES512: { hash: 'SHA-512', namedCurve: 'P-521' }
}

export function jwtAlg(header: unknown): string {
  if (!header || typeof header !== 'object' || Array.isArray(header)) return ''
  const alg = (header as { alg?: unknown }).alg
  return typeof alg === 'string' ? alg.toUpperCase() : ''
}

function b64urlToBytes(part: string): Uint8Array {
  let b64 = part.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function pemToSpki(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out.buffer
}

function toArrayBuffer(u: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(u.byteLength)
  new Uint8Array(copy).set(u)
  return copy
}

function secretBytes(secret: string, base64: boolean): Uint8Array {
  if (!base64) return new TextEncoder().encode(secret)
  try {
    return b64urlToBytes(secret.replace(/\s+/g, ''))
  } catch {
    return new TextEncoder().encode(secret)
  }
}

export async function verifyJwtSignature(
  token: string,
  secret: string,
  opts?: { secretBase64?: boolean }
): Promise<JwtVerifyResult> {
  const trimmed = token.trim()
  const key = secret.trim()
  if (!key) return { status: 'empty' }
  const parts = trimmed.split('.')
  if (parts.length !== 3 || !parts[2]) {
    return { status: 'error', message: 'Token needs a signature segment' }
  }
  let header: unknown
  try {
    const json = new TextDecoder().decode(b64urlToBytes(parts[0]))
    header = JSON.parse(json)
  } catch {
    return { status: 'error', message: 'Could not read header' }
  }
  const alg = jwtAlg(header)
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  const sig = b64urlToBytes(parts[2])

  try {
    if (HMAC[alg]) {
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        toArrayBuffer(secretBytes(key, Boolean(opts?.secretBase64))),
        { name: 'HMAC', hash: HMAC[alg] },
        false,
        ['verify']
      )
      const ok = await crypto.subtle.verify(
        'HMAC',
        cryptoKey,
        toArrayBuffer(sig),
        data
      )
      return ok ? { status: 'ok' } : { status: 'invalid' }
    }
    if (RSA[alg]) {
      const cryptoKey = await crypto.subtle.importKey(
        'spki',
        pemToSpki(key),
        { name: 'RSASSA-PKCS1-v1_5', hash: RSA[alg] },
        false,
        ['verify']
      )
      const ok = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        toArrayBuffer(sig),
        data
      )
      return ok ? { status: 'ok' } : { status: 'invalid' }
    }
    if (ECDSA[alg]) {
      const spec = ECDSA[alg]
      const cryptoKey = await crypto.subtle.importKey(
        'spki',
        pemToSpki(key),
        { name: 'ECDSA', namedCurve: spec.namedCurve },
        false,
        ['verify']
      )
      const ok = await crypto.subtle.verify(
        { name: 'ECDSA', hash: spec.hash },
        cryptoKey,
        toArrayBuffer(sig),
        data
      )
      return ok ? { status: 'ok' } : { status: 'invalid' }
    }
    return { status: 'unsupported', alg: alg || 'unknown' }
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Could not verify'
    }
  }
}
