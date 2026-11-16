import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import puppeteer from "puppeteer-core";

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FRAMES_DIR = path.resolve("./temp-frames");
const OUT_DIR = path.resolve("./docs");
const PUBLIC_DOCS = path.resolve("./public/docs");
const TARGET_URL = process.env.DEMO_URL || "http://localhost:3004/?demo=1";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function record() {
  console.log("=== TITAN CYBER COMMAND 30-SECOND MASTER SHOWCASE RECORDER ===");
  console.log(`Target URL: ${TARGET_URL}`);

  // Clean previous frames and old recordings
  console.log("Cleaning up prior frames and recordings...");
  [OUT_DIR, PUBLIC_DOCS].forEach((dir) => {
    if (fs.existsSync(dir)) {
      ["demo.mp4", "demo.webm", "demo.gif", "demo_raw.mp4"].forEach((f) => {
        const p = path.join(dir, f);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      });
    }
  });

  if (fs.existsSync(FRAMES_DIR)) {
    fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(PUBLIC_DOCS, { recursive: true });

  console.log("Launching headless Chrome with WebGL enabled...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu-vsync",
      "--window-size=1600,1000",
      "--hide-scrollbars",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  console.log(`Navigating to ${TARGET_URL}...`);
  await page.goto(TARGET_URL, { waitUntil: "networkidle2", timeout: 45000 });

  // Allow globe, Black Marble tiles, and ballistic canvas to initialize
  await page.waitForSelector(".maplibregl-canvas", { timeout: 20000 }).catch(() => {});
  await sleep(4000);

  let frameCount = 0;
  const captureFrame = async () => {
    frameCount++;
    const num = String(frameCount).padStart(5, "0");
    const filePath = path.join(FRAMES_DIR, `frame_${num}.png`);
    await page.screenshot({ path: filePath, type: "png" });
    return filePath;
  };

  // ==========================================
  // SCENE 1: Global Ballistic Swarm & Command Overview (90 frames ~ 5.6s)
  // ==========================================
  console.log("Recording Scene 1: Spherical Great Circle Swarm & Reticle (90 frames)...");
  for (let i = 0; i < 90; i++) {
    const framePath = await captureFrame();
    if (i === 40) {
      const outShot = path.join(OUT_DIR, "screenshot.png");
      const pubShot = path.join(PUBLIC_DOCS, "screenshot.png");
      fs.copyFileSync(framePath, outShot);
      fs.copyFileSync(framePath, pubShot);
      console.log(`Captured fresh master screenshot poster -> ${outShot}`);
    }
    await sleep(40);
  }

  // ==========================================
  // SCENE 2: Tactical US Deep Zoom & Incident Dossier (100 frames ~ 6.2s)
  // ==========================================
  console.log("Recording Scene 2: Tactical US Zoom & Incident Pins (100 frames)...");
  try {
    // Collapse sidebar to show full map with city lights (matching user screenshot)
    await page.evaluate(() => {
      const closeBtn = document.querySelector("button[data-sidebar-close]");
      closeBtn?.click();
    });
    await sleep(300);

    // Fly camera smoothly to the United States
    await page.evaluate(() => {
      const map = window.__map;
      if (map) {
        map.flyTo({
          center: [-98.0, 38.5],
          zoom: 3.75,
          pitch: 34,
          bearing: -4,
          duration: 2200,
          essential: true,
        });
      }
    });

    for (let i = 0; i < 50; i++) {
      await captureFrame();
      await sleep(40);
    }

    // Click an incident tag to inspect dossier
    await page.evaluate(() => {
      const pins = Array.from(document.querySelectorAll("button, [role='button'], div"));
      const targetPin = pins.find((el) => {
        const txt = el.textContent || "";
        return txt.includes("Home Instead") || txt.includes("Walgreen") || txt.includes("Alo Yoga") || txt.includes("VF");
      });
      targetPin?.click();
    });

    for (let i = 0; i < 50; i++) {
      await captureFrame();
      await sleep(40);
    }

    // Dismiss dossier
    await page.keyboard.press("Escape");
    await sleep(300);
  } catch (err) {
    console.log("Scene 2 note:", err.message);
  }

  // ==========================================
  // SCENE 3: Target Recon Passive OSINT Live Probing (95 frames ~ 5.9s)
  // ==========================================
  console.log("Recording Scene 3: Target Recon OSINT Scanner (95 frames)...");
  try {
    // Open Recon modal
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const btn = buttons.find((b) => /\brecon\b/i.test(b.textContent || ""));
      btn?.click();
    });
    await sleep(600);

    // Select tesla.com preset
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("dialog[open] button"));
      const preset = buttons.find((b) => (b.textContent || "").includes("tesla.com"));
      preset?.click();
    });

    for (let i = 0; i < 95; i++) {
      await captureFrame();
      await sleep(45);
    }

    // Close Recon modal
    await page.keyboard.press("Escape");
    await sleep(400);
  } catch (err) {
    console.log("Scene 3 note:", err.message);
  }

  // ==========================================
  // SCENE 4: WarGames Contagion Cascade & Countermeasure Victory (100 frames ~ 6.2s)
  // ==========================================
  console.log("Recording Scene 4: WarGames Cascade & Defense Active (100 frames)...");
  try {
    // Open WarGames modal
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const btn = buttons.find((b) => /\bwargames\b/i.test(b.textContent || ""));
      btn?.click();
    });
    await sleep(600);

    // Initiate Cascade
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("dialog[open] button"));
      const initBtn = buttons.find((b) => (b.textContent || "").includes("INITIATE WARGAME CASCADE"));
      initBtn?.click();
    });

    for (let i = 0; i < 40; i++) {
      await captureFrame();
      await sleep(40);
    }

    // Close dialog to see floating map HUD on globe
    await page.keyboard.press("Escape");
    await sleep(400);

    for (let i = 0; i < 20; i++) {
      await captureFrame();
      await sleep(40);
    }

    // Click DEPLOY COUNTERMEASURE on floating map HUD
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const deployBtn = buttons.find((b) => (b.textContent || "").includes("DEPLOY COUNTERMEASURE"));
      deployBtn?.click();
    });

    for (let i = 0; i < 40; i++) {
      await captureFrame();
      await sleep(40);
    }

    // Stop wargame simulation
    await page.evaluate(() => {
      const stopBtn = document.querySelector("button[aria-label=\"Stop simulation\"]");
      stopBtn?.click();
    });
    await sleep(300);
  } catch (err) {
    console.log("Scene 4 note:", err.message);
  }

  // ==========================================
  // SCENE 5: Cinematic Drone Patrol & Interactive Omnibox Search (95 frames ~ 5.9s)
  // ==========================================
  console.log("Recording Scene 5: Cinematic Patrol & Omnibox Autocomplete (95 frames)...");
  try {
    // Activate Patrol mode
    await page.keyboard.press("c");
    await sleep(600);

    for (let i = 0; i < 45; i++) {
      await captureFrame();
      await sleep(40);
    }

    // Instant 25ms Escape exit
    await page.keyboard.press("Escape");
    await sleep(300);

    // Restore hero camera view
    await page.evaluate(() => {
      const map = window.__map;
      if (map) {
        map.flyTo({
          center: [15, 25],
          zoom: 1.8,
          pitch: 0,
          bearing: 0,
          duration: 1500,
          essential: true,
        });
      }
    });

    // Reopen sidebar and focus Omnibox
    await page.evaluate(() => {
      const showBtn = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent || "").includes("Show sidebar"));
      showBtn?.click();
    });
    await sleep(200);

    await page.focus("#main-omnibox-input");
    await page.type("#main-omnibox-input", "Fortinet", { delay: 40 });

    for (let i = 0; i < 50; i++) {
      await captureFrame();
      await sleep(40);
    }
  } catch (err) {
    console.log("Scene 5 note:", err.message);
  }

  await browser.close();
  console.log(`Captured total of ${frameCount} high-resolution frames (~${(frameCount / 16).toFixed(1)} seconds at 16fps).`);

  // ==========================================
  // ENCODING WITH FFMPEG (MP4, WebM, and GIF)
  // ==========================================
  console.log("Encoding video streams with ffmpeg...");

  const rawMp4 = path.join(OUT_DIR, "demo_raw.mp4");
  const mp4Path = path.join(OUT_DIR, "demo.mp4");
  const webmPath = path.join(OUT_DIR, "demo.webm");
  const gifPath = path.join(OUT_DIR, "demo.gif");

  const durationSec = (frameCount / 16).toFixed(2);

  // 1. Generate video stream (H.264 High Profile, faststart)
  execSync(
    `/opt/homebrew/bin/ffmpeg -y -framerate 16 -i "${FRAMES_DIR}/frame_%05d.png" -c:v libx264 -profile:v high -level:v 4.2 -pix_fmt yuv420p -crf 19 -movflags +faststart "${rawMp4}"`,
    { stdio: "inherit" }
  );

  // 2. Synthesize tactical cyber audio drone track and mix into final MP4
  execSync(
    `/opt/homebrew/bin/ffmpeg -y -i "${rawMp4}" -f lavfi -i "sine=frequency=55:duration=${durationSec}" -filter_complex "[1:a]volume=0.18,lowpass=f=120[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 128k "${mp4Path}"`,
    { stdio: "inherit" }
  );
  if (fs.existsSync(rawMp4)) fs.unlinkSync(rawMp4);

  // 3. Generate WebM (VP9)
  execSync(
    `/opt/homebrew/bin/ffmpeg -y -framerate 16 -i "${FRAMES_DIR}/frame_%05d.png" -c:v libvpx-vp9 -b:v 0 -crf 28 "${webmPath}"`,
    { stdio: "inherit" }
  );

  // 4. Generate high-quality optimized GIF for GitHub README preview
  execSync(
    `/opt/homebrew/bin/ffmpeg -y -i "${mp4Path}" -vf "fps=12,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" "${gifPath}"`,
    { stdio: "inherit" }
  );

  // 5. Copy new artifacts to public/docs/ as well
  fs.copyFileSync(mp4Path, path.join(PUBLIC_DOCS, "demo.mp4"));
  fs.copyFileSync(webmPath, path.join(PUBLIC_DOCS, "demo.webm"));
  fs.copyFileSync(gifPath, path.join(PUBLIC_DOCS, "demo.gif"));

  // Clean up frames directory
  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  console.log("=== 30-SECOND MASTER DEMO GENERATION COMPLETE ===");
  console.log(`MP4: ${mp4Path} (${fs.statSync(mp4Path).size} bytes)`);
  console.log(`WebM: ${webmPath} (${fs.statSync(webmPath).size} bytes)`);
  console.log(`GIF: ${gifPath} (${fs.statSync(gifPath).size} bytes)`);
}

record().catch((e) => {
  console.error("Recording error:", e);
  process.exit(1);
});
