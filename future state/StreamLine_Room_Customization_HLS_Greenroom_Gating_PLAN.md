# StreamLine Future Plan: Room Customization + HLS Greenroom + Gating

Date: 2026-02-03

Status: Plan-only (no build yet)

Owner repo: `Gitwit22/streamline-platform`
Branch context: `feature/hls-dev`

## Goals

- Add a **room customization** settings model (saved per-room) and make client pages consume it safely.
- Add a **new HLS waiting room (“HlsGreenroom”)** that supports “request to join” + host approval.
- Add **hard feature-flag kill-switches** so the platform behaves exactly like today when flags are off.
- Keep the platform functional while incomplete by implementing **safe fallbacks** to the current RTC join flow.

## Non-goals (for MVP)

- No “Apply live” for room customization (Save only; apply on next load / next join).
- No chat in HlsGreenroom.
- No large URL restructuring migration required in one step (we’ll add new routes without breaking existing ones).

---

## 0) Definitions (unambiguous naming)

You currently have two “greenroom” concepts. We will support both and name them clearly.

- **PreJoinLobby** (RTC pre-join lobby)
  - Camera/mic preview, device selection, name entry.
  - This matches the behavior in the provided `GreenRoom.tsx` (future-state reference).

- **HlsGreenroom** (HLS waiting room / host admit)
  - Viewer-only HLS playback.
  - “Waiting for host” / “stream not started” states.
  - Request-to-join flow.
  - **No RTC token until approved.**

Naming change (future implementation task):
- Rename the current “GreenRoom” UI component to **PreJoinLobby**.
- Add a new page/component: **HlsGreenroom**.

---

## 1) Feature flags (gating) — easy on/off

### 1.1 Platform-level flags (global kill-switch)

Current repo already uses a Firestore-backed `featureFlags/*` collection and also exposes “platform flags” to the client (see server `routes/roomToken.ts` and client `src/lib/platformFlagsStore.ts`).

Add two new booleans to the *platform flags* payload:

```ts
platformFlags: {
  greenroomHlsEnabled: boolean;      // master switch for HLS greenroom feature
  roomCustomizationEnabled: boolean; // master switch for room customization UI + apply
}
```

Recommended storage pattern (consistent with existing flags):
- Firestore docs:
  - `featureFlags/greenroomHlsEnabled` → `{ enabled: boolean, reason?: string }`
  - `featureFlags/roomCustomizationEnabled` → `{ enabled: boolean, reason?: string }`

Defaults:
- If a doc is missing, default to **disabled** (safer) OR mirror your existing patterns:
  - Note: some existing flags default to enabled when missing (e.g., `hlsSettingsTab` in `roomToken.ts`).
  - For these new features, default-to-disabled is recommended to guarantee “behaves like now”.

Behavior when OFF:
- Site behaves exactly like today.
- Current join flows unchanged.
- Room customization UI hidden (or “Coming soon”).
- HLS greenroom route disabled (404 or redirect to normal join).

### 1.2 Room-level flags (per room)

Room settings include:

```ts
roomSettings: {
  greenroom: {
    mode: "off" | "prejoin" | "hls_waiting";
    requireApproval: boolean;
    autoAdmit: boolean;
    vipBypass: boolean;
    vipList: string[];      // user IDs OR emails (choose one canonical)
    blockedList: string[];  // user IDs OR emails
  }
}
```

Gating rules:
- If `platformFlags.greenroomHlsEnabled === false`, treat room `mode` as `"prejoin"` or `"off"`.
- If room mode is `"hls_waiting"` but HLS is not live, show “stream not started yet” (do not break).

---

## 2) Data model (Firestore)

### 2.1 Rooms collection

The repo already has a Firestore `rooms/{roomId}` doc with runtime HLS state under `hls` and viewer config under `hlsConfig` (see `streamline-server/services/rooms.ts`).

We will extend, not replace.

Proposed final shape (merged with existing):

