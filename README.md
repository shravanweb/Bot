# Attendance Bot Assistant

A starter Node.js project that opens your company attendance website at scheduled times using Playwright and `node-cron`.

## What it does

- Schedules weekday Punch In and Punch Out reminders.
- Opens the attendance website in Chromium (visible locally and headlessly in hosted containers).
- Signs in using credentials stored in the local `.env` file.
- Uses screen-coordinate interaction because the attendance controls are not reliably accessible to Playwright.
- Runs Chromium headlessly when `HEADLESS=true`, as required by hosted containers.
- Automatically submits Punch In only when local OCR clearly confirms today's Punch In form and does not show that today's Punch In is already recorded.
- At the scheduled Punch Out time, uses local English OCR to check that today's Punch In and the Punch Out form are visible; it skips if Punch Out is already recorded or the page state is unclear.
- Submits Punch In or Punch Out only after the corresponding screen-state checks, then looks for confirmation.

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

For local runs, keep the terminal and computer running. At the scheduled times, Chromium opens the attendance website and signs in using the credentials in your local `.env`. At Punch In and Punch Out times, the assistant checks the displayed state before submitting and logs whether the page confirmed the result. Verify attendance manually if the confirmation is unclear.

Screen coordinates are based on a 1446x741 browser viewport. OCR runs locally using the bundled English model; screenshots are not sent to an OCR service.

## Deploy on Vercel Pro

Vercel runs this project as a scheduled function rather than a continuously running Node.js process. The Pro Cron invokes the attendance function every minute on weekdays; the function checks the configured timezone and only starts browser automation when a punch time matches. Vercel Cron uses UTC, so this runtime timezone check avoids hardcoding UTC offsets in the schedule. The every-minute Cron requires a Vercel Pro plan and invokes a function about 31,680 times in a typical 30-day month with 22 weekdays.

1. Push the project to the GitHub repository connected to Vercel. Do not commit `.env`.
2. In Vercel, select the project and add `ATTENDANCE_URL`, `ATTENDANCE_EMAIL`, `ATTENDANCE_PASSWORD`, `PUNCH_IN_TIME`, `PUNCH_OUT_TIME`, and `TIMEZONE` under **Settings > Environment Variables** for Production.
3. Generate a long random secret and add it as `CRON_SECRET` in Vercel Production Environment Variables. Vercel automatically authenticates Cron requests using this stored secret.
4. Confirm the Vercel project is on Pro, then redeploy the latest production deployment. `vercel.json` registers a weekday, every-minute Cron; do not configure the same Cron separately in the dashboard.
5. Visit the root deployment URL to see the status page. Check **Functions > Logs** for `/api/attendance` and confirm the first scheduled runs and attendance records.

The Cron endpoint rejects requests without the secret. Vercel invokes it with GET requests. If the attendance site requires CAPTCHA, MFA, GPS, or other manual verification, a headless function cannot complete that step. This automation relies on fixed screen coordinates and OCR; monitor the first runs and verify the attendance record yourself. If a run takes longer than a minute, the next Cron invocation can overlap; OCR guards against already-recorded Punch In/Out but cannot guarantee exactly-once processing for external side effects.

## Schedule

The included schedule runs Monday through Friday. To change the times, edit `.env` and restart the app.

## Security

- Never put passwords, OTPs, cookies, or session tokens in source files or chat. Store credentials only in your local `.env`, which is ignored by Git.
- `.env` is ignored by Git; do not commit it.
- Do not bypass CAPTCHA, MFA, GPS checks, or company security controls.
- Confirm that your employer permits this workflow.
- Punch In and Punch Out submissions are automatic only when local OCR clearly confirms the matching form and avoids duplicate Punch In. Punch Out also requires today's Punch In to be confirmed. If CAPTCHA, MFA, or another verification is required, the hosted headless service cannot complete it.

## Troubleshooting

- `ATTENDANCE_URL`: must be the real website URL and start with `https://`.
- If Chromium is missing, run `npx playwright install chromium`.
- If reminders do not fire, confirm the Vercel project is on Pro, the production deployment includes `vercel.json`, all required Production Environment Variables are set, and the Cron/function logs show invocations. Verify the attendance site does not require manual verification.
- If the website requires additional verification, complete it manually according to company policy.
