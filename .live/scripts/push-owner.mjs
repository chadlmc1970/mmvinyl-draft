// Push the fresh dashboard JSON to the owner dashboard on mandmvinyl.com.
// Env: MM_OWNER_DROP_KEY (shared with the "MM Owner Data Drop" WPCode snippet), optional MM_OWNER_DROP_URL.
// Usage: node push-owner.mjs <folder with *.json>
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';

const key = process.env.MM_OWNER_DROP_KEY || '';
const url = process.env.MM_OWNER_DROP_URL || 'https://mandmvinyl.com/wp-json/mm/v1/owner/data';
const dir = process.argv[2];
if (key.length < 32 || !dir) {
  console.error('push-owner: missing key or folder');
  process.exit(2);
}

const files = {};
for (const name of readdirSync(dir).filter((n) => /^[a-z0-9-]+\.json$/.test(n)).sort()) {
  const text = readFileSync(join(dir, name), 'utf8');
  JSON.parse(text);
  files[name] = text;
}
if (!Object.keys(files).length) {
  console.error('push-owner: no files');
  process.exit(2);
}

const body = JSON.stringify({ files });
for (let attempt = 1; attempt <= 3; attempt++) {
  const time = String(Math.floor(Date.now() / 1000));
  const sig = createHmac('sha256', key).update(`${time}.${body}`).digest('hex');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-MM-Time': time, 'X-MM-Sig': sig, 'User-Agent': 'mm-owner-dashboard-refresh' },
      body,
      signal: AbortSignal.timeout(60000),
    });
    const text = await res.text();
    if (res.ok) {
      console.log(`push-owner: ${res.status} ${text.slice(0, 200)}`);
      process.exit(0);
    }
    console.error(`push-owner: attempt ${attempt} got ${res.status} ${text.slice(0, 200)}`);
    if (res.status === 401 || res.status === 400) break;
  } catch (err) {
    console.error(`push-owner: attempt ${attempt} failed: ${err.message}`);
  }
  await new Promise((r) => setTimeout(r, 5000 * attempt));
}
process.exit(1);