```ts
rooms/{roomId} {
  ownerId: string,
  createdAt: Timestamp,
  updatedAt: Timestamp,

  // Existing runtime HLS state (today):
  hls: {
    status: "idle"|"starting"|"live"|"ended"|"error", // we may add "ended"
    playlistUrl?: string,
    startedAt?: Timestamp,
    endedAt?: Timestamp,
    egressId?: string,
    error?: string,
    ...
  },

  // Existing viewer config (today):
  hlsConfig: {
    enabled: boolean,
    title?: string,
    subtitle?: string,
    logoUrl?: string,
    theme?: "light"|"dark",
    offlineMessage?: string,
    ...
  },

  // NEW: room customization & policy (schema from RoomCustomization UI)
  settings: {
    branding?: {
      title?: string,
      logoUrl?: string,
      primaryColor?: string,
      ...
    },

    overlays?: {
      ...
    },

    // NEW: greenroom config (policy)
    greenroom: {
      mode: "off"|"prejoin"|"hls_waiting",
      requireApproval: boolean,
      autoAdmit: boolean,
      vipBypass: boolean,
      vipList: string[],
      blockedList: string[],
    },
  },
}
```

Notes:
- Your spec uses `runtime.hls` and `runtime.greenroom`. In this repo, `hls` is already treated as runtime state. For minimal migration, keep `hls` as-is and add `settings.greenroom` for policy.
- If you still want a `runtime` object later, add it as a non-breaking alias and keep `hls` for backward compatibility.

### 2.2 Join requests subcollection

Add:

```ts
rooms/{roomId}/joinRequests/{requestId} {
  uid?: string,
  guestKey?: string,
  displayName: string,

  requestedAt: Timestamp,
  status: "waiting" | "approved" | "denied" | "expired",

  decidedAt?: Timestamp,
  decidedByUid?: string,

  reason?: string,
  userAgent?: string,

  // Recommended for security + token minting:
  approvedRole?: "viewer" | "speaker",   // or "participant"; pick one vocabulary
  rtcTokenIssuedAt?: Timestamp,            // prevents infinite re-reads
}
```

TTL policy (recommended):
- If `status=waiting` for > 30 minutes, mark `expired`.
- Implementation options:
  - A scheduled job (Cloud Scheduler / Cloud Functions) OR
  - On-read cleanup when polling (server marks expired when it sees stale).

Indexes you will likely need:
- `rooms/{roomId}/joinRequests` where `status == "waiting"` order by `requestedAt`.

---

## 3) API endpoints (server)

The server is Express with route modules under `streamline-server/routes/`.
HLS already exists under `routes/hls.ts` with:
- `GET /api/hls/public/:roomId` → viewer-safe `{status, playlistUrl}`
- `POST /api/hls/start/:roomId` (auth + room access token)

We’ll add room-centric endpoints without breaking existing ones.

### 3.1 Room settings

#### GET /api/rooms/:roomId
Returns:
- room `settings`
- room HLS runtime (`hls.status`, `hls.playlistUrl`)
- derived “greenroom mode” and effective gating

Security:
- Viewer-safe by default (no secrets). If you need host-only fields, either:
  - Add `GET /api/rooms/:roomId/private` requiring auth, or
  - Use the existing `requireRoomAccessToken` middleware pattern.

#### POST /api/rooms/:roomId/settings
Auth: host/admin only
- Writes `rooms/{roomId}.settings` and updates `updatedAt`.
- For MVP, this powers the RoomCustomization UI.

### 3.2 HLS start/stop

To match your spec, add wrappers:
- `POST /api/rooms/:roomId/hls/start` (host/admin)
- `POST /api/rooms/:roomId/hls/stop` (host/admin)

Implementation strategy:
- Prefer calling the same underlying service functions used in `routes/hls.ts` rather than duplicating logic.
- Keep existing `/api/hls/*` endpoints for backwards compatibility.

### 3.3 Greenroom join request

`POST /api/rooms/:roomId/join-requests`
Auth: optional
Body:
```json
{ "displayName": "string", "guestKey": "string?" }
```

Server rules:
- If blocked → 403.
- If `autoAdmit === true` OR VIP bypass applies → return `{ status: "approved", rtcToken: "..." }`.
- If approval not required → `{ status: "approved", rtcToken: "..." }`.
- Else create request doc `status=waiting` and return `{ status: "waiting", requestId }`.

Guest identity:
- If not logged in, require/stash `guestKey` in localStorage and send it on POST and GET.

### 3.4 Approve/Deny (host)

- `POST /api/rooms/:roomId/join-requests/:requestId/approve`
- `POST /api/rooms/:roomId/join-requests/:requestId/deny`

