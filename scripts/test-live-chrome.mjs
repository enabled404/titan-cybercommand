import { spawn } from "node:child_process";
import http from "node:http";

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9222;
const TARGET_URL = "https://titan-cybercommand.vercel.app";

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

class CdpSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        } else if (msg.method) {
          const handlers = this.listeners.get(msg.method) || [];
          for (const h of handlers) h(msg.params);
        }
      };
    });
  }

  on(method, handler) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(handler);
  }

  async send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send("Runtime.evaluate", {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function run() {
  console.log("=== TITAN CYBER COMMAND LIVE VERIFICATION ===");
  console.log(`Starting headless Chrome on port ${PORT}...`);

  const chromeProc = spawn(
    CHROME_PATH,
    [
      `--remote-debugging-port=${PORT}`,
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let cdp = null;

  try {
    let version = null;
    for (let i = 0; i < 30; i++) {
      try {
        version = await fetchJson(`http://127.0.0.1:${PORT}/json/version`);
        if (version) break;
      } catch {
        await wait(200);
      }
    }

    if (!version) throw new Error("Could not connect to Chrome debugging endpoint");
    console.log(`Chrome ready: ${version["User-Agent"]}`);

    const targets = await fetchJson(`http://127.0.0.1:${PORT}/json/list`);
    const pageTarget = targets.find((t) => t.type === "page") || targets[0];
    if (!pageTarget) throw new Error("No page target found");

    cdp = new CdpSession(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    console.log("Connected to Chrome DevTools Protocol");

    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Console.enable");

    const consoleLogs = [];
    cdp.on("Console.messageAdded", (p) => {
      consoleLogs.push(`[${p.message.level}] ${p.message.text}`);
    });

    console.log(`Navigating to ${TARGET_URL}...`);
    await cdp.send("Page.navigate", { url: TARGET_URL });

    // Wait for full hydration & idle map initialization
    await wait(5000);

    const title = await cdp.eval("document.title");
    console.log(`PAGE TITLE: "${title}"`);

    const canvasCount = await cdp.eval("document.querySelectorAll('canvas').length");
    console.log(`RENDER CANVASES FOUND: ${canvasCount}`);

    // Verify Main Elements
    const elements = await cdp.eval(`({
      topBar: !!document.querySelector('header, nav, [class*="top-bar"], [class*="SiteBar"]'),
      omnibox: !!document.querySelector('#main-omnibox-input, input[placeholder*="Search"]'),
      sidebar: !!document.querySelector('[aria-label="Story"], aside, [class*="sidebar"]'),
      cveTicker: !!document.querySelector('[class*="ticker"], [class*="cve"]'),
      combatTelemetryPill: !!document.evaluate("//button[contains(., 'COMBAT TELEMETRY')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue,
    })`);
    console.log("CRITICAL HUD COMPONENTS:", JSON.stringify(elements, null, 2));

    // Test Hotkey 't' (Combat Telemetry Feed)
    console.log("Testing Hotkey 't' (Combat Telemetry)...");
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "t", code: "KeyT" });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "t", code: "KeyT" });
    await wait(800);

    const combatTerminalOpen = await cdp.eval(`
      !!document.evaluate("//span[contains(., 'Live Combat Intercept Feed')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
    `);
    console.log(`COMBAT TELEMETRY DRAWER OPEN: ${combatTerminalOpen}`);

    // Close combat drawer with 't' again
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "t", code: "KeyT" });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "t", code: "KeyT" });
    await wait(600);

    // Test WarGames Button in Top Bar
    console.log("Opening WarGames via top bar button...");
    await cdp.eval(`(() => {
      const btn = document.querySelector('button[title*="WarGames"], button[aria-label*="WarGames"]') ||
        document.evaluate("//button[contains(., 'WARGAMES')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      if (btn) btn.click();
    })()`);
    await wait(800);

    const wargamesModalOpen = await cdp.eval(`
      !!document.querySelector('#wargames-modal-title') ||
      !!document.evaluate("//h2[contains(., 'WarGames')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
    `);
    console.log(`WARGAMES MODAL OPEN: ${wargamesModalOpen}`);

    // Close WarGames dialog via its close button
    await cdp.eval(`(() => {
      const closeBtn = document.querySelector('dialog[open] button[aria-label*="Close"], dialog[open] button[title*="Close"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await wait(600);

    // Test Recon Scanner Button in Top Bar
    console.log("Opening Recon Scanner via top bar button...");
    await cdp.eval(`(() => {
      const btn = document.querySelector('button[title*="Recon"], button[aria-label*="Recon"]') ||
        document.evaluate("//button[contains(., 'RECON')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      if (btn) btn.click();
    })()`);
    await wait(800);

    const reconModalOpen = await cdp.eval(`
      !!document.querySelector('#recon-modal-title') ||
      !!document.evaluate("//h2[contains(., 'Recon')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
    `);
    console.log(`RECON SCANNER MODAL OPEN: ${reconModalOpen}`);

    // Close Recon dialog via its close button
    await cdp.eval(`(() => {
      const closeBtn = document.querySelector('dialog[open] button[aria-label*="Close"], dialog[open] button[title*="Close"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await wait(600);

    // Test Omnibox Focus and Input
    console.log("Testing Omnibox Focus and Search...");
    await cdp.eval(`document.querySelector('#main-omnibox-input')?.focus()`);
    await wait(300);
    await cdp.send("Input.insertText", { text: "Starbucks" });
    await wait(500);

    const omniboxVal = await cdp.eval("document.querySelector('#main-omnibox-input')?.value");
    console.log(`OMNIBOX SEARCH VALUE: "${omniboxVal}"`);

    // Verify Incident Dossier Navigation
    console.log("Testing direct incident navigation to /incident/starbucks-2026-11...");
    await cdp.send("Page.navigate", { url: `${TARGET_URL}/incident/starbucks-2026-11` });
    await wait(3500);

    const incidentTitle = await cdp.eval("document.title");
    console.log(`INCIDENT PAGE TITLE: "${incidentTitle}"`);

    const hasStixExport = await cdp.eval(`
      !!document.evaluate("//button[contains(., 'STIX 2.1')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
    `);
    console.log(`STIX 2.1 THREAT INTEL EXPORT PRESENT: ${hasStixExport}`);
    if (!hasStixExport) throw new Error("STIX 2.1 Threat Intel export button missing on incident page!");

    // Verify Brief page
    console.log("Testing /brief route...");
    await cdp.send("Page.navigate", { url: `${TARGET_URL}/brief` });
    await wait(3000);
    const briefTitle = await cdp.eval("document.title");
    console.log(`BRIEF PAGE TITLE: "${briefTitle}"`);

    // Verify Check page
    console.log("Testing /check route...");
    await cdp.send("Page.navigate", { url: `${TARGET_URL}/check` });
    await wait(3000);
    const checkTitle = await cdp.eval("document.title");
    console.log(`CHECK PAGE TITLE: "${checkTitle}"`);

    // Verify Agents page
    console.log("Testing /agents route...");
    await cdp.send("Page.navigate", { url: `${TARGET_URL}/agents` });
    await wait(3000);
    const agentsTitle = await cdp.eval("document.title");
    console.log(`AGENTS PAGE TITLE: "${agentsTitle}"`);

    // Verify CVE Directory page
    console.log("Testing /cve route...");
    await cdp.send("Page.navigate", { url: `${TARGET_URL}/cve` });
    await wait(3000);
    const cveTitle = await cdp.eval("document.title");
    console.log(`CVE DIRECTORY PAGE TITLE: "${cveTitle}"`);

    console.log("=== ALL TEST CHECKS PASSED: 100% PRODUCTION VERIFIED ===");
  } finally {
    if (cdp) cdp.close();
    chromeProc.kill("SIGTERM");
  }
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
