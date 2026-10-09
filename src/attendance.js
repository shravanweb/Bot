import { chromium } from "playwright";
import { createWorker } from "tesseract.js";
import englishOcrData from "@tesseract.js-data/eng";

const viewport = { width: 1446, height: 741 };
const screenPoints = {
  email: { x: 0.5, y: 0.546 },
  password: { x: 0.5, y: 0.637 },
  login: { x: 0.5, y: 0.727 },
  attendance: { x: 0.062, y: 0.612 },
  submitButton: { x: 0.945, y: 0.4 }
};

function getConfiguration() {
  const url = process.env.ATTENDANCE_URL;
  const email = process.env.ATTENDANCE_EMAIL;
  const password = process.env.ATTENDANCE_PASSWORD;
  const timezone = process.env.TIMEZONE || "Asia/Kolkata";

  if (!url || !url.startsWith("https://") || url.includes("your-company-attendance-url")) {
    throw new Error("Set ATTENDANCE_URL to your company's real HTTPS attendance URL.");
  }
  if (!email || !password) {
    throw new Error("Set ATTENDANCE_EMAIL and ATTENDANCE_PASSWORD in the environment.");
  }

  return { url, email, password, timezone };
}

function clickAt(page, point) {
  return page.mouse.click(viewport.width * point.x, viewport.height * point.y);
}

async function readAttendanceState(page, worker, timezone) {
  const screenshot = await page.screenshot({ animations: "disabled" });
  const { data } = await worker.recognize(screenshot);
  const text = data.text.replace(/\s+/g, " ");
  const lines = data.text.split(/\r?\n/).map((line) => line.trim());
  const today = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date()).replaceAll("/", "-");
  const datePattern = today.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return {
    confidence: data.confidence,
    punchInForm: lines.some((line) => /^Punch\s+In$/i.test(line)),
    punchOutForm: /\bPunch\s*Out\b/i.test(text),
    punchedInToday: new RegExp(
      `Punched\\s*in\\s*Date\\s*\\/\\s*Time\\s*:?\\s*['"‘’]?${datePattern}`,
      "i"
    ).test(text),
    punchedOutRecorded: new RegExp(
      `Punched\\s*Out\\s*Date\\s*\\/\\s*Time\\s*:?\\s*['"‘’]?${datePattern}`,
      "i"
    ).test(text)
  };
}

async function waitForLoginScreen(page, worker) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const screenshot = await page.screenshot({ animations: "disabled" });
    const { data } = await worker.recognize(screenshot);
    if (/\bEmail\b/i.test(data.text) && /\bPassword\b/i.test(data.text) && /\bLogin\b/i.test(data.text)) {
      return;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error("The login screen did not finish rendering.");
}

export async function runAttendanceAction(action) {
  const { url, email, password, timezone } = getConfiguration();
  let browser;
  let ocrWorker;

  try {
    console.log(`[${new Date().toISOString()}] ${action} reminder`);
    browser = await chromium.launch({ headless: process.env.HEADLESS === "true" });

    const page = await browser.newPage({ viewport });
    ocrWorker = await createWorker("eng", 1, {
      langPath: englishOcrData.langPath,
      gzip: englishOcrData.gzip
    });

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    await waitForLoginScreen(page, ocrWorker);
    await clickAt(page, screenPoints.email);
    await page.keyboard.type(email, { delay: 15 });
    await clickAt(page, screenPoints.password);
    await page.keyboard.type(password, { delay: 15 });
    await clickAt(page, screenPoints.login);
    try {
      await page.waitForURL(/#dashboard%20page/, { timeout: 30000 });
    } catch {
      throw new Error("Login did not complete. Check the configured credentials and whether the site requires manual verification.");
    }

    await clickAt(page, screenPoints.attendance);
    await page.waitForURL(/#punch%20in%20out%20page/, { timeout: 30000 });
    await page.waitForTimeout(1500);

    if (action === "Punch In") {
      const state = await readAttendanceState(page, ocrWorker, timezone);

      if (state.confidence < 45) {
        console.log("Punch In was skipped because the attendance screen could not be read reliably.");
      } else if (state.punchedInToday) {
        console.log("Punch In is already recorded for today. Skipping submission.");
      } else if (!state.punchInForm) {
        console.log("Punch In was skipped because the Punch In form was not clearly confirmed. Verify the attendance status manually.");
      } else {
        await clickAt(page, screenPoints.submitButton);
        await page.waitForTimeout(2000);
        const result = await readAttendanceState(page, ocrWorker, timezone);
        if (result.confidence >= 45 && result.punchedInToday) {
          console.log("Punch In was submitted and the page shows it as recorded.");
        } else {
          console.log("The IN button was clicked, but the page did not clearly confirm Punch In. Verify the attendance status manually.");
        }
      }
    } else if (action === "Punch Out") {
      const state = await readAttendanceState(page, ocrWorker, timezone);

      if (state.confidence < 45) {
        console.log("Punch Out was skipped because the attendance screen could not be read reliably. Verify the status manually.");
      } else if (state.punchedOutRecorded) {
        console.log("Punch Out is already recorded. Skipping submission.");
      } else if (!state.punchOutForm || !state.punchedInToday) {
        console.log("Punch Out was skipped because today's Punch In and the Punch Out form were not both confirmed. Verify the status manually.");
      } else {
        await clickAt(page, screenPoints.submitButton);
        try {
          await page.waitForTimeout(2000);
          const result = await readAttendanceState(page, ocrWorker, timezone);
          if (result.confidence >= 45 && result.punchedOutRecorded) {
            console.log("Punch Out was submitted and the page shows it as recorded.");
          } else {
            console.log("The OUT button was clicked, but the page did not clearly confirm Punch Out. Verify the status manually.");
          }
        } catch {
          console.log("The OUT button was clicked, but the page did not show a clear confirmation. Verify the Punch Out status manually.");
        }
      }
    } else {
      throw new Error(`Unsupported attendance action: ${action}`);
    }
  } catch (error) {
    console.error(`${action} reminder failed: ${error.message}`);
    throw error;
  } finally {
    try {
      if (browser) await browser.close();
    } finally {
      if (ocrWorker) await ocrWorker.terminate();
    }
  }
}