Approve behavior:
- Update doc to `approved` and set `decidedAt`, `decidedByUid`.
- Token minting options:
  1) Return RTC token directly from approve endpoint.
  2) Or have the guest poll and receive the token from the status endpoint (preferred when host and guest UIs are decoupled).

### 3.5 Request status (guest polling)

`GET /api/rooms/:roomId/join-requests/:requestId`
Returns:
- `{ status }` plus `{ rtcToken }` when approved (ideally minted once).

Security:
- For anonymous guests, require `guestKey` to match the request doc.
- Ensure tokens are **one-time mint**:
  - If `rtcTokenIssuedAt` is set, return status without token (or return the same token only for a short time).

---

## 4) Token minting rules (“admit” is the heart)

Rules:
- A guest in **HlsGreenroom** gets **NO RTC token**.
- When approved, mint an RTC token with permissions based on “viewer” vs “speaker”.

Repo reality check:
- The existing token issuance is in `streamline-server/routes/roomToken.ts` and is opinionated about roles (notably: viewer room tokens are restricted in "simple" mode).

Plan (future implementation):
- Add a dedicated token mint helper for greenroom approvals that:
  - Uses LiveKit `AccessToken` directly (same dependency used in `roomToken.ts`).
  - Applies existing permission mapping (`roleToParticipantPermission` / `livekitPermissions.ts`).
  - Explicitly supports a “viewer-like” token with `canPublish=false`.

Token types:
- **Audience/Viewer**: `canSubscribe=true`, `canPublish=false`
- **Admitted Speaker**: `canSubscribe=true`, `canPublish=true` (respect room policy for audio/video)

---

## 5) Client routing (UX flow)

Today’s app uses flat routes like `/join`, `/room/:roomName`, `/live/:savedEmbedId` (see `streamline-client/src/App.tsx`).

Future goal is roomId-based routes without breaking existing paths.

### 5.1 New pages (future)

Add these routes (in addition to existing ones):
- `/rooms/:roomId/join` → Join Router (decides route)
- `/rooms/:roomId/prejoin` → PreJoinLobby (device preview)
- `/rooms/:roomId/greenroom` → HlsGreenroom (HLS waiting room)
- `/rooms/:roomId/live` → RTC Room

### 5.2 Join Router logic

On `/rooms/:roomId/join`:
1) Fetch `GET /api/rooms/:roomId`.
2) If `platformFlags.greenroomHlsEnabled` is OFF → route to `/rooms/:roomId/prejoin` (or existing `/join` behavior).
3) Else if `room.settings.greenroom.mode === "hls_waiting"`:
   - If `hls.status === "live"` AND `playlistUrl` exists → route to `/rooms/:roomId/greenroom`.
   - Else → route to `/rooms/:roomId/prejoin` OR show “host not live yet” page.
4) Else → route to `/rooms/:roomId/prejoin`.

Fallback rule:
- Any fetch error → fallback to current join flow (no breaking).

---

## 6) HlsGreenroom page behavior

UI:
- HLS player (manifest/playlist URL)
- Request-to-join CTA
- Waiting UI with polling status
- States:
  - HLS not started (status idle/starting)
  - Live + waiting
  - Approved → redirect to RTC
  - Denied/Expired

Data flow:
- Load room + HLS status using either:
  - existing `GET /api/hls/public/:roomId`, and/or
  - new `GET /api/rooms/:roomId`.

Request-to-join:
- `POST /api/rooms/:roomId/join-requests` →
  - approved + token → redirect immediately
  - waiting + requestId → start polling

Polling:
- `GET /api/rooms/:roomId/join-requests/:requestId` every 2–3s
- If approved returns token → navigate to `/rooms/:roomId/live?token=...`

---

## 7) Host dashboard controls

There is already UI scaffolding referencing “greenroom coming soon” (e.g., `RoleOverlay.tsx` + `Room.tsx` has a `dashboardGreenroomEnabled` flag).

Future implementation:
- Add a “Greenroom” panel inside the host Room UI:
  - Toggle approval required (if you want runtime override)
  - List pending join requests (status=waiting)
  - Approve / deny actions
  - Optional: approve as “speaker” vs “viewer”

Host endpoints used:
- approve/deny routes
- host reads joinRequests list with a host-only endpoint (or reuse Firestore reads via server if you don’t want client direct Firestore reads).

---

## 8) Room customization: Save vs Apply

### 8.1 MVP behavior

