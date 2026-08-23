# Flutter/Android API Handoff

This is the primary handoff document for the developer building the
Flutter/Android body-camera application. Every endpoint, field, and
event described here was confirmed directly against the current backend
source (`backend/app/`) and the live OpenAPI schema (Alembic head
`6b1f4a9d3e72`) — nothing is invented. See also
`docs/MOBILE_DEVICE_API.md` (a more compact reference covering the same
endpoints) and `docs/FLUTTER_API_QUICK_REFERENCE.md` (a table view).

**Flutter/Android source code is intentionally NOT part of this repository.**

---

## A. Base Configuration

```
API_BASE_URL=http://<host>:8000
```

`WS_BASE_URL` is not a separate backend concept — it's the same host,
scheme swapped (`http`→`ws`, `https`→`wss`). The web frontend derives it
this way automatically (see `web_dashboard/src/hooks/useOpsSocket.js`);
the Flutter app should do the same:
```
WS_BASE_URL = API_BASE_URL.replace("http", "ws")
```

**Android emulator note:** `localhost`/`127.0.0.1` from inside the Android
emulator refers to the emulator itself, **not** your host machine. Use
`10.0.2.2` instead when running the backend on your development machine
and testing against the standard Android emulator (e.g.
`API_BASE_URL=http://10.0.2.2:8000`). A physical device on the same
network should use your host machine's real LAN IP instead.

---

## B. Authentication

```
POST /auth/login
Content-Type: application/json

{ "username": "<phone>", "password": "<password>" }
```

Response `200`:
```json
{
  "access_token": "<JWT>",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": { "id": "...", "phone": "...", "role": "constable", "is_active": true, "station_id": null, "created_at": "..." }
}
```

`expires_in` is seconds (backend default: 3600 / 60 minutes, configurable
server-side via `ACCESS_TOKEN_EXPIRE_MINUTES` — do not hardcode 3600 as a
permanent assumption, read it from the response).

Every subsequent request:
```
Authorization: Bearer <access_token>
```

**There is no refresh-token endpoint and no logout endpoint.** The token
is simply discarded client-side on logout; when it expires, the next
request returns `401` and the app should return to the login screen.
`401` responses are intentionally generic (do not reveal whether the
account exists) — do not attempt to distinguish "wrong password" from
"unknown user" in the UI.

---

## C. Device Registration

```
POST /devices/register
Authorization: Bearer <token>   (constable role only)

{
  "device_identifier": "<unique string>",
  "platform": "android",
  "app_version": "1.0.0",
  "device_model": "Pixel 7"
}
```

- `device_identifier`: **the only field that matters for identity.** Use a
  stable per-install identifier (e.g. Android ID, or a UUID generated once
  and persisted). 1–255 characters, must be globally unique across the
  whole system.
- Constable association is automatic and server-derived — it's the
  authenticated user's own constable record, taken from the JWT. The app
  never supplies or chooses this.
- Re-registering the same `device_identifier` under the same account is
  safe (idempotent, updates metadata). Attempting to register an
  identifier already claimed by a **different** constable returns `403`.

**What the Flutter app should persist locally:** `device_identifier`
(generated/read once, kept forever for this install) and the current
`access_token` (until it expires or the user logs out). The backend
`device.id` (UUID) returned in the response is also useful to cache for
constructing subsequent request bodies without a re-lookup, though every
device-scoped endpoint accepts `device_identifier` directly instead.

---

## D. Device Heartbeat

```
POST /devices/heartbeat
Authorization: Bearer <token>

{ "device_identifier": "<...>", "battery_percent": 0-100, "is_charging": true }
```
(`battery_percent`/`is_charging` optional per call.)

**The backend does not mandate a fixed interval** — there is no
server-side minimum/maximum enforced, and no documented recommended
value exists in the current code. A reasonable default informed by the
backend's own configurable staleness thresholds (`device_stale_seconds`
default 120s, `device_offline_seconds` default 600s, both admin-settable)
is **every 30–60 seconds** while the app is active — frequent enough that
a single missed beat doesn't cross the stale threshold. This is a
suggestion, not a documented backend contract.

- `status` in the response (`online`/`stale`/`offline`/`recording`) is
  computed by the backend from `last_seen_at` — the app never computes or
  reports this itself.
- **Does not clear an active `recording` device status** — heartbeating
  during an active recording is safe and expected.
- Network failure behavior: **CLIENT RESPONSIBILITY** — see §O.

---

## E. Battery

```
POST /devices/battery
Authorization: Bearer <token>

{ "device_identifier": "<...>", "battery_percent": 0-100, "is_charging": true }
```
(`battery_percent` required here, `is_charging` optional.)

