# Editor Backend + API Wiring (Condensed)

Date: 2026-02-03 (updated 2026-03-08)

This doc captures the **actual API surface** that the editor and recording/download flows rely on.

---

## Current truth: client expectations vs server reality

### Client expects (editing projects)
Client wrapper: `streamline-client/src/lib/editingApi.ts`

Projects + timeline endpoints:
- `GET /api/editing/projects` (list) ✅
- `POST /api/editing/projects` (create) ✅
- `GET /api/editing/projects/:id` ✅
- `PATCH /api/editing/projects/:id` ✅
- `DELETE /api/editing/projects/:id` ✅
- `PUT /api/editing/projects/:id/timeline` ✅

Export endpoints:
- `POST /api/editing/export` ✅
- `GET /api/editing/exports/:exportId` ✅

### Server currently provides (editing)
Server router: `streamline-server/routes/editing.ts`

All endpoints above are implemented, including:
- Full project CRUD (list, create, get, update, delete)
- Timeline save/load with track state persistence
- Recording library helpers (list + recording details)
- `POST /api/editing/render` (recording-centric render/upload path)
- Export job creation and status polling

---

## Recording download endpoints (implemented)

Server router: `streamline-server/routes/recordings.ts`

Implemented:
- `GET /api/recordings/:id/download-link` → returns a signed URL (15 min TTL)
- `GET /api/recordings/:id/download` → redirects to `/download-link`
- `POST /api/recordings/:id/report-download-issue`

Key behavior:
- ownership is enforced
- expired links return 410
- signed URL generation failure suggests "Emergency Download" fallback

---

## Data storage (what to persist)

### Recordings
Firestore: `recordings/{recordingId}`
- used for content library + download + editor load

### Editing projects
Firestore: `editing_projects/{projectId}`
- Full CRUD + timeline persistence endpoints implemented
- Timeline data includes clips (with trackId) and track state (mute/lock/solo/link)

---

## Remaining backend work

1) Export pipeline:
- `POST /api/editing/export` creates a job document but actual render/encode is not yet wired to a worker queue
- Short-term: wire UI to existing `POST /api/editing/render` for a recording render story

2) Validation hardening:
- Asset existence checks on clip references
- Rate limiting on upload/export endpoints