- **Save settings** = persisted defaults for this room.
- **Apply now** (optional v2) = update active session immediately.

MVP scope:
- Implement Save only.
- Customizations apply on next load/join (and optionally a refresh).

### 8.2 Where customization is consumed

Minimum:
- Viewer pages (HLS + RTC) use:
  - brand colors
  - logo
  - overlays (display-only)

Host pages use:
  - layout defaults
  - room title/branding

Repo note:
- There is already `RoomLayout` plumbing and `hlsConfig` viewer config in `rooms/{roomId}`. Room customization should augment these, not fight them.

---

## 9) Development-mode safety (don’t break the platform)

### 9.1 Hard fallback rules

If anything fails in the greenroom flow, fallback to normal RTC join.

Fallback triggers:
- room settings missing
- HLS playlist URL missing
- join-request endpoint errors
- polling errors

Fallback action:
- route to PreJoinLobby / existing `/join`
- show a small banner: “Greenroom temporarily unavailable”

### 9.2 Feature flag kill-switch always wins

If `greenroomHlsEnabled === false`:
- never show the HLS greenroom route
- never create join requests
- never block RTC joins

---

## 10) “Done means done” checklist (acceptance criteria)

### Room Customization
- Room settings saved to Firestore (`rooms/{roomId}.settings`).
- Join router reads settings.
- HLS/RTC pages display branding from settings.
- Feature flag hides/disables all UI and logic when off.

### HLS Greenroom
- `/rooms/:roomId/greenroom` plays HLS when available.
- Request-to-join creates a joinRequest.
- Host sees pending list.
- Approve mints RTC token and guest is redirected.
- Deny shows denied state.
- Safe fallback to classic join always works.

---

## 11) Concrete implementation map (one-click execution order)

This is the exact order to implement later without thrashing.

### A) Server (streamline-server)
1) Add `routes/rooms.ts` (GET room + POST settings)
2) Add `routes/roomsGreenroom.ts` (join-requests create/status/approve/deny)
3) Add wrapper endpoints under `/api/rooms/:roomId/hls/*` (optional; keep `/api/hls/*`)
4) Add join-request TTL handling (lazy expiry on reads or a scheduled script)
5) Extend platform flags payload returned to the client with:
   - `greenroomHlsEnabled`
   - `roomCustomizationEnabled`

### B) Client (streamline-client)
1) Add new routes in `src/App.tsx` for `/rooms/:roomId/*` without removing existing routes.
2) Add `JoinRouter` component/page.
3) Rename existing GreenRoom UI to `PreJoinLobby` (or add wrapper export to avoid breaking imports).
4) Add `HlsGreenroom` page using existing `src/services/hls.ts` patterns.
5) Add host dashboard panel UI (gated by platform flag + room settings).
6) Add room customization UI (gated) and wire to `/api/rooms/:roomId/settings`.

### C) Firestore
1) Create `featureFlags/greenroomHlsEnabled` and `featureFlags/roomCustomizationEnabled` docs.
2) Ensure indexes exist for querying waiting join requests.

### D) QA / Test Plan
- Server: unit tests for join request state machine + token minting.
- Client: basic happy-path smoke (manual) + regression checks for existing `/join`, `/live/:savedEmbedId`, and HLS start/stop.

---

## Open decisions (pick these before coding)

1) `vipList` / `blockedList` identifiers
- Choose **UIDs** (strong, stable) or **emails** (human-friendly). UID is recommended.

2) Token delivery
- Approve endpoint returns token vs guest status endpoint returns token.
- Recommended: status endpoint mints token once and returns it.

3) Viewer role in “simple mode”
- Current server logic discourages viewer tokens. Decide whether greenroom “audience” should:
  - get a true viewer token (canPublish=false), or
  - get a participant token with publish disabled.

4) Route strategy
- Add `/rooms/:roomId/*` while keeping existing routes for backwards compatibility.

---

## Appendix: Existing repo anchors (for later implementers)

- Platform flags cache/store:
  - `streamline-client/src/lib/platformFlagsStore.ts`
- Server platform env kill switch (transcode):
  - `streamline-server/lib/platformFlags.ts`
- Room HLS runtime state + room doc:
  - `streamline-server/services/rooms.ts`
- HLS start/stop and public status:
  - `streamline-server/routes/hls.ts`
- Token issuance patterns:
  - `streamline-server/routes/roomToken.ts`
