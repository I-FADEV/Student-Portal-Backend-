# Academic workflow, student officer and campus feed

Implemented locally; deploy the frontend and backend together. These modules use MongoDB transactions and the existing authenticated portal. Tests use disposable data and simulated push senders. No live announcements, student enrolments or assessment results were created by development tests.

## Accounts and navigation

| Account | Entry | Responsibilities |
| --- | --- | --- |
| General administrator | Existing admin login | Create the new **Student Officer** administrator |
| Student officer | Admin login → Student headcount / SRC publishing | Search student profiles and private photos, run headcounts, grant/remove SRC posting access |
| Academic/timetable administrator | Admin login → Lecturers & invigilators / Tests & examinations | Manage lecturer accounts and assignments, manage the single shared invigilator account, schedule assessments, review exceptions and score sheets, release/correct grades |
| Lecturer | `/staff/login` → `/lecturer` | Phone number + password, own course schedule and score sheets, staff announcements and campus feed |
| Invigilator | `/staff/login` → `/exam` | Shared username + password; open assessment check-in only |
| Student | Existing student login | Own test/exam timetable, released grades, announcements and campus feed |

The academic officer creates a lecturer with a name, phone number and initial password of at least 10 characters. The lecturer must change that password before using protected modules. Register numbers consistently with the country code; login removes spaces, parentheses and dashes. Course names or phone numbers alone do not authenticate anyone. Existing course lecturer text does not automatically create or authenticate an account: link each course to the correct account in **Course assignments**.

Only one shared invigilator account can exist. It can be used on multiple laptops simultaneously. The academic officer can change its username/password or archive it. Account updates revoke previous sessions, including every laptop using that shared account. Signing out through the invigilator portal revokes only that station's token, so other check-in laptops remain signed in. Every attendance exception records the account and station label; a shared account does not identify the individual person operating a laptop. The station label is an operator-entered label, not a hardware identity.

## Headcounts and fingerprint boundary

Create a named headcount, search a student by name/matric number, inspect their profile/photo and record physical presence. Current non-biometric entries require a reason and are explicitly labelled **Officer confirmation**. Repeating a check-in does not increase the count. Reports group recorded students by department, level and verification method. Closing a headcount prevents further entries.

**No scanner has been selected or purchased. Fingerprint enrolment and matching are not implemented for a physical device.** Scanner health endpoints report `not_configured`; enrolment and verification return an unavailable response. Client-supplied fingerprints or `matched: true` values cannot produce verified attendance. The screens check the integration status and do not claim an unconnected scanner is ready.

The integration boundary is `services/biometric.service.js`. Once hardware is selected, its supported SDK and any required local service must implement actual capture, enrolment and matching; authenticated station enrolment; a server-issued challenge bound to student/assessment/operator; expiry and replay prevention; capture quality/duplicate enrolment handling; encrypted, restricted template storage if the vendor requires it; replacement/deletion and audit history. Do not enable the UI by merely returning `connected: true`. Device identity, template format and matching are vendor-specific and remain work for that integration.

