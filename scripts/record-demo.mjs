import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import puppeteer from "puppeteer-core";

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FRAMES_DIR = path.resolve("./temp-frames");
const OUT_DIR = path.resolve("./docs");
const TARGET_URL = process.env.DEMO_URL || "https://titan-cybercommand.vercel.app";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function record() {
  console.log("=== TITAN CYBER COMMAND DEMO RECORDER (MASTER 1080P) ===");
  console.log(`Target URL: ${TARGET_URL}`);

  if (fs.existsSync(FRAMES_DIR)) {
    fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

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
  await page.goto(TARGET_URL, { waitUntil: "networkidle2", timeout: 45000 });

  // Wait for canvas / globe
  await sleep(4000);

  let frameCount = 0;
  const captureFrame = async () => {
    frameCount++;
    const num = String(frameCount).padStart(5, "0");
    const filePath = path.join(FRAMES_DIR, `frame_${num}.png`);
    await page.screenshot({ path: filePath, type: "png" });
  };

  // Scene 1: Kinetic Ballistic Missiles & Subsea Cables
  console.log("Recording Scene 1: Kinetic Ballistic Warfare (60 frames)...");
  for (let i = 0; i < 60; i++) {
    await captureFrame();
    await sleep(50);
  }

  // Scene 2: WarGames Cascade Simulator
  console.log("Recording Scene 2: WarGames Disaster Simulation (50 frames)...");
  try {
    const buttons = await page.$$("button");
    for (const b of buttons) {
      const text = await page.evaluate((el) => el.textContent || "", b);
      if (text.includes("WarGames")) {
        await b.click();
        break;
      }
    }
    await sleep(600);

    // Start simulation
    const cascadeButtons = await page.$$("button");
    for (const b of cascadeButtons) {
      const text = await page.evaluate((el) => el.textContent || "", b);
      if (text.includes("INITIATE WARGAME CASCADE")) {
        await b.click();
        break;
      }
    }

    for (let i = 0; i < 50; i++) {
      await captureFrame();
      await sleep(60);
    }

    // Close modal
    const closeButtons = await page.$$('button[aria-label="Close"]');
    if (closeButtons.length > 0) {
      await closeButtons[0].click();
      await sleep(500);
    }
  } catch (err) {
    console.log("WarGames note:", err.message);
  }

  // Scene 3: Target Recon OSINT Scanner
  console.log("Recording Scene 3: Target Recon OSINT Scanner (50 frames)...");
  try {
    const buttons = await page.$$("button");
    for (const b of buttons) {
      const text = await page.evaluate((el) => el.textContent || "", b);
      if (text.includes("Target Recon")) {
        await b.click();
        break;
      }
    }
    await sleep(600);

    const input = await page.$('input[placeholder*="domain"]');
    if (input) {
      await input.type("tesla.com", { delay: 50 });
      await page.keyboard.press("Enter");
      await sleep(2500);
    }

    for (let i = 0; i < 50; i++) {
      await captureFrame();
      await sleep(60);
    }

    const closeButtons = await page.$$('button[aria-label="Close"]');
    if (closeButtons.length > 0) {
      await closeButtons[0].click();
      await sleep(500);
    }
  } catch (err) {
    console.log("Recon note:", err.message);
  }

  // Scene 4: Global Panoramic Command
  console.log("Recording Scene 4: Panoramic Threat Monitor (40 frames)...");
  for (let i = 0; i < 40; i++) {
    await captureFrame();
    await sleep(50);
  }

  await browser.close();
  console.log(`Captured ${frameCount} high-resolution frames.`);

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
    `/opt/homebrew/bin/ffmpeg -y -i "${rawMp4}" -f lavfi -i "sine=frequency=55:duration=${durationSec}" -filter_complex "[1:a]volume=0.15,lowpass=f=120[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 128k "${mp4Path}"`,
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

  // Clean up frames
  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  console.log("=== MASTER DEMO GENERATION COMPLETE ===");
  console.log(`MP4: ${mp4Path} (${fs.statSync(mp4Path).size} bytes)`);
  console.log(`WebM: ${webmPath} (${fs.statSync(webmPath).size} bytes)`);
  console.log(`GIF: ${gifPath} (${fs.statSync(gifPath).size} bytes)`);
}

record().catch((e) => {
  console.error("Recording error:", e);
  process.exit(1);
});
