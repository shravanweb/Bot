# Attendance Bot Assistant

A starter Node.js project that opens your company attendance website at scheduled times using Playwright and `node-cron`.

## What it does

- Schedules weekday Punch In and Punch Out reminders.
- Opens the attendance website in a visible Chromium browser.
- Signs in using credentials stored in the local `.env` file.
- Uses mouse and keyboard interaction because the RewaHR Flutter page does not expose standard HTML form controls to Playwright.
- At the scheduled Punch Out time, uses local English OCR to check that today's Punch In and the Punch Out form are visible; it skips if Punch Out is already recorded or the page state is unclear.
- Submits Punch Out only after those checks, then looks for confirmation. Punch In is not automatically submitted.

## Requirements

- Node.js LTS
- Windows, macOS, or Linux
- Company approval for use of an attendance automation assistant

## Setup (Windows / VS Code)

1. Extract the ZIP.
2. Open the extracted `attendance-bot` folder in VS Code.
3. Open the terminal in that folder.
4. Install dependencies:

   ```bash
   npm install
   npx playwright install chromium
   ```

5. Copy `.env.example` to `.env`.
6. Edit `.env` and set the real HTTPS attendance website URL, your login credentials, and times:

   ```env
   ATTENDANCE_URL=https://your-company-attendance-url
   ATTENDANCE_EMAIL=your-company-email
   ATTENDANCE_PASSWORD=your-password
   PUNCH_IN_TIME=09:00
   PUNCH_OUT_TIME=18:00
   TIMEZONE=Asia/Kolkata
   ```

   Times use 24-hour format. The example schedules reminders for 9:00 AM and 6:00 PM India time. Keep the credentials only in your local `.env`; never send or commit them.

7. Start the assistant:

   ```bash
   npm start
   ```

Keep the terminal and computer running. At the scheduled times, Chromium opens the attendance website, signs in using the credentials in your local `.env`, and opens the Punch In/Out page. At Punch Out time, the assistant checks the displayed state before submitting OUT. Keep the browser open and verify the result, especially if the page does not show a clear confirmation.

The site renders its interface in a Flutter canvas, so screen coordinates are based on a 1446x741 browser viewport. OCR runs locally using the bundled English model; screenshots are not sent to an OCR service.

## Schedule

The included schedule runs Monday through Friday. To change the times, edit `.env` and restart the app.

## Security

- Never put passwords, OTPs, cookies, or session tokens in source files or chat. Store credentials only in your local `.env`, which is ignored by Git.
- `.env` is ignored by Git; do not commit it.
- Do not bypass CAPTCHA, MFA, GPS checks, or company security controls.
- Confirm that your employer permits this workflow.
- Punch Out submission is automatic only when local OCR clearly reads today's Punch In and the Punch Out form. If CAPTCHA, MFA, or another verification is required, complete it manually in the browser.

## Troubleshooting

- `ATTENDANCE_URL`: must be the real website URL and start with `https://`.
- If Chromium is missing, run `npx playwright install chromium`.
- If reminders do not fire, confirm the process is running and the computer has not slept or shut down.
- If the website requires additional verification, complete it manually according to company policy.