Every call is stored as a permanent history row — this is intentionally
separate from the single "latest" value surfaced in `GET /devices/{id}`.

**Battery alerts are generated entirely by the backend, not the mobile
app.** Configurable thresholds (`battery_warning_threshold` default 20%,
`battery_critical_threshold` default 10%, both admin-settable) determine
when `low_battery`/`critical_battery` alerts are created — the app does
not need to implement any threshold logic itself; simply report the real
battery percentage.

---

## F. Location

Reuses the existing constable self-service endpoint (not a
device-specific one):
```
POST /constables/me/location
Authorization: Bearer <token>

{ "latitude": -90..90, "longitude": -180..180, "accuracy": 0+ }
```
`accuracy` (meters) is optional. No explicit staleness window is enforced
by this endpoint itself — the latest report is simply what
`GET /devices/{id}` reflects (`latitude`/`longitude`/`location_updated_at`).

**The app must periodically send location while operating** — there is
no push/pull mechanism from the backend side; if the app stops sending,
the Control Room simply sees an increasingly stale `location_updated_at`.
No specific interval is mandated by the backend (**CLIENT
RESPONSIBILITY** to choose one — balance battery/data use against Control
Room freshness needs).

---

## G. Start Recording

```
POST /recordings/start
Authorization: Bearer <token>

{
  "device_identifier": "<own, already-registered device>",
  "trigger_type": "emergency_button" | "manual" | "remote",
  "incident_id": "uuid"   // optional, omit for the standard emergency-button flow
}
```
(Note: the backend enum values are the exact lowercase strings shown —
`emergency_button`, not `EMERGENCY_BUTTON`.)

Lifecycle: `recording` → `completed` (via §I) or `recording` → `cancelled`
(via §J). No other transitions exist; `failed` is a defined status value
in the schema but nothing currently transitions a recording into it.

**RecordingSession is completely independent of Incident** —
`incident_id` is optional and normally omitted entirely for the
volume-button emergency flow. A recording can exist and be fully valid
with no incident ever created.

**The recording session's `id` (a UUID) is the parent ID for every
subsequent chunk upload for this recording** — store it for the duration
of the active recording.

---

## H. Chunk Upload

```
POST /recordings/{recording_id}/chunks
Authorization: Bearer <token>
Content-Type: multipart/form-data

chunk_number: <integer, starting at 1>
duration_seconds: <float>     (optional)
is_last_chunk: "true" | "false"
file: <binary>
```

- **Chunks may arrive out of order** — upload as soon as each is ready,
  never wait for or reorder previous chunks locally.
- **`chunk_number` must be unique per recording** — a duplicate is
  rejected with `409 Conflict`, and the original chunk is preserved
  unchanged (not overwritten).
- **Never rename or reorder chunks on the mobile side** — the backend
  builds the ordered playback manifest server-side from `chunk_number`
  alone; local file naming is irrelevant to ordering.
- Allowed MIME types (content-sniffed, not trusted from your declared
  `Content-Type` alone): `video/mp4`, `video/webm`, `video/quicktime`,
  `audio/mpeg`, `audio/wav`, `audio/mp4`, `image/jpeg`, `image/png`.
  Maximum size per chunk: **500 MB**.
- **Missing chunks are detectable** by anyone (including the app itself,
  if desired) via `GET /recordings/{id}/chunks` — see §K.

**Retry behavior on network failure — CLIENT RESPONSIBILITY:**
If a chunk upload fails partway (timeout, connection drop), **retry the
exact same `chunk_number`** — do not increment past it, and do not start
a new recording session. If the retry lands after the original request
had actually succeeded server-side despite the client seeing a failure,
the backend correctly rejects the duplicate with `409` — treat a `409`
here as "already uploaded, safe to move on to the next chunk," not as an
error requiring further action.

---

## I. Recording Completion

```
POST /recordings/{recording_id}/complete
Authorization: Bearer <token>
```
No body. Only legal from `status == "recording"` (`409` otherwise).

The backend calculates `missing_chunk_numbers` at completion time and
**includes it in the response even when non-empty** — completion is
allowed with gaps (network conditions can permanently prevent a chunk
from arriving), but the gap is never hidden. **The Flutter app and the
Control Room must both respect and surface `missing_chunk_numbers`**, not
assume a completed recording is automatically whole.

---

## J. Recording Cancellation

```
POST /recordings/{recording_id}/cancel
Authorization: Bearer <token>
```
No body. Only legal from `status == "recording"`. Use this when the
constable manually stops an in-progress recording that should not be
treated as a finished, reviewable session (as opposed to `/complete`,
which is the normal end-of-recording path).

