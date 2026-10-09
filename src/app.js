import "dotenv/config";
import cron from "node-cron";
import { runAttendanceAction } from "./attendance.js";

function scheduleReminder(time, action) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error(`Invalid ${action} time. Use 24-hour HH:MM format.`);
  }

  const [hour, minute] = time.split(":").map(Number);
  if (hour > 23 || minute > 59) {
    throw new Error(`Invalid ${action} time: ${time}`);
  }

  const timezone = process.env.TIMEZONE || "Asia/Kolkata";
  const expression = `${minute} ${hour} * * 1-5`;

  cron.schedule(
    expression,
    () => runAttendanceAction(action).catch((error) => {
      console.error(`${action} reminder failed: ${error.message}`);
    }),
    { timezone }
  );

  console.log(`${action} reminder scheduled for weekdays at ${time} (${timezone}).`);
}

scheduleReminder(process.env.PUNCH_IN_TIME, "Punch In");
scheduleReminder(process.env.PUNCH_OUT_TIME, "Punch Out");

console.log("Attendance reminder assistant is running. Keep this process running.");
