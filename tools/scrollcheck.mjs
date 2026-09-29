// Scroll-stability probe: repeatedly scrolls, interacts with the contribution
// slider and chat, triggers refetches, and re-navigates, then reports whether
// the layout jumped, flickered, or lost its scroll position.
//   node tools/scrollcheck.mjs <email> <password> [path]
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9700 + (process.pid % 200);
const ORIGIN = "http://127.0.0.1:5173";
const API = "http://localhost:5000/api";
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const PROFILE = ROOT + `.chrome-profile-${process.pid}`;

const [email, password, path = "/app/bookings"] = process.argv.slice(2);
mkdirSync(ROOT + "shots\\", { recursive: true });

const res = await fetch(`${API}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`);
const token = (await res.json()).token;

const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  "--disable-gpu",
  "--hide-scrollbars",
  "--no-first-run",
  "--no-default-browser-check",
  "--user-data-dir=" + PROFILE,
  "--window-size=1526,1030",
  "about:blank",
], { stdio: "ignore" });

const cleanup = () => {
  try { chrome.kill(); } catch { /* gone */ }
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* best effort */ }
};
process.on("exit", cleanup);

let wsUrl = "";
for (let i = 0; i < 120; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    wsUrl = (await r.json()).webSocketDebuggerUrl;
    if (wsUrl) break;
  } catch { /* not up yet */ }
  await sleep(500);
}
if (!wsUrl) throw new Error("Chrome did not expose a debugging endpoint");

const browser = new WebSocket(wsUrl);
await new Promise((r, j) => { browser.onopen = r; browser.onerror = j; });

let nextId = 0;
const pending = new Map();
browser.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
  }
};
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    browser.send(JSON.stringify({ id, method, params, sessionId }));
  });

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);
await send("Runtime.enable", {}, sessionId);

const errors = [];
browser.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.sessionId !== sessionId) return;
  if (m.method === "Runtime.exceptionThrown") {
    errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  }
});

const evaluate = async (expression) => {
  const r = await send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true },
    sessionId
  );
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.text + " :: " + expression.slice(0, 80));
  }
  return r.result.value;
};

await send(
  "Emulation.setDeviceMetricsOverride",
  { width: 1526, height: 1030, deviceScaleFactor: 1, mobile: false },
  sessionId
);
await send("Page.navigate", { url: ORIGIN }, sessionId);
await sleep(2000);
await evaluate(`localStorage.setItem("token", ${JSON.stringify(token)});`);
await send("Page.navigate", { url: ORIGIN + path }, sessionId);
await sleep(6000);

// A stable signature of what is actually rendered, so a layout that silently
// changes between passes is detected rather than eyeballed. Text length is
// tracked separately from the structural counts, because a slider changing the
// rupee figure is expected to alter text without moving anything.
const signature = `JSON.stringify({
  cards: document.querySelectorAll('section, article').length,
  sliders: document.querySelectorAll('input[type=range]').length,
  text: (document.body.innerText||'').length,
  height: document.body.scrollHeight,
  tops: [...document.querySelectorAll('section, article')].map(e => Math.round(e.getBoundingClientRect().top + window.scrollY))
})`;
const struct = (s) => {
  const o = JSON.parse(s);
  return JSON.stringify({ cards: o.cards, sliders: o.sliders, height: o.height, tops: o.tops });
};

const samples = [];
for (let pass = 0; pass < 3; pass++) {
  for (const y of [0, 600, 1200, 1800, 900, 300]) {
    await evaluate(`window.scrollTo({ top: ${y}, behavior: 'instant' });`);
    await sleep(450);
    const y1 = await evaluate("window.scrollY");
    await sleep(250);
    const y2 = await evaluate("window.scrollY");
    samples.push({ pass, to: y, drift: Math.abs(y2 - y1), sig: await evaluate(signature) });
  }
  // Nudge the contribution slider and the chat box, then re-measure.
  await evaluate(`(() => {
    const s = document.querySelector('input[type=range]');
    if (s) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(s, String(Math.min(Number(s.max), Number(s.value) + 20)));
      s.dispatchEvent(new Event('input', { bubbles: true }));
      s.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const t = document.querySelector('textarea, input[type=text][placeholder*="essage" i]');
    if (t) { t.focus(); t.value = 'scroll stability probe'; t.dispatchEvent(new Event('input', { bubbles: true })); }
  })()`);
  await sleep(700);
  samples.push({ pass, to: "interact", drift: 0, sig: await evaluate(signature) });
  // Force the refetch a poll or focus-triggered refresh would cause.
  await evaluate("window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange'));");
  await sleep(1200);
  samples.push({ pass, to: "refetch", drift: 0, sig: await evaluate(signature) });
}

