# ICT announcements and web push

The ID-card administrator (`idcard_admin`, frontend `/admin/tac/announcements`) is the exclusive publisher of student announcements. Students use `/student/announcements` to read their inbox and enable or disable this device's notifications.

Every admin can publish **staff announcements** at `/admin/announcements`, including targeted lecturer updates. Lecturers use `/lecturer/announcements`. Campus-feed posts notify eligible students, admins and lecturers, with links to their respective feed portals and in-app unread badges. The shared external invigilator login is excluded. See [ACADEMIC_WORKFLOWS.md](ACADEMIC_WORKFLOWS.md).

## Configure Vercel and Render

1. Deploy both updated repositories. Keep `VITE_API_BASE_URL` pointing to the Render HTTPS API and `FRONTEND_URL` set to the exact Vercel/custom-domain frontend origin. The frontend service worker, manifest, icons and offline page are in `public/`; retain the supplied Vercel headers.
2. In the backend directory, run `node scripts/generate-push-keys.cjs` once. It writes an ignored `.env.push` file and refuses to overwrite an existing file. It never prints keys. This file is a transfer aid, not automatically loaded by the server.
3. Copy `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` from that file into Render's environment settings. Set `VAPID_SUBJECT` to the real ICT contact, e.g. `mailto:ict@your-university-domain`. For local tests, copy all three into the backend `.env`. Never add the private key to a `VITE_` variable, source control or a support message. Keep a secure backup and use the same key pair across deploys. Replacing it requires device resubscription.
4. Redeploy/restart the backend. Partial or invalid VAPID configuration fails startup. With all three omitted, announcement inboxes work and the UI explains that device notifications are not configured.
5. Use a continuously running backend for timely push. The API process polls the MongoDB delivery queue every 15 seconds. A sleeping Render free service does not run that worker while asleep. Render also documents ephemeral local storage on free services; existing ID-card uploads need persistent storage. [Render free-service limitations](https://render.com/docs/free).

There is no extra third-party push account or Firebase SDK requirement: the backend uses the browser's Push API endpoint and VAPID authentication. Provider quotas and device/network/OS policies can delay or suppress notifications; push is not a guaranteed emergency alert channel. [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), [web-push library](https://github.com/web-push-libs/web-push).

## Student and ICT flow

- Students open Announcements and select **Enable notifications**, then approve the browser prompt. Permission is requested only from that button. **Turn off on this device** unsubscribes; logout also unsubscribes this browser. Password reset/logout/archive invalidates old subscription versions. After signing back in, visit Announcements to reconnect a previously permitted subscription.
- On iPhone/iPad, install via Safari's **Share → Add to Home Screen**, open that installed app, and enable notifications there. Web push requires iOS/iPadOS 16.4 or later. [Apple documentation](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers).
- ICT writes a draft, chooses all/faculty/department and optional levels, previews the current recipient count, then explicitly publishes. Expiry is optional. Recipients are a snapshot of matching non-graduated, non-archived students at publication; students registered later do not inherit earlier announcements. The preview count can change before publication.
- Publishing atomically creates student inbox receipts and jobs for currently subscribed eligible devices. Repeating publication does not duplicate those jobs. Students without push permission still get the inbox entry. Enabling push later does not backfill old notifications.
- Withdrawing hides the announcement and cancels queued jobs. An already dispatched notification cannot be recalled; its link checks current access and reports an unavailable announcement after withdrawal/expiry.
- The history displays inbox recipient count and per-device pending/accepted/failed/skipped counts. **Accepted** means the browser push provider accepted the request, not that the device displayed or the student read it. Students can have multiple devices. Use Refresh for updated counts.
- The worker retries transient errors up to five attempts, recovers abandoned processing leases and disables expired endpoints. A crash after provider acceptance but before database acknowledgement can repeat a send; a stable notification tag helps replace duplicates on supported devices.
- Lock-screen notifications contain generic ICT text, not student details or targeted message content. Notification links return through login. The service worker caches only the public offline page/icons, never API responses, photos, authenticated pages or student records. Installed apps need internet for portal workflows.

## Verification before rollout

Local automated checks use a temporary MongoDB replica set and a fake push sender; they never deliver a real notification. Browser checks cover publishing/reading through login, role access, service-worker control and the offline fallback. Service-worker tests exercise notification rendering and safe click routing.

Real delivery still needs an HTTPS staging deployment with VAPID configured. Use consenting test accounts: install on Android/desktop and an iPhone, allow notifications, publish to only those test students, and check foreground/background/closed-app behavior, denied permission, withdrawal, logout/shared-device switching and expiry. Confirm provider counts in ICT history and the worker stays running across Render redeploys. Check the app-update prompt after a second frontend deployment. Do not send a campus-wide announcement as a test.
