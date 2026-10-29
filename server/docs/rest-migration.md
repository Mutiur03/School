# REST migration of the Express-era modules

Twelve modules moved from Express routers to Nest (`server/src/nest/modules/*`) and now follow
the conventions in `AGENTS.md`: noun paths, `GET/POST/PATCH/PUT/DELETE`, class-validator DTOs
(global `ValidationPipe`, `whitelist` + `forbidNonWhitelisted`), the `{ success, data }`
envelope from `ResponseInterceptor`, built-in Nest exceptions, and `@SchoolId()`.

`school` (with the billing routes it mounted) moved too. Its super-admin routes must run without
a school, see "Pre-tenant super-admin routes" below. Like the other modules, every old
`/api/schools*` path is gone (404 on a tenant host, 400 "no school" on the super-admin host), and
the dashboard, dashboard-expo and client-next call only the paths in the right-hand column.

## Old → new (old paths removed)

| Module          | Old path (removed)                                              | REST path                                                                                              |
| --------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| level           | `GET /api/level/getLevels`                                      | `GET /api/levels`                                                                                      |
|                 | `POST /api/level/addLevel`                                      | `POST /api/levels` (201)                                                                               |
|                 | `PUT /api/level/updateLevel/:id`                                | `PATCH /api/levels/:id` (partial)                                                                      |
|                 | `DELETE /api/level/deleteLevel/:id`                             | `DELETE /api/levels/:id`                                                                               |
| dashboard       | `GET /api/dashboard`                                            | `GET /api/dashboard/overview`                                                                          |
|                 | `GET /api/dashboard/attendance?attendanceDays=`                 | `GET /api/dashboard/attendance-summary?days=7\|15\|30`                                                 |
| notice          | `GET /api/notices/getNotices?limit`                             | `GET /api/notices?limit`                                                                               |
|                 | `GET /api/notices/presigned-url`                                | `GET /api/notices/upload-url?filename&contentType`                                                     |
|                 | `POST /api/notices/addNotice`                                   | `POST /api/notices` (201)                                                                              |
|                 | `PUT /api/notices/updateNotice/:id`                             | `PATCH /api/notices/:id`                                                                               |
|                 | `DELETE /api/notices/deleteNotice/:id`                          | `DELETE /api/notices/:id`                                                                              |
| events          | `GET /api/events/getEvents`                                     | `GET /api/events`                                                                                      |
|                 | `GET /api/events/presigned-url?type=`                           | `GET /api/events/upload-url?type=image\|file&filename&contentType`                                     |
|                 | `POST /api/events/addEvent`                                     | `POST /api/events` (201)                                                                               |
|                 | `PUT /api/events/updateEvent/:id`                               | `PATCH /api/events/:id`                                                                                |
|                 | `DELETE /api/events/deleteEvent/:id`                            | `DELETE /api/events/:id`                                                                               |
| citizen-charter | `GET /api/citizen-charter` (raw row)                            | `GET /api/citizen-charter/document` (404 when none)                                                    |
|                 | `GET /api/citizen-charter/presigned-url`                        | `GET /api/citizen-charter/upload-url`                                                                  |
|                 | `POST /api/citizen-charter {key}`                               | `PUT /api/citizen-charter/document {key}` (create or replace)                                          |
| syllabus        | `GET /api/syllabus?class&year`                                  | `GET /api/syllabuses?class&year`                                                                       |
|                 | `GET /api/syllabus/presigned-url`                               | `GET /api/syllabuses/upload-url`                                                                       |
|                 | `POST /api/syllabus/upload`                                     | `POST /api/syllabuses` (201)                                                                           |
|                 | `PUT /api/syllabus/:id`                                         | `PATCH /api/syllabuses/:id`                                                                            |
|                 | `DELETE /api/syllabus/:id`                                      | `DELETE /api/syllabuses/:id`                                                                           |
| class-routine   | `GET /api/class-routine/pdf`                                    | `GET /api/class-routines`                                                                              |
|                 | `GET /api/class-routine/presigned-url`                          | `GET /api/class-routines/upload-url`                                                                   |
|                 | `POST /api/class-routine/pdf {key}`                             | `POST /api/class-routines {key}` (201)                                                                 |
|                 | `PUT /api/class-routine/pdf/:id {key}`                          | `PATCH /api/class-routines/:id {key}`                                                                  |
|                 | `DELETE /api/class-routine/pdf/:id`                             | `DELETE /api/class-routines/:id`                                                                       |
| staff           | `GET /api/staffs?page&limit&search`                             | `GET /api/staff?page&limit(≤200)&search` (optional auth; admins get full rows)                         |
|                 | `POST /api/staffs {staff:[…]}`                                  | `POST /api/staff {staff:[…]}` (201)                                                                    |
|                 | `PUT /api/staffs/:id`                                           | `PATCH /api/staff/:id`                                                                                 |
|                 | `DELETE /api/staffs/:id`                                        | `DELETE /api/staff/:id`                                                                                |
|                 | `GET /api/staffs/presigned-url?id=`                             | `GET /api/staff/:id/image/upload-url`                                                                  |
|                 | `PUT /api/staffs/:id/image {key}`                               | `PUT /api/staff/:id/image {key}`                                                                       |
|                 | `DELETE /api/staffs/:id/image`                                  | `DELETE /api/staff/:id/image`                                                                          |
| gallery         | `GET /api/gallery/getGalleries` (raw)                           | `GET /api/gallery`                                                                                     |
|                 | `GET /api/gallery/getCategories` (raw)                          | `GET /api/gallery/categories`                                                                          |
|                 | `POST /api/gallery/addCategory` (raw)                           | `POST /api/gallery/categories` (201)                                                                   |
|                 | `GET /api/gallery/presigned-url`                                | `GET /api/gallery/upload-url`                                                                          |
|                 | `POST /api/gallery/upload {keys, eventId, category, status}`    | `POST /api/gallery/images {keys, caption?, eventId? \| categoryId?}` — status set by the server        |
|                 | `GET /api/gallery/pending`, `/rejected` (raw)                   | `GET /api/gallery/images?status=pending\|rejected` (admin)                                             |
|                 | `GET /api/gallery/{approved,pending,rejected}Students` (raw)    | `GET /api/gallery/my-images?status=` (student)                                                         |
|                 | `PUT /api/gallery/updateGallery/:id`                            | `PATCH /api/gallery/images/:id`                                                                        |
|                 | `PATCH /api/gallery/approve/:id`, `/reject/:id`                 | `PATCH /api/gallery/images/:id/status {status}`                                                        |
|                 | `POST /api/gallery/rejectMultiple {ids}`                        | `PATCH /api/gallery/images {ids, status:'rejected'}`                                                   |
|                 | `POST /api/gallery/deleteMultiple {ids}`                        | `DELETE /api/gallery/images {ids}`                                                                     |
|                 | `DELETE /api/gallery/deleteGallery/:id`                         | `DELETE /api/gallery/images/:id`                                                                       |
|                 | `GET /api/gallery/getGalleries/campus/:id` (raw)                | `GET /api/gallery/categories/:id/images`                                                               |
|                 | `GET /api/gallery/getGalleries/event/:id` (raw)                 | `GET /api/gallery/events/:id/images`                                                                   |
|                 | `DELETE /api/gallery/deleteCategoryGallery/:id`                 | `PATCH /api/gallery/categories/:id/images {status:'rejected'}`                                         |
|                 | `DELETE /api/gallery/deleteEventGallery/:id`                    | `DELETE /api/gallery/events/:id/images`                                                                |
|                 | `PUT /api/gallery/setCategoryThumbnail/:c/:i`                   | `PUT /api/gallery/categories/:id/thumbnail {imageId}`                                                  |
|                 | `PUT /api/gallery/setEventThumbnail/:e/:i`                      | `PUT /api/gallery/events/:id/thumbnail {imageId}`                                                      |
| sms-settings    | `GET /api/sms-settings`                                         | `GET /api/sms/settings`                                                                                |
|                 | `PATCH /api/sms-settings` (any key)                             | `PATCH /api/sms/settings` (DTO; credential keys → 400)                                                 |
|                 | `GET /api/sms-settings/public`                                  | `GET /api/sms/settings/public` (admin, teacher; not rate limited)                                      |
|                 | `GET /api/sms-settings/balance`                                 | `GET /api/sms/balance`                                                                                 |
|                 | `POST /api/sms-settings/test`                                   | `POST /api/sms/test-messages {phoneNumber, message}` (201)                                             |
|                 | `GET /api/sms-settings/calculate-count?text=`                   | `GET /api/sms/message-count?text=`                                                                     |
| sms-logs        | `GET /api/sms/sms-logs` (raw)                                   | `GET /api/sms/logs?status&date&category&page&limit(≤100)`                                              |
|                 | `DELETE /api/sms/sms-logs {smsLogIds}` (raw)                    | `DELETE /api/sms/logs {ids}`                                                                           |
|                 | `POST /api/sms/retry-sms {smsLogIds}` (raw)                     | `POST /api/sms/logs/retries {ids}` (201)                                                               |
|                 | `GET /api/sms/usage-stats?days` (raw)                           | `GET /api/sms/usage?days(1–365)`                                                                       |
|                 | `POST /api/sms/bulk-sms` (raw; bad input → 500)                 | `POST /api/sms/bulk-messages {classNames, message}` (201; bad input → 400)                             |
|                 | `GET /api/sms/student-count?classes=` (raw)                     | `GET /api/sms/recipient-counts?classes=6,7`                                                            |
| school (tenant) | `GET /api/schools/public`                                       | `GET /api/school` (public, the host's school)                                                          |
|                 | `GET /api/schools/subscription-access`                          | `GET /api/school/subscription-access` (admin/teacher/student; open while locked)                       |
|                 | `GET /api/schools/billing`                                      | `GET /api/school/billing` (admin; open while locked)                                                   |
|                 | `PUT /api/schools/:id` (tenant router; unreachable)             | removed: the super-admin route always answered first                                                   |
| school (super)  | `GET /api/schools`                                              | `GET /api/platform/schools`                                                                            |
|                 | `POST /api/schools`                                             | `POST /api/platform/schools` (201; `createSchoolSchema`)                                               |
|                 | `PUT /api/schools/:id`                                          | `PUT /api/platform/schools/:id` (full replace; `updateSchoolSchema`)                                   |
|                 | `POST /api/schools/logo-upload-url {fileName,contentType,kind}` | `GET /api/platform/schools/upload-url?filename&contentType=image/*&kind=logo\|header\|banner\|hotline` |
|                 | `GET /api/schools/:id/billing`                                  | `GET /api/platform/schools/:id/billing`                                                                |
|                 | `PUT /api/schools/:id/billing`                                  | `PUT /api/platform/schools/:id/billing` (`updateSubscriptionSchema`)                                   |
|                 | `POST /api/schools/:id/rotate-student-passwords` (xlsx)         | `POST /api/platform/schools/:id/student-password-rotations` (201, xlsx)                                |
|                 | `GET /api/schools/:id/students/export` (xlsx)                   | `GET /api/platform/schools/:id/student-export` (xlsx)                                                  |
|                 | `GET /api/schools/sms-overview`                                 | `GET /api/platform/sms-overview`                                                                       |
|                 | `GET /api/schools/:id/sms-credentials`                          | `GET /api/platform/schools/:id/sms-credentials`                                                        |
|                 | `PUT /api/schools/:id/sms-credentials`                          | `PATCH /api/platform/schools/:id/sms-credentials` (unknown fields → 400)                               |
|                 | `POST /api/schools/:id/sms-balance {amount}` (unvalidated)      | `POST /api/platform/schools/:id/sms-balance-topups {amount: int 1..10000000}` (201)                    |

"raw" means the old body had no envelope. Every REST body is `{ success: true, data }`;
`DELETE` returns `{ success: true }` with no data when there is nothing to return. Errors are
`{ success: false, error, message, errors }` with the right status (400 validation, 401, 403,
404 unknown/cross-tenant id, 409 unique conflict).

School bodies keep the zod schemas from `@school/shared-schemas` (`ZodBodyPipe`, same 400 as the
old `validate()` middleware) instead of class-validator DTOs: the dashboard and Expo forms
validate with the same schemas, and a second copy would drift. Query strings and the small SMS
bodies use class-validator DTOs. Zod via `ZodBodyPipe` is now the Nest standard for request bodies (see `AGENTS.md`); the
class-validator DTOs of the other modules are legacy and move over gradually, not in bulk.

## Pre-tenant super-admin routes

Nest is mounted after the tenant middlewares, so the old `superAdminSchoolRouter` position
(before them) is reproduced with an explicit list in `src/middlewares/pre-tenant-routes.ts`:
only `/api/platform/*` (plus the existing `POST /api/school-code-lookups`) skips the tenant
lookup, the RLS school sync and the school-context check. The request then carries exactly what
the old router saw: no `req.schoolId`, the RLS context from `initRlsContextMiddleware` (no school;
super admin only with a verified super-admin access token). Every platform route has
`Auth('super_admin')`, which also enforces the super-admin host. The subscription check never
applies (no school), as before. Tenant routes (`/api/school*`) still go through the full chain,
so the school lookup and the 402 lock are unchanged; the lock allow-list is now
`GET /api/school/billing` and `GET /api/school/subscription-access`. Paths match case-insensitively with one optional trailing slash,
like Express routing.

## Old paths are gone

There are no aliases: the old paths in the left column now get `404 Route not found`. Server,
dashboard, client-next and the dashboard-expo app switch together. Installed Expo builds keep
calling the old paths until the dashboard-expo OTA is published (needs separate approval), so
deploy the server and publish the OTA together.

## Security fixes in the REST routes

- `POST /api/gallery/images` sets the status on the server (admin → approved, others →
  pending) and rejects a client `status`. The old upload route trusted the client value.
- `PATCH /api/sms/settings` accepts only the seven editable fields (DTO, unknown keys → 400), and
  `SmsSettingsService.updateSettings` keeps only `TENANT_EDITABLE_SMS_FIELDS` as a second line.
  The old route forwarded every non-credential key (`id`, `school_id`, …) to `prisma.update`.

## Tests

Each module has `<module>.http.spec.ts` next to it (real app, test DB, two seeded schools via
`src/nest/common/http-world.ts`, fake R2/SMS server from `scripts/ci/fake-r2-sms.mjs`): happy path
and envelope, 401/403 per role, cross-school isolation, DTO validation and unknown fields, 404,
and presigned uploads. Service logic has `*.service.spec.ts` unit tests. CI runs both (unit step
and the `http\.spec` step in `deploy-server.yml`).

## Known gaps

- There is no unique constraint on levels (class, section, year), so duplicates are accepted.
  Same as before.
- `sms-settings`, `sms-logs` and `school` services stay static because Express modules
  (attendance) share them.
