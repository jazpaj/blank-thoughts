import http from 'node:http';
import { handler, store } from './app.js';
import { klaviyoEnabled, turnstileEnabled } from './lib/integrations.js';

const PORT = Number(process.env.PORT) || 3000;
const server = http.createServer(handler);

server.listen(PORT, () => {
  console.log(`Blank Thoughts running at http://localhost:${PORT}`);
  console.log(`  waitlist: ${store.count} signup(s) on file`);
  console.log(`  klaviyo: ${klaviyoEnabled() ? 'on' : 'off (local backup only)'} · turnstile: ${turnstileEnabled() ? 'on' : 'off'}`);
});
