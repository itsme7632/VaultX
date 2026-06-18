---
name: APK Storage
description: How APK files are stored and served, and how the frontend handles download errors
---

## Storage Path
`/home/runner/workspace/storage/apk` — resolved via `path.resolve(process.cwd(), "../../storage/apk")` from API server CWD (`/home/runner/workspace/artifacts/api-server`).

**Why:** This path is at workspace root level, outside the artifact build directory, so it survives `pnpm run build` which only wipes `dist/`. The old path `./storage/apk` inside the artifact directory was also fine but this is clearer.

## Frontend Download Pattern
Settings page uses `fetch("/api/apk/download")` + `URL.createObjectURL(blob)` instead of `<a href download>`.

**Why:** When the server returns a JSON error (404, file missing), `<a download>` would save the JSON text as a file. The fetch approach checks `res.ok` first and shows a toast error instead.

**How to apply:** Any page that triggers APK download must use the JS fetch+blob pattern, not a raw anchor tag.

## Admin Diagnostics
`GET /api/admin/apk/diagnostic` returns per-release disk check (exists, path, size, DB vs disk size).
`GET /api/apk/latest` returns active release metadata (version, fileSize, filename).
