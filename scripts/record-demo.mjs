import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import puppeteer from "puppeteer-core";

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FRAMES_DIR = path.resolve("./temp-frames");
const OUT_DIR = path.resolve("./docs");
const PUBLIC_DOCS = path.resolve("./public/docs");
const TARGET_URL = process.env.DEMO_URL || "http://localhost:3004";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function record() {
  console.log("=== TITAN CYBER COMMAND DEMO RECORDER (MASTER 1080P) ===");
  console.log(`Target URL: ${TARGET_URL}`);

  // Delete older recordings
  console.log("Cleaning up older recordings...");
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

  console.log("Launching Chrome...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu-vsync",
      "--window-size=1600,1000",
      "--hide-scrollbars",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  console.log(`Navigating to ${TARGET_URL}...`);
  await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 45000 });

  // Allow globe and canvas layers to initialize
  await sleep(4500);

  let frameCount = 0;
  const captureFrame = async () => {
    frameCount++;
    const num = String(frameCount).padStart(5, "0");
    const filePath = path.join(FRAMES_DIR, `frame_${num}.png`);
    await page.screenshot({ path: filePath, type: "png" });
  };

  // Scene 1: Kinetic Great Circle Ballistic Swarm, Orbital HUD, and Live Combat Feed
  console.log("Recording Scene 1: Great Circle Ballistic Swarm & Combat Stream (70 frames)...");
  for (let i = 0; i < 70; i++) {
    await captureFrame();
    await sleep(50);
  }

  // Scene 2: Target Recon OSINT Scanner
  console.log("Recording Scene 2: Target Recon OSINT Scanner (60 frames)...");
  try {
    const buttons = await page.$$("button");
    for (const b of buttons) {
      const text = await page.evaluate((el) => el.textContent || "", b);
      if (text.includes("RECON") || text.includes("Target Recon")) {
        await b.click();
        break;
      }
    }
    await sleep(800);

    // Click Tesla preset
    const presetButtons = await page.$$("button");
    for (const b of presetButtons) {
      const text = await page.evaluate((el) => el.textContent || "", b);
      if (text.includes("tesla.com")) {
        await b.click();
        break;
      }
    }
    await sleep(2000);

    for (let i = 0; i < 50; i++) {
      await captureFrame();
      await sleep(60);
    }

    // Close modal
    await page.keyboard.press("Escape");
    await sleep(500);
  } catch (err) {
    console.log("Target Recon note:", err.message);
  }

  // Scene 3: WarGames Cascading Disaster Simulation
  console.log("Recording Scene 3: WarGames Disaster Simulation (70 frames)...");
  try {
    const buttons = await page.$$("button");
    for (const b of buttons) {
      const text = await page.evaluate((el) => el.textContent || "", b);
      if (text.includes("WARGAMES") || text.includes("WarGames")) {
        await b.click();
        break;
      }
    }
    await sleep(800);

    // Initiate contagion cascade
    const cascadeButtons = await page.$$("button");
    for (const b of cascadeButtons) {
      const text = await page.evaluate((el) => el.textContent || "", b);
      if (text.includes("INITIATE WARGAME CASCADE")) {
        await b.click();
        break;
      }
    }

    for (let i = 0; i < 40; i++) {
      await captureFrame();
      await sleep(60);
    }

    // Deploy Countermeasures
    const counterButtons = await page.$$("button");
    for (const b of counterButtons) {
      const text = await page.evaluate((el) => el.textContent || "", b);
      if (text.includes("DEPLOY AUTONOMOUS COUNTERMEASURES")) {
        await b.click();
        break;
      }
    }

    for (let i = 0; i < 30; i++) {
      await captureFrame();
      await sleep(60);
    }

    await page.keyboard.press("Escape");
    await sleep(500);
  } catch (err) {
    console.log("WarGames note:", err.message);
  }

  // Scene 4: Cinematic Auto-Patrol & Incident Inspection
  console.log("Recording Scene 4: Cinematic Auto-Patrol & Dossier (50 frames)...");
  try {
    const patrolButtons = await page.$$("button");
    for (const b of patrolButtons) {
      const text = await page.evaluate((el) => el.textContent || "", b);
      if (text.includes("PATROL") || text.includes("Patrol")) {
        await b.click();
        break;
      }
    }

    for (let i = 0; i < 50; i++) {
      await captureFrame();
      await sleep(50);
    }
  } catch (err) {
    console.log("Patrol note:", err.message);
  }

  await browser.close();
  console.log(`Captured total of ${frameCount} high-resolution frames.`);

  // Encode with ffmpeg
  console.log("Encoding video with ffmpeg into MP4, WebM, and GIF...");

  const rawMp4 = path.join(OUT_DIR, "demo_raw.mp4");
  const mp4Path = path.join(OUT_DIR, "demo.mp4");
  const webmPath = path.join(OUT_DIR, "demo.webm");
  const gifPath = path.join(OUT_DIR, "demo.gif");

  const durationSec = (frameCount / 16).toFixed(2);

  // 1. Generate video stream
  execSync(
    `/opt/homebrew/bin/ffmpeg -y -framerate 16 -i "${FRAMES_DIR}/frame_%05d.png" -c:v libx264 -profile:v high -level:v 4.2 -pix_fmt yuv420p -crf 18 -movflags +faststart "${rawMp4}"`,
    { stdio: "inherit" }
  );

  // 2. Synthesize tactical cyber audio drone track and mix into final MP4
  execSync(
    `/opt/homebrew/bin/ffmpeg -y -i "${rawMp4}" -f lavfi -i "sine=frequency=55:duration=${durationSec}" -filter_complex "[1:a]volume=0.18,lowpass=f=120[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 128k "${mp4Path}"`,
    { stdio: "inherit" }
  );
  if (fs.existsSync(rawMp4)) fs.unlinkSync(rawMp4);

  // 3. Generate WebM
  execSync(
    `/opt/homebrew/bin/ffmpeg -y -framerate 16 -i "${FRAMES_DIR}/frame_%05d.png" -c:v libvpx-vp9 -b:v 0 -crf 26 "${webmPath}"`,
    { stdio: "inherit" }
  );

  // 4. Generate high-quality optimized GIF for GitHub README preview
  execSync(
    `/opt/homebrew/bin/ffmpeg -y -i "${mp4Path}" -vf "fps=12,scale=840:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" "${gifPath}"`,
    { stdio: "inherit" }
  );

  // 5. Copy new artifacts to public/docs/ as well
  fs.copyFileSync(mp4Path, path.join(PUBLIC_DOCS, "demo.mp4"));
  fs.copyFileSync(webmPath, path.join(PUBLIC_DOCS, "demo.webm"));
  fs.copyFileSync(gifPath, path.join(PUBLIC_DOCS, "demo.gif"));

  // Clean up frames
  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  console.log("=== MASTER DEMO GENERATION & REPLACEMENT COMPLETE ===");
  console.log(`MP4: ${mp4Path} (${fs.statSync(mp4Path).size} bytes)`);
  console.log(`WebM: ${webmPath} (${fs.statSync(webmPath).size} bytes)`);
  console.log(`GIF: ${gifPath} (${fs.statSync(gifPath).size} bytes)`);
}

record().catch((e) => {
  console.error("Recording error:", e);
  process.exit(1);
});
