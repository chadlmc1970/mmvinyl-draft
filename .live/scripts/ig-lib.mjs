import { execFileSync } from 'node:child_process';

const DEFAULT_BASE = 'https://graph.instagram.com';
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);
export function baseUrl() {
  const override = process.env.IG_BASE;
  if (!override) return DEFAULT_BASE;
  try {
    if (LOOPBACK.has(new URL(override).hostname)) return override;
  } catch {}
  return DEFAULT_BASE;
}
export const SERVICE = 'mm-vinyl-ig-token';

export function token() {
  if (process.env.IG_TOKEN) return process.env.IG_TOKEN;
  try {
    return execFileSync('security', ['find-generic-password', '-s', SERVICE, '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

export async function call(path, params = {}, method = 'GET') {
  const tok = token();
  if (!tok) throw new Error(`No token in Keychain (service ${SERVICE})`);
  const url = new URL(`${baseUrl()}${path}`);
  const body = new URLSearchParams({ ...params, access_token: tok });
  if (method === 'GET') body.forEach((v, k) => url.searchParams.set(k, v));
  const res = await fetch(url, method === 'GET' ? { signal: AbortSignal.timeout(15000) } : { method, body, signal: AbortSignal.timeout(15000) });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
  }
  if (!res.ok) throw new Error(JSON.stringify(json.error ?? json));
  return json;
}