---

## K. Recording Manifest

```
GET /recordings/{recording_id}/chunks
```
Returns chunks **always ordered by `chunk_number`**, regardless of actual
upload arrival order, plus `missing_chunk_numbers` (gaps within
`[1, highest_chunk_number]` only — a chunk not yet uploaded beyond the
current highest is never falsely flagged) and `is_complete`.

**This is explicitly NOT a continuous live video stream.** The backend
provides an ordered set of discrete chunk files with metadata; the
Control Room inspects the recording as a timeline of individual chunks,
not a real-time video feed.

---

## L. WebSocket

```
GET /ws/control_room?token=<JWT>
```
(Path name is historical — every role, including `constable`, connects
here; room membership is derived server-side from the JWT, never
client-selected.)

- **Authentication happens before the connection is accepted** — an
  invalid/expired/malformed token results in immediate closure (code
  `4401`). There is no separate post-connect auth handshake.
- **Reconnection/backoff is entirely CLIENT RESPONSIBILITY** — the
  backend has no server-initiated reconnection assistance beyond normal
  WebSocket semantics. The web frontend's own `useOpsSocket.js` hook uses
  exponential backoff on disconnect as a reference implementation
  pattern.
- **Ping/ack**: send the literal text `"ping"`; the server responds with
  `{"event": "ack", "timestamp": "...", "data": {}}`. Verified directly
  against a live connection.
- Envelope for every other message:
  ```json
  { "event": "<name>", "timestamp": "<ISO8601>", "data": { ... } }
  ```

### Events (confirmed directly from `app/services/events.py` — every publisher function that exists, nothing added)

| Event | Emitted when | Recipients | Payload fields (from `_*_summary()` helpers) |
|---|---|---|---|
| `device.registered` | Device register/re-register succeeds | control_room, station | `device_id`, `constable_id`, `device_identifier`, `status` |
| `device.heartbeat` | Every heartbeat call | control_room, station | same, `status` = effective status at that moment |
| `device.online` / `device.stale` / `device.offline` | Effective status genuinely changes (not on every heartbeat) | control_room, station | same + `previous_status` |
| `battery.updated` | Every battery report (standalone or via heartbeat) | control_room, station | `battery_percent`, `is_charging` |
| `battery.warning` / `battery.critical` | A battery-threshold alert is created or escalated (never on every reading — deduplicated) | control_room, station, **and the owning constable's own connection** | `alert_id`, `device_id`, `constable_id`, `battery_percent`, `threshold`, `severity`, `status` |
| `recording.started` | `POST /recordings/start` succeeds | control_room, station, **owning constable's own connection** | `recording_session_id`, `constable_id`, `device_id`, `status`, `trigger_type` |
| `recording.chunk_uploaded` | Each successful chunk upload | same three | same + `chunk_number`, `is_last_chunk` |
| `recording.completed` | `/complete` succeeds | same three | same + `missing_chunk_numbers` |
| `recording.cancelled` | `/cancel` succeeds | same three | same |
| `recording.failed` | Defined publisher exists; **nothing currently calls it** | same three | same + optional `reason` |
| `recording.device_offline` | A device with an active recording is observed offline | control_room, station, alert's constable | alert summary incl. last-known location if any exists (never fabricated) |
| `command.sent` | A command is issued (created+sent atomically) | control_room, station, **target constable's own connection — this is what the app must act on** | `command_id`, `device_id`, `command_type`, `status` |
| `command.acknowledged` | App calls `POST /commands/{id}/ack` | same three | same |
| `command.executed` / `command.failed` | App calls `POST /commands/{id}/result` | same three | same + `failure_reason` if failed |
| `command.cancelled` | Control Room cancels a pending/sent command | same three | same |
| `alert.created` / `alert.updated` / `alert.resolved` | Any alert lifecycle transition (battery or device-health) | control_room, station, alert's constable if set | `alert_id`, `device_id`, `constable_id`, `type`, `severity`, `status`, `message` |

A constable's own connection **never** receives another constable's
events — enforced server-side by room membership, not client filtering.

---

## M. Remote Commands

```
GET /devices/{device_id}/commands        (own device only, for polling on reconnect)
POST /commands/{command_id}/ack          (no body)
POST /commands/{command_id}/result       ({ "success": true } or { "success": false, "failure_reason": "..." })
```

States: `pending` → `sent` → `acknowledged` → `executed` | `failed`, or
`pending`/`sent` → `cancelled`. `timeout` is a defined value but nothing
currently transitions a command into it.

