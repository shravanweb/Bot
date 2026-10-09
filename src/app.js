import "dotenv/config";
import cron from "node-cron";
import { runAttendanceAction } from "./attendance.js";
import { getReminderCronExpression } from "./schedule.js";

function scheduleReminder(time, action) {
  const timezone = process.env.TIMEZONE || "Asia/Kolkata";
  const expression = getReminderCronExpression(time, action);

  cron.schedule(
    expression,
    () => runAttendanceAction(action).catch((error) => {
      console.error(`${action} reminder failed: ${error.message}`);
    }),
    { timezone, noOverlap: true }
  );

  console.log(`${action} reminder scheduled for weekdays at ${time} (${timezone}).`);
}

scheduleReminder(process.env.PUNCH_IN_TIME, "Punch In");
scheduleReminder(process.env.PUNCH_OUT_TIME, "Punch Out");

console.log("Attendance reminder assistant is running.");
