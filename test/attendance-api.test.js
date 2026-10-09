import assert from "node:assert/strict";
import { test } from "node:test";
import { getScheduledAction, default as handler } from "../api/attendance.js";

test("matches the configured local Punch In time on a weekday", () => {
  process.env.TIMEZONE = "Asia/Kolkata";
  process.env.PUNCH_IN_TIME = "09:00";
  process.env.PUNCH_OUT_TIME = "18:00";

  assert.equal(getScheduledAction(new Date("2026-10-12T03:30:00.000Z")), "Punch In");
});

test("does not schedule actions on weekends", () => {
  process.env.TIMEZONE = "Asia/Kolkata";
  process.env.PUNCH_IN_TIME = "09:00";
  process.env.PUNCH_OUT_TIME = "18:00";

  assert.equal(getScheduledAction(new Date("2026-10-10T03:30:00.000Z")), null);
});

test("rejects equal or malformed punch times", () => {
  process.env.TIMEZONE = "Asia/Kolkata";
  process.env.PUNCH_IN_TIME = "9:00";
  process.env.PUNCH_OUT_TIME = "9:00";

  assert.throws(() => getScheduledAction(new Date("2026-10-12T03:30:00.000Z")));
});

test("rejects cron requests with an invalid secret", async () => {
  process.env.CRON_SECRET = "expected-secret";
  const response = createResponse();

  await handler({ method: "GET", headers: { authorization: "Bearer incorrect" } }, response);

  assert.equal(response.statusCode, 401);
});

test("acknowledges an authorized cron request outside punch times without launching automation", async () => {
  const timezone = "Asia/Kolkata";
  const currentParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());
  const currentTime = `${currentParts.find(({ type }) => type === "hour").value}:${currentParts.find(({ type }) => type === "minute").value}`;
  const [hour, minute] = currentTime.split(":").map(Number);
  const currentMinute = hour * 60 + minute;
  const formatTime = (totalMinutes) => {
    const normalized = totalMinutes % (24 * 60);
    return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
  };
  process.env.TIMEZONE = timezone;
  process.env.PUNCH_IN_TIME = formatTime(currentMinute + 1);
  process.env.PUNCH_OUT_TIME = formatTime(currentMinute + 2);
  process.env.CRON_SECRET = "expected-secret";
  const response = createResponse();

  await handler({ method: "GET", headers: { authorization: "Bearer expected-secret" } }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { ok: true, skipped: true, reason: "outside-schedule" });
});

test("rejects methods other than GET", async () => {
  const response = createResponse();

  await handler({ method: "POST", headers: {} }, response);

  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.Allow, "GET");
});

function createResponse() {
  return {
    statusCode: 0,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}
