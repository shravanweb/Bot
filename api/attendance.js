import { timingSafeEqual } from "node:crypto";
import { runAttendanceAction } from "../src/attendance.js";

export const config = { maxDuration: 300 };

export function getScheduledAction(now = new Date()) {
  const timezone = process.env.TIMEZONE || "Asia/Kolkata";
  const punchInTime = process.env.PUNCH_IN_TIME;
  const punchOutTime = process.env.PUNCH_OUT_TIME;
  const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

  if (!timePattern.test(punchInTime || "") || !timePattern.test(punchOutTime || "")) {
    throw new Error("PUNCH_IN_TIME and PUNCH_OUT_TIME must use 24-hour HH:MM format.");
  }
  if (punchInTime === punchOutTime) {
    throw new Error("Punch In and Punch Out must be configured for different times.");
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  if (!["Mon", "Tue", "Wed", "Thu", "Fri"].includes(values.weekday)) {
    return null;
  }

  const currentTime = `${values.hour}:${values.minute}`;
  if (currentTime === punchInTime) return "Punch In";
  if (currentTime === punchOutTime) return "Punch Out";
  return null;
}

function hasValidCronSecret(request, secret) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const supplied = Buffer.from(request.headers.authorization || "");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET is not configured.");
    return response.status(500).json({ error: "Cron authorization is not configured." });
  }
  if (!hasValidCronSecret(request, cronSecret)) {
    return response.status(401).json({ error: "Unauthorized." });
  }

  let action;
  try {
    action = getScheduledAction();
  } catch (error) {
    console.error(`Schedule configuration error: ${error.message}`);
    return response.status(500).json({ error: "Invalid attendance schedule configuration." });
  }

  if (!action) {
    return response.status(200).json({ ok: true, skipped: true, reason: "outside-schedule" });
  }

  try {
    await runAttendanceAction(action);
    return response.status(200).json({ ok: true, action });
  } catch (error) {
    return response.status(500).json({ error: `${action} failed.` });
  }
}
