/**
 * Minimal Chrome DevTools Protocol driver.
 * Uses Node's built-in WebSocket, so there is nothing to install.
 *
 *   node tools/shot.mjs <name> <path> <width> <height> [email] [password]
 */
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
// A per-run port: the previous Chrome can hold 9222 for a moment after kill()
// on Windows, which makes a fixed port fail intermittently between runs.
const PORT = 9300 + (process.pid % 500);
const ORIGIN = "http://127.0.0.1:5173";
const API = "http://localhost:5000/api";
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUT = ROOT + "shots\\";
// A per-run profile avoids the lock contention you get reusing one directory.
const PROFILE = ROOT + `.chrome-profile-${process.pid}`;

const [name, path = "/app/dashboard", w = "1526", h = "1030", email, password] =
  process.argv.slice(2);

mkdirSync(OUT, { recursive: true });

async function login() {
  if (!email) return null;

  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`);
  return (await res.json()).token;
}

const token = await login();

const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  "--disable-gpu",
  "--hide-scrollbars",
  "--no-first-run",
  "--no-default-browser-check",
  "--user-data-dir=" + PROFILE,
  `--window-size=${w},${h}`,
  "about:blank",
], { stdio: "ignore" });

function cleanup() {
  try {
    chrome.kill();
  } catch {
    /* already gone */
  }
  try {
    rmSync(PROFILE, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

process.on("exit", cleanup);

// Wait for the debugging endpoint to answer.
let wsUrl = "";
for (let i = 0; i < 120; i++) {
  if (chrome.exitCode !== null) {
    throw new Error(`Chrome exited early with code ${chrome.exitCode}`);
  }
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    wsUrl = (await r.json()).webSocketDebuggerUrl;
    if (wsUrl) break;
  } catch {
    /* not up yet */
  }
  await sleep(500);
}
if (!wsUrl) throw new Error("Chrome did not expose a debugging endpoint");

const browser = new WebSocket(wsUrl);
await new Promise((res, rej) => {
  browser.onopen = res;
  browser.onerror = rej;
});

let nextId = 0;
const pending = new Map();
browser.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
};

const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    browser.send(JSON.stringify({ id, method, params, sessionId }));
  });

// Attach to a fresh tab.
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });

await send("Page.enable", {}, sessionId);
await send("Runtime.enable", {}, sessionId);
await send("Log.enable", {}, sessionId);

// Surface anything the page complains about; a silent error boundary is useless to debug.
const problems = [];
const note = (text) => problems.push(text);
browser.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.sessionId !== sessionId) return;
  if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails;
    note(`EXCEPTION: ${d.exception?.description || d.text}`);
  }
  if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) {
    note(
      `CONSOLE ${msg.params.type}: ` +
        msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(" ")
    );
  }
  if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
    note(`LOG: ${msg.params.entry.text}`);
  }
});

await send("Emulation.setDeviceMetricsOverride", {
  width: Number(w),
  height: Number(h),
  deviceScaleFactor: 1,
  mobile: false,
}, sessionId);

// Land on the origin first so localStorage is writable, then authenticate.
await send("Page.navigate", { url: ORIGIN }, sessionId);
await sleep(2500);

if (token) {
  await send("Runtime.evaluate", {
    expression: `localStorage.setItem("token", ${JSON.stringify(token)});`,
  }, sessionId);
}

await send("Page.navigate", { url: ORIGIN + path }, sessionId);
await sleep(6000);

const shot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
writeFileSync(`${OUT}${name}.png`, Buffer.from(shot.data, "base64"));

// Report horizontal overflow and any element whose text is being clipped.
const probe = await send("Runtime.evaluate", {
  expression: `JSON.stringify({
    doc: document.documentElement.scrollWidth,
    win: window.innerWidth,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    clipped: [...document.querySelectorAll('.truncate')]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => el.textContent.trim().slice(0, 40)),
    offenders: [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 5)
      .map((el) => el.tagName + '.' + (el.className.baseVal ?? String(el.className)).slice(0, 50))
  })`,
  returnByValue: true,
}, sessionId);

console.log(`${name}.png  ${probe.result.value}`);
if (problems.length) {
  console.log("--- page problems ---");
  for (const p of [...new Set(problems)].slice(0, 12)) console.log(p);
}

await send("Target.closeTarget", { targetId });
browser.close();
chrome.kill();
process.exit(0);
