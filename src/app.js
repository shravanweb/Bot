import "dotenv/config";
import cron from "node-cron";
import { chromium } from "playwright";
import { createWorker } from "tesseract.js";
import englishOcrData from "@tesseract.js-data/eng";

const url = process.env.ATTENDANCE_URL;
const email = process.env.ATTENDANCE_EMAIL;
const password = process.env.ATTENDANCE_PASSWORD;
const timezone = process.env.TIMEZONE || "Asia/Kolkata";
// RewaHR renders its controls on a Flutter canvas; these positions match the tested viewport.
const viewport = { width: 1446, height: 741 };
const screenPoints = {
  email: { x: 0.5, y: 0.546 },
  password: { x: 0.5, y: 0.637 },
  login: { x: 0.5, y: 0.727 },
  attendance: { x: 0.062, y: 0.612 },
  punchOut: { x: 0.942, y: 0.425 }
};

if (!url || !url.startsWith("https://") || url.includes("your-company-attendance-url")) {
  throw new Error(
    "Set ATTENDANCE_URL in .env to your company's real HTTPS attendance URL."
  );
}

if (!email || !password) {
  throw new Error(
    "Set ATTENDANCE_EMAIL and ATTENDANCE_PASSWORD in your local .env file."
  );
}

function clickAt(page, point) {
  return page.mouse.click(viewport.width * point.x, viewport.height * point.y);
}

async function readAttendanceState(page, worker) {
  const screenshot = await page.screenshot({ animations: "disabled" });
  const { data } = await worker.recognize(screenshot);
  const text = data.text.replace(/\s+/g, " ");
  const today = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date()).replaceAll("/", "-");
  const datePattern = today.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return {
    confidence: data.confidence,
    punchOutForm: /\bPunch\s*Out\b/i.test(text),
    punchedInToday: new RegExp(
      `Punched\\s*in\\s*Date\\s*\\/\\s*Time\\s*:?\\s*${datePattern}`,
      "i"
    ).test(text),
    punchedOutRecorded: /Punched\s*Out\s*Date\s*\/\s*Time\s*:?\s*\d{2}-\d{2}-\d{4}/i.test(text)
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

async function openAttendancePage(action) {
  let browser;
  let ocrWorker;

  try {
    console.log(`[${new Date().toISOString()}] ${action} reminder`);
    browser = await chromium.launch({ headless: false });
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
      throw new Error("Login did not complete. Check the credentials in your local .env and any verification prompt in the browser.");
    }

    await clickAt(page, screenPoints.attendance);
    await page.waitForURL(/#punch%20in%20out%20page/, { timeout: 30000 });
    await page.waitForTimeout(1500);

    if (action === "Punch Out") {
      const state = await readAttendanceState(page, ocrWorker);

      if (state.confidence < 45) {
        console.log("Punch Out was skipped because the attendance screen could not be read reliably. Please verify in the browser.");
      } else if (state.punchedOutRecorded) {
        console.log("Punch Out is already recorded. Skipping submission.");
      } else if (!state.punchOutForm || !state.punchedInToday) {
        console.log("Punch Out was skipped because today's Punch In and the Punch Out form were not both confirmed. Please verify in the browser.");
      } else {
        await clickAt(page, screenPoints.punchOut);
        try {
          await page.waitForTimeout(2000);
          const result = await readAttendanceState(page, ocrWorker);
          if (result.confidence >= 45 && result.punchedOutRecorded) {
            console.log("Punch Out was submitted and the page shows it as recorded.");
          } else {
            console.log("The OUT button was clicked, but the page did not clearly confirm Punch Out. Please verify in the browser.");
          }
        } catch {
          console.log("The OUT button was clicked, but the page did not show a clear confirmation. Please verify the Punch Out status in the browser.");
        }
      }
    } else {
      console.log(`Logged in and opened the Punch In/Out page for ${action}.`);
      console.log("Please check the attendance status in the browser.");
    }

    // Keep the browser open for the user to complete the approved workflow.
    // Close it manually when finished.
  } catch (error) {
    console.error(`${action} reminder failed: ${error.message}`);
  } finally {
    if (ocrWorker) await ocrWorker.terminate();
  }
}

function scheduleReminder(time, action) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error(`Invalid ${action} time. Use 24-hour HH:MM format.`);
  }

  const [hour, minute] = time.split(":").map(Number);
  if (hour > 23 || minute > 59) {
    throw new Error(`Invalid ${action} time: ${time}`);
  }

  // Weekdays (Monday-Friday), in the configured timezone.
  const expression = `${minute} ${hour} * * 1-5`;

  cron.schedule(
    expression,
    () => openAttendancePage(action),
    { timezone }
  );

  console.log(`${action} reminder scheduled for weekdays at ${time} (${timezone}).`);
}

scheduleReminder(process.env.PUNCH_IN_TIME, "Punch In");
scheduleReminder(process.env.PUNCH_OUT_TIME, "Punch Out");

console.log("Attendance reminder assistant is running. Keep this process running.");
