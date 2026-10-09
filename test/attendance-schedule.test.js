import assert from "node:assert/strict";
import { test } from "node:test";
import { getReminderCronExpression } from "../src/schedule.js";

test("creates a weekday cron expression for the configured time", () => {
  assert.equal(getReminderCronExpression("09:05", "Punch In"), "5 9 * * 1-5");
  assert.equal(getReminderCronExpression("18:00", "Punch Out"), "0 18 * * 1-5");
});

test("rejects invalid 24-hour times", () => {
  for (const time of ["9:00", "24:00", "12:60", "12:00:00", ""]) {
    assert.throws(() => getReminderCronExpression(time, "Punch In"), /Invalid Punch In time/);
  }
});
