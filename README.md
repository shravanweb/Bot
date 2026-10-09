# Attendance Bot Assistant

A starter Node.js project that opens your company attendance website at scheduled times using Playwright and `node-cron`.

## What it does

- Schedules weekday Punch In and Punch Out reminders.
- Opens the attendance website in Chromium (visible locally and headlessly on Render).
- Signs in using credentials stored in the local `.env` file.
- Uses screen-coordinate interaction because the attendance controls are not reliably accessible to Playwright.
- Runs Chromium headlessly when `HEADLESS=true`, as configured by the Render worker.
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

## Deploy on Render

Render runs this app as a continuously running Background Worker, so its in-process weekday scheduler remains active while your computer is off. The included `render.yaml` describes a paid `starter` worker; Free web services sleep when idle and are not a substitute for an always-on worker.

1. Push this project to GitHub. Do not commit `.env`.
2. In the Render Dashboard, choose **New > Blueprint**, connect this repository, and select `render.yaml`. Render creates the `attendance-bot` Background Worker using the Dockerfile.
3. When prompted, enter `ATTENDANCE_URL`, `ATTENDANCE_EMAIL`, and `ATTENDANCE_PASSWORD` as secret values. The blueprint sets `PUNCH_IN_TIME=09:00`, `PUNCH_OUT_TIME=18:00`, `TIMEZONE=Asia/Kolkata`, and `HEADLESS=true`; adjust times in `render.yaml` or the service environment before deploying if needed.
4. Choose a paid worker instance and keep one instance running. Do not also enable an old Vercel Cron deployment for these punch actions.
5. Check the Render worker logs for both scheduled times and verify attendance after each first run.

The worker opens a headless browser, so there is no visible browser window to complete a challenge. If the attendance site requires CAPTCHA, MFA, GPS, or other manual verification, the worker cannot complete that step. This automation relies on fixed screen coordinates and OCR; monitor the first runs and verify the attendance record yourself.

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
- If reminders do not fire, confirm the Render Background Worker is running, all required service environment variables are set, and the logs show both schedules with the expected timezone. A stopped worker cannot run scheduled jobs.
- If the website requires additional verification, complete it manually according to company policy.
