# i-FATOSS portal API

Express/Mongoose API. Use Node 24 (minimum 22.12) and MongoDB with replica-set transaction support, including MongoDB Atlas. A standalone MongoDB instance cannot post payments or publish timetables.

## Setup

1. Run `npm ci`.
2. Copy `.env.example` to `.env`, configure `MONGO_URI`, generate a unique `JWT_SECRET` of at least 32 characters, and set the frontend origin.
3. Set `SEED_ADMIN_PASSWORD` to a unique password of at least 12 characters; run `npm run seed` once. The password is hashed by the model. Remove this variable afterward.
4. Run `npm start` (or `npm run dev`). `/health/ready` returns 200 only while connected to MongoDB.

`FRONTEND_URL` accepts comma-separated allowed origins; the first is the public site encoded in ID-card QR codes. Set it correctly before printing. For production image storage, configure `CLOUDINARY_URL` or all of `CLOUD_NAME`, `CLOUD_API_KEY`, and `CLOUD_API_SECRET`; the backend uploads passport/feed images as authenticated Cloudinary assets and proxies them only after portal authorization. Keep credentials server-side. Without Cloudinary, `UPLOAD_DIR` must point to a persistent mounted volume. Local development uses `./uploads`. Keep the supplied template at `assets/idcard-template.pdf`.

## Roles and workflows

- General admin: admin accounts and academic sessions. End First, start Second, then start or skip Summer and close. Scheduled starts activate automatically; only one open session is permitted through the API.
- Registry: faculties and departments. Department corrections update name-based relationships transactionally. Matric allocation has moved to the ID-card administrator.
- ID-card admin: allocate unique matric numbers, register/manage students, reset passwords, review/approve submissions, download front/back PDF, collect cards and open renewal. Student archival preserves academic/finance records.
- Timetable admin: course targets, server-generated timetable previews, publication, editing and results. Shared lectures use a common slot. Publication rejects student, lecturer and nonempty venue clashes; it preserves existing entries. The deterministic generator reports unscheduled courses for manual adjustment; it is not a proof that no alternative allocation exists.
- Bursar: fees, templates, referenced payments, receipts, reversals and legacy balance reconciliation. Payments are manual bank/cash confirmations; there is no online payment gateway.
- Students: own profile, password, timetable, courses, finance and results; submit ID-card details and see status. Students cannot download printable cards.

The grading scale is A 80-100, B 70-79, C 60-69, D 50-59, E 40-49, F below 40. Grade points are 5/4/3/2/1/0. Test scores are 0-40 and exams 0-60. Pending results do not reduce GPA. Excel imports accept `.xlsx`, at most 5 MB/2,000 rows, with `matricNumber`, `test`, `exam`; the selected course and term identify the result. Partial failures include row numbers and reasons.

Cards are two PDF pages, 85.6 x 54 mm: front then back, using the supplied university artwork. Print at 100% / actual size using the card printer's duplex configuration. Approval currently gives one year of validity; renewal is opened by the ID-card administrator. A renewal revokes the previous QR. The image quality is limited by the supplied artwork. Check a physical sample for printer alignment before a batch.

## Existing data and release

Back up the database and uploads together before upgrading. On a restored staging database run `node scripts/check-release.cjs` (read-only, no auto-index writes). It reports duplicate result/finance keys, invalid scores, legacy balances, multiple open sessions and counts of old Register/Course documents.

Resolve duplicate records deliberately; the tool never deletes them. For legacy balances, the bursar can convert independent debt into a payable opening item or remove an exact duplicate while keeping the earlier debt. A reason and exact source match are required. Investigate old `registers`/`courses` and migrate required records to Faculty/Department/TimetableCourse before using them; legacy write routes return 410. Historical enrollment snapshots start with this release and cannot reconstruct unknown past department/level changes.

After reviewing a clean report, `node scripts/check-release.cjs --apply` recalculates stored finance totals and grades and creates required indexes. It does not drop indexes. Review any older restrictive finance index (student/session without semester) with the database operator. Deploy both frontend and API together. Do not run tests or fixtures against production: automated suites create their own temporary MongoDB replica set.

## Validation and operations

Run `node scripts/check-config.cjs` for an offline, read-only deployment preflight. It prints setting names and remediation only, never secrets, and does not connect to the database or Cloudinary. Exit code 2 means settings need attention; local development settings are expected to fail production requirements. Production startup requires complete Cloudinary credentials or an absolute persistent upload path, a non-placeholder signing secret and exact HTTPS frontend origins. The preflight cannot confirm external storage connectivity or a Render disk mount.

`npm test` runs API/integration tests using disposable data and writes a sample PDF under ignored `tests/artifacts/`. The first run downloads a MongoDB test binary. `npm audit --audit-level=moderate` checks dependencies. CI runs both. Browser acceptance tests live in the sibling frontend checkout.

Take encrypted, access-controlled backups of MongoDB and the configured media assets (or `UPLOAD_DIR`) on a documented schedule. Test restores to a separate replica set, compare document counts, log in with a staging account, view a private photo, generate an ID-card PDF, and verify payment history and timetable. Never point a restore at the live database. Monitor `/health/ready`, application errors, media-provider usage and backup completion. Use HTTPS and configure proxy forwarding for your host. Verify media survives a restart/redeploy. These hosting/restore checks require the actual deployment environment and are separate from local automated tests. Existing local-file photos need their files migrated to the configured provider; changing storage settings alone does not copy old photos.

JWTs last one day; refresh rechecks the live account. Logout, password reset and archival invalidate existing tokens. There is no separate long-lived refresh token or email password recovery: the ID-card admin handles student recovery.

## ICT announcements and push

The ID-card administrator is the ICT announcement publisher. Student inboxes work without push configuration. Optional device notifications use a durable MongoDB queue and server-only VAPID keys; the backend must remain running for timely sends. Follow [PUSH_SETUP.md](PUSH_SETUP.md) for key generation, Render/Vercel setup, publishing behavior and real-device staging checks. Automated tests use a fake push sender and do not contact student devices.

## Student officer, lecturers, exams and campus feed

See [ACADEMIC_WORKFLOWS.md](ACADEMIC_WORKFLOWS.md) for the new Student Officer role, shared invigilator account, lecturer provisioning, dated test/exam schedules, attendance exceptions, locked score sheets, academic release/correction, grade-only student results and SRC campus-feed permissions. All admins can publish staff announcements; student announcements remain with ICT. Feed pictures use the configured media storage provider. Fingerprint enrolment/matching remains unavailable until a supported scanner and SDK are integrated; no simulated fingerprint is accepted as attendance.