**`sent` != `executed`.** The app receives `command.sent` (via WebSocket
or by polling `GET /devices/{id}/commands` after reconnecting) and must:
1. Call `/ack` the moment it genuinely receives/processes the command.
2. **Actually perform the action** (e.g. genuinely start recording).
3. Only then call `/result` with `success: true`.

**The Flutter app must never call `/result` with `success: true` unless
the action genuinely happened.** The Control Room treats `executed` as
ground truth, not as "the command was merely delivered."

Duplicate `/ack` calls return `409` — safe to ignore/treat as already-handled, never retry indefinitely.

---

## N. Security

- **HTTPS is required for any real deployment** (JWTs and passwords are sent in plaintext over the wire otherwise) — this repository's dev setup uses plain HTTP locally only.
- WebSocket auth: token passed as a query parameter (`?token=`), validated before accept — see §L.
- Device ownership, constable isolation, station isolation: all enforced server-side on every device/recording/command/alert endpoint — a constable can only ever act on their own device's data; the app does not need to (and cannot) bypass this by any client-side means.
- Command authorization: only admin/control_room/station roles can **issue** commands; a constable can only **ack/result** commands targeting their own device.
- Upload validation: MIME content-sniffed (not trusted from declared type), 500MB size cap, path-traversal-safe server-generated storage keys — never derived from client-supplied filenames.
- **Local token storage recommendation:** use Android's `EncryptedSharedPreferences` (or Flutter's `flutter_secure_storage` package, which wraps platform keystore APIs) — never plain `SharedPreferences` for the access token.
- **Never log:** the access token, password, or any request/response body containing them. Chunk file bytes and full request bodies should also be excluded from verbose/debug logs in release builds.

---

## O. Offline/Network Failure Behavior

| Scenario | Responsibility | Behavior |
|---|---|---|
| Internet disappears while recording | **CLIENT** | Continue recording locally; queue chunks for upload; do not stop recording just because upload is failing |
| Internet returns | **CLIENT** | Resume uploading queued chunks in any order (backend tolerates out-of-order arrival) |
| A chunk upload fails | **CLIENT** | Retry the same `chunk_number` (see §H); a `409` on retry means it already succeeded — treat as success |
| Heartbeat fails | **CLIENT** | Retry on the next scheduled interval; no special backend-side handling exists for a missed heartbeat beyond the device's effective status eventually degrading to `stale`/`offline` (**BACKEND** computes this passively — see §D) |
| WebSocket disconnects | **CLIENT** | Reconnect with backoff (§L); while disconnected, the app is NOT receiving `command.sent` — poll `GET /devices/{id}/commands` after reconnecting to catch anything missed |
| Application restarts mid-recording | **CLIENT** | Persist the active `recording_id` and last successfully-uploaded `chunk_number` locally so recording/upload can resume after restart; the backend has no concept of "resuming" beyond simply accepting further chunk uploads to the same still-`recording`-status session |
| Device battery becomes critical | **BACKEND** generates the alert automatically from reported battery percentage (§E); **CLIENT** has no required action beyond continuing to report accurately |

---

## P. Android-Specific Requirements (implementation guidance, not part of this repository)

| Requirement | Type |
|---|---|
| Volume-button double-press detection | **ANDROID IMPLEMENTATION REQUIREMENT** — no backend involvement; once detected, call `POST /recordings/start` with `trigger_type: "emergency_button"` |
| Background recording | **ANDROID IMPLEMENTATION REQUIREMENT** |
| Foreground service (required for reliable background recording/upload on modern Android) | **ANDROID IMPLEMENTATION REQUIREMENT** |
| Microphone permission | **ANDROID IMPLEMENTATION REQUIREMENT** |
| Camera permission | **ANDROID IMPLEMENTATION REQUIREMENT** |
| Location permission (background location for continuous reporting) | **ANDROID IMPLEMENTATION REQUIREMENT** |
| Notification permission (for the foreground service notification) | **ANDROID IMPLEMENTATION REQUIREMENT** |
| Battery optimization exemption (so the OS doesn't kill the recording process) | **ANDROID IMPLEMENTATION REQUIREMENT** |
| Network reconnection handling | **ANDROID IMPLEMENTATION REQUIREMENT** (backend has no role beyond accepting requests whenever they arrive) |
| Secure local token storage | **ANDROID IMPLEMENTATION REQUIREMENT** — see §N |
| Recording recovery after app/process restart | **ANDROID IMPLEMENTATION REQUIREMENT** — see §O |

The corresponding **BACKEND API REQUIREMENT** for all of the above is
simply: the endpoints in §C–§M already exist, are stable, and do not need
to change to support any of this — the work is entirely client-side.