Windows Hello/WebAuthn do not expose reusable student fingerprint templates to a web application. A laptop's built-in reader must be assessed separately; it cannot be assumed to enrol an entire university's students for shared identification. [Microsoft Windows Hello architecture](https://learn.microsoft.com/en-us/windows/security/identity-protection/hello-for-business/how-it-works), [WebAuthn specification](https://www.w3.org/TR/webauthn-2/).

## Dated tests and examinations

1. Assign active lecturer accounts and credit units to courses. Existing course department/faculty + level targets define the roster, using recorded semester enrolments where available.
2. Choose session, semester and test/exam. Select courses or leave the selection empty for all courses across departments and levels. Add available date/time/room combinations and capacities. Time inputs use the operator's computer timezone; saved times are UTC.
3. Preview the timetable. It checks actual time overlaps against student rosters, assigned lecturers and venues, and checks whole-course room capacity. Large rosters are placed first. A shared course is one assessment with a combined roster. This generator uses the supplied slots; it does not invent rooms or split a course across rooms. Insufficient/conflicting slots produce an unscheduled report. The UI blocks publishing an incomplete preview.
4. Confirm publication. The server recomputes rosters and rechecks clashes under a scheduling lock. One active test and one active exam per course/session are supported. Separate resit or multi-test aggregation workflows are not introduced in this release.
5. Check-in opens automatically when server time reaches the published start and closes at the end. **Open now** moves the start to the present after another clash check; **Close check-in** ends an active session immediately. An assessment with attendance cannot be cancelled. Students see their own published dates under **Tests & examinations**.
6. Invigilators choose an open assessment and label the station. With no scanner, they can request a documented exception for an eligible student. The student is **not** marked present yet. The academic officer approves or rejects it, recording a reason. Concurrent stations cannot duplicate attendance for the same student/assessment. Unrecorded or rejected students remain absent after closing.

Publication snapshots the eligible roster; subsequent profile changes do not silently alter the assessment. Existing historical enrolments cannot infer unrecorded past changes or individual carryover courses that the application's course/enrolment data does not contain. Review those cases before publication.

## Score sheets and grade release

The digital table follows the four Word documents in `score sheet/`: name, matric number, CA /40, exam /60, total /100 and grade, with department/level and separate test/exam attendance status.

- Both test and exam attendance must be closed. Pending exceptions block preparing/submitting a sheet until the academic officer resolves them.
- The assigned lecturer prepares the sheet, saves draft marks, then submits once. Attended components require marks; absent components remain explicit and cannot be filled by the lecturer. Missing marks are not silently converted to zero. A row missing a component has no calculated grade and is released as **Absent**; academic corrections can resolve documented marking/attendance exceptions. Confirm institutional absence/GPA policy during staging before rollout.
- The backend calculates totals and the confirmed A80+, B70+, C60+, D50+, E40+, F<40 grades. Draft saves carry a version so stale tabs cannot overwrite a newer sheet.
- Submission locks lecturer editing. The academic officer reviews and explicitly releases the sheet. Until then the lecturer's new marks are not in the student results collection.
- Academic corrections require a reason and retain before/after marks. Correcting an already released sheet updates the released grade atomically. Legacy result-edit/delete routes cannot bypass the submitted-sheet correction workflow.
- Student result responses exclude CA, exam and total scores entirely. They contain the student's own released grades/course metadata and pending/absence status; GPA uses grades and credit units. Existing legacy results are treated as already released.

## Announcements and campus feed

ICT publishes student announcements to all students, selected faculties/departments and selected levels. Multiple department/faculty selections are supported. Every admin can publish **Staff announcements** to all staff, admins, lecturers or selected staff. Authors control their own drafts and withdrawal; receiving another admin's announcement does not grant editing rights. The shared external invigilator account is excluded from community/staff messaging.

Every admin and only SRC students selected by the student officer can publish campus posts. Lecturers, students and admins can read, like, comment and share a post link. Students/lecturers need authentication to read shared links. All admins can moderate posts/comments; authors can remove their own content. Removing SRC permission immediately blocks subsequent posting requests, while retaining existing posts unless an author/moderator removes them.

Posts allow text, HTTP(S) links and up to four JPEG/PNG/WebP pictures of at most 5 MB each. The server decodes/re-encodes pictures, rejects videos/animations and stores them using the configured media provider. Cloudinary assets use authenticated delivery and are proxied only through the authorized API route. Without Cloudinary, keep `UPLOAD_DIR/feed` on persistent storage and include it in backups. Images require authenticated feed access. Links are rendered as plain text/HTTP(S) anchors; uploaded HTML/SVG and arbitrary embedded markup are not supported.

Each new post atomically creates notification receipts for eligible students, admins and lecturers, plus jobs for their subscribed devices. Navigation badges report unread campus posts; viewing posts marks those receipts read. Push permission is optional and provider acceptance is not proof of display. Deleting a post hides it and cancels queued notifications; already delivered alerts cannot be recalled. Comments and likes do not broadcast another campus-wide push. See [PUSH_SETUP.md](PUSH_SETUP.md) for VAPID/hosting and real-device tests.

## Release verification

Use a restored staging database. Create a Student Officer and lecturer accounts, map existing course lecturer strings to those accounts, check course targets/credit units and headcount photos, and exercise shared invigilator credentials on two laptops. Verify the timetable timezone and capacities with the academic office, exception handling, lecturer locking, academic release/correction and grade-only student responses. Confirm institutional absence treatment and historical carryovers against actual data.

Real fingerprint capture and real push-device delivery are not proven by automated tests. Fingerprint work requires selected hardware/SDK; push requires HTTPS deployment, configured VAPID keys and consenting test devices. Test notifications against a small staging dataset, not the live campus.