// Leave and come back, where a flicker or focus bug would resurface.
await send("Page.navigate", { url: ORIGIN + "/app/dashboard" }, sessionId);
await sleep(4000);
await send("Page.navigate", { url: ORIGIN + path }, sessionId);
await sleep(5000);
const onReturn = await evaluate(signature);
await evaluate("window.scrollTo({ top: 1500, behavior: 'instant' });");
await sleep(600);
const returnScroll = await evaluate("window.scrollY");

// Watch page height settle after a fresh load. A one-off growth while data
// arrives is normal; repeated growth during interaction is not.
const settleRaw = await evaluate(`(async () => {
  const h = [];
  for (let i = 0; i < 16; i++) { h.push(document.body.scrollHeight); await new Promise(r => setTimeout(r, 400)); }
  return JSON.stringify(h);
})()`);
const heights = JSON.parse(settleRaw);
const changes = heights
  .map((h, i) => (i > 0 && h !== heights[i - 1] ? `${i * 0.4}s ${heights[i - 1]}->${h}` : null))
  .filter(Boolean);

// Actually send a chat message and confirm the thread grows, which is the
// interaction most likely to reintroduce a scroll jump.
const chatResult = await evaluate(`(async () => {
  const input = document.querySelector('input[aria-label="Write a message"]');
  if (!input) return JSON.stringify({ sent: false, reason: 'no chat input' });
  const before = document.querySelectorAll('[class*="max-w-80"], .max-h-72 p').length;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'browser scroll probe');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 200));
  const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Send');
  if (!btn || btn.disabled) return JSON.stringify({ sent: false, reason: 'send disabled' });
  btn.click();
  await new Promise(r => setTimeout(r, 1500));
  return JSON.stringify({ sent: true, before, after: document.querySelectorAll('.max-h-72 p').length, height: document.body.scrollHeight });
})()`);
console.log("chat send in browser:", chatResult);

// Identify which element grows, so a layout shift is explained rather than
// just reported. Measures every element's height before and after a scroll.
const growth = await evaluate(`(async () => {
  const snap = () => [...document.querySelectorAll('*')].map((e) => [e, e.getBoundingClientRect().height]);
  const before = new Map(snap());
  window.scrollTo({ top: 700, behavior: 'instant' });
  await new Promise(r => setTimeout(r, 1200));
  const rows = [];
  for (const [e, h1] of snap()) {
    const b = before.get(e);
    if (b !== undefined && Math.abs(h1 - b) > 4) {
      rows.push({
        tag: e.tagName,
        cls: String(e.className.baseVal ?? e.className).slice(0, 60),
        from: Math.round(b),
        to: Math.round(h1),
        text: (e.textContent || '').trim().slice(0, 40),
      });
    }
  }
  return JSON.stringify(rows.slice(0, 10));
})()`, );
const shot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
writeFileSync(`${ROOT}shots\\scrollcheck.png`, Buffer.from(shot.data, "base64"));

const driftMax = Math.max(...samples.map((s) => s.drift || 0));
const structs = [...new Set(samples.map((s) => struct(s.sig)))];
const overflow = await evaluate("document.documentElement.scrollWidth > window.innerWidth + 1");
const clipped = await evaluate(
  `[...document.querySelectorAll('.truncate')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.trim().slice(0,30))`
);

console.log("samples taken:", samples.length, "over 3 passes");
console.log("scroll drift max (px):", driftMax);
console.log("distinct STRUCTURE signatures:", structs.length, structs.length === 1 ? "(STABLE - no layout shift)" : "(CHANGED)");
if (structs.length !== 1) {
  for (const [i, s] of structs.entries()) {
    const at = samples.findIndex((x) => struct(x.sig) === s);
    console.log(`  struct${i} (${JSON.parse(s).height}px) first seen: ${JSON.stringify(samples[at])}`);
  }
}
console.log("structure matches after return:", struct(onReturn) === structs[0]);
console.log("scrollY after returning and scrolling to 1500 =", returnScroll);
console.log("overflow:", overflow, "clipped:", JSON.stringify(clipped));
console.log("console errors:", errors.length ? JSON.stringify([...new Set(errors)].slice(0, 5)) : "none");
console.log("height over 6.4s after load:", JSON.stringify(heights));
console.log("  changes:", changes.length ? changes.join(", ") : "none (settled immediately)");
console.log("elements that grew on scroll:");
for (const row of JSON.parse(growth)) {
  console.log(`  ${row.tag}.${row.cls} ${row.from}px -> ${row.to}px  "${row.text}"`);
}

await send("Target.closeTarget", { targetId });
browser.close();
chrome.kill();
process.exit(0);
