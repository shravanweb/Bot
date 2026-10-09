export function getReminderCronExpression(time, action) {
  if (!time || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error(`Invalid ${action} time. Use 24-hour HH:MM format.`);
  }

  const [hour, minute] = time.split(":").map(Number);
  return `${minute} ${hour} * * 1-5`;
}
