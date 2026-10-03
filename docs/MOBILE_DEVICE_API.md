# Mobile Device API Contract

This document describes the exact backend API contract for the future
Android/Flutter body-camera application. **Every field, endpoint, and
behavior described here was extracted directly from the live OpenAPI
schema and backend source code (`backend/app/`) at the time of writing —
nothing here is invented or assumed.**

Base URL: `VITE_API_URL` in the web dashboard's `.env` (e.g.
`http://localhost:8000` in local development). All endpoints below are
relative to this base URL.

---

## 1. Authentication

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

Every other request in this document must include:
```
Authorization: Bearer <access_token>
```

Failure responses: `401` (wrong credentials — generic message, does not
reveal whether the account exists), `429` (rate-limited after repeated
failures for the same username — retry later).

The token has no refresh-token mechanism. There is no logout endpoint —
the client simply discards the token.

---

## 2. Device Registration

```
POST /devices/register
Authorization: Bearer <token>   (constable role only)
Content-Type: application/json

{
  "device_identifier": "<unique string, e.g. Android ID>",
  "platform": "android",
  "app_version": "1.0.0",
  "device_model": "Pixel 7"
}
```

- `device_identifier` is required, 1–255 characters, must be **globally
  unique**. Re-registering the same `device_identifier` from the same
  constable's account is idempotent (updates metadata, does not error).
  Registering a `device_identifier` already claimed by a **different**
  constable returns `403`.
- `platform`/`app_version`/`device_model` are all optional.

Response `200`: a `DeviceResponse` (see §4). Call this once per app
install/first-run.

---

## 3. Heartbeat

```
POST /devices/heartbeat
Authorization: Bearer <token>
Content-Type: application/json

{
  "device_identifier": "<must match a device already registered by this constable>",
  "battery_percent": 0-100,       // optional
  "is_charging": true             // optional
}
```

- Call periodically (e.g. every 30–60s) while the app is running.
- Idempotent — safe to call repeatedly.
- `404` if the device was never registered. `403` if it belongs to a
  different constable.
- **Does not clear an active `recording` status** — if the device is
  currently recording, heartbeat calls do not interrupt that state.

---

## 4. Battery Reporting

```
POST /devices/battery
Authorization: Bearer <token>
Content-Type: application/json

{
  "device_identifier": "<...>",
  "battery_percent": 0-100,       // required, integer
  "is_charging": true             // optional
}
```

Response `200`: a `BatteryReadingResponse`:
```json
{ "id": "...", "device_id": "...", "battery_percent": 42, "is_charging": false, "recorded_at": "2026-01-01T00:00:00Z" }
```

Every reading is stored (append-only history) — this is separate from
`GET /devices/{id}`'s `battery_percent` field, which always reflects the
*latest* reading. Crossing a configured warning/critical threshold
automatically creates or updates an `Alert` and publishes a WebSocket
event (`battery.warning` / `battery.critical`) — no separate call needed.

---

## 5. Location Reporting

Location is **not** part of the heartbeat/battery payloads. It reuses the
existing constable self-service endpoint:

```
POST /constables/me/location
Authorization: Bearer <token>
Content-Type: application/json

{ "latitude": -90..90, "longitude": -180..180, "accuracy": 0+ }   // accuracy optional
```

The latest location is then reflected in `GET /devices/{id}`'s
`latitude`/`longitude`/`location_updated_at` fields.

---

## 6. Device Response Shape

`GET /devices/{id}` and the register/heartbeat responses all return:

```json
{
  "id": "uuid", "constable_id": "uuid|null", "device_identifier": "string",
  "platform": "string|null", "app_version": "string|null", "device_model": "string|null",
  "status": "online|stale|offline|recording",
  "last_heartbeat_at": "datetime|null", "last_seen_at": "datetime|null",
  "created_at": "datetime", "updated_at": "datetime|null",
  "battery_percent": "int|null", "is_charging": "bool|null",
  "latitude": "float|null", "longitude": "float|null", "location_updated_at": "datetime|null"
}
```

`status` is computed by the backend from `last_seen_at` and configurable
thresholds (`device_stale_seconds`, `device_offline_seconds`) — the app
never needs to compute or report this itself.

---

## 7. Starting an Emergency Recording

```
POST /recordings/start
Authorization: Bearer <token>
Content-Type: application/json

{
  "device_identifier": "<must be this constable's own, already-registered device>",
  "trigger_type": "emergency_button" | "manual" | "remote",
  "incident_id": "uuid"   // optional -- omit entirely for the normal volume-button flow
}
```

Call this the moment the volume-button double-press is detected. No
`incident_id` is required or expected for the standard emergency-button
flow — recordings exist completely independently of incidents.

Response `200`: a `RecordingSessionResponse`:
```json
{
  "id": "uuid", "constable_id": "uuid", "device_id": "uuid",
  "trigger_type": "emergency_button", "status": "recording",
  "started_at": "datetime", "ended_at": null, "incident_id": null,
  "created_at": "datetime", "chunk_count": 0, "highest_chunk_number": null,
  "missing_chunk_numbers": []
}
```

The device's own `status` field (see §6) becomes `"recording"` immediately.

---

## 8. Uploading Chunks

```
POST /recordings/{recording_id}/chunks
Authorization: Bearer <token>
Content-Type: multipart/form-data

chunk_number: <integer, starting at 1>
duration_seconds: <float>          (optional)
is_last_chunk: "true" | "false"
file: <binary video/audio file>
```

**Do not wait for the full recording before uploading.** Upload each
chunk as soon as it's ready, while recording continues.

- `chunk_number` starts at **1**, not 0.
- **Out-of-order upload is fully supported** — upload chunks 3, 1, 5, 2, 4
  in any order; the server preserves and correctly reports the true
  numeric order regardless of arrival sequence.
- **Duplicate `chunk_number` is rejected** with `409` — if a chunk upload
  is retried after a network failure but the server actually received it,
  re-sending the same `chunk_number` will fail cleanly with `409` (the
  original chunk is preserved, not overwritten or duplicated).
- Set `is_last_chunk: true` on the final chunk. This does **not**
  automatically complete the recording — you must still call `/complete`
  (§10) explicitly.

**Allowed MIME types** (auto-detected from file content, not trusted from
the client's declared `Content-Type` alone):
`video/mp4`, `video/webm`, `video/quicktime`, `audio/mpeg`, `audio/wav`,
`audio/mp4`, `image/jpeg`, `image/png`.

**Maximum chunk size: 500 MB.**

Response `200`: a `VideoChunkResponse`:
```json
{
  "id": "uuid", "recording_session_id": "uuid", "chunk_number": 3,
  "file_size": 1048576, "duration_seconds": 2.0,
  "file_hash": "<sha256 hex>", "mime_type": "video/mp4",
  "is_last_chunk": false, "upload_status": "uploaded", "created_at": "datetime"
}
```
`409` on invalid transition (recording not in `recording` status) or
duplicate `chunk_number`. `403` if this isn't your own recording.

---

## 9. Missing Chunk Detection

```
GET /recordings/{recording_id}/chunks
```

Response: a `RecordingManifestResponse`, chunks always ordered by
`chunk_number` (never by upload order):
```json
{
  "recording_session_id": "uuid", "status": "recording",
  "chunks": [ /* VideoChunkResponse[], numerically ordered */ ],
  "highest_chunk_number": 5,
  "missing_chunk_numbers": [3],
  "is_complete": false
}
```

`missing_chunk_numbers` reports gaps **within** what's been received so
far (`[1, highest_chunk_number]`) — a chunk not yet uploaded beyond the
current highest is never falsely flagged as missing.

---

## 10. Completing / Cancelling a Recording

```
POST /recordings/{recording_id}/complete
POST /recordings/{recording_id}/cancel
```

Both: no request body. Only legal from `status == "recording"` — calling
either on an already-completed/cancelled recording returns `409`.

**Completion is allowed even with missing chunks** (network conditions
can permanently prevent a chunk from arriving) — the response's
`missing_chunk_numbers` always reports the true gap, never hides it.

After either call, the device automatically returns to its normal
(non-`recording`) status.

---

## 11. WebSocket Connection

```
GET /ws/control_room?token=<JWT>
```

(The path name `control_room` is historical — every role, including
`constable`, connects here. The server derives room membership from the
JWT server-side; the client never selects a room.)

Connect with a standard WebSocket client, passing the JWT as a query
parameter (browsers/mobile HTTP clients cannot set custom headers on the
WebSocket handshake, hence the query param). Authentication happens
**before** the connection is accepted — an invalid/expired/malformed
token gets the connection closed immediately (code `4401`).

### Event envelope

Every message (except the client's own `ping` → `ack` keep-alive) has this shape:
```json
{ "event": "recording.chunk_uploaded", "timestamp": "2026-01-01T00:00:00Z", "data": { ... } }
```

### Events a constable's own connection receives

| Event | When |
|---|---|
| `device.registered`, `device.heartbeat`, `device.online`, `device.stale`, `device.offline` | Own device state changes |
| `battery.updated`, `battery.warning`, `battery.critical` | Own battery reports |
| `recording.started`, `recording.chunk_uploaded`, `recording.completed`, `recording.cancelled`, `recording.failed` | Own recording lifecycle |
| `command.sent` | **A remote command was issued to this device — the app must act on it.** |
| `command.acknowledged`, `command.executed`, `command.failed` | Own command lifecycle (echoed back) |
| `alert.created`, `alert.updated`, `alert.resolved` | Alerts concerning this constable's own device |

A constable's connection **never** receives another constable's events —
this is enforced server-side, not by client-side filtering.

---

## 12. Remote Commands

The Control Room can issue commands to a device. The app must poll or
listen via WebSocket, then respond:

### Discovering pending commands
```
GET /devices/{device_id}/commands   (own device only)
```
Returns a list of `RemoteCommandResponse` (see below) for that device,
newest first — use this to catch up on commands issued while the app was
offline.

### Command payload (received via `command.sent` WebSocket event or the GET above)
```json
{
  "id": "uuid", "device_id": "uuid", "issued_by": "uuid",
  "command_type": "start_recording" | "stop_recording",
  "status": "pending|sent|acknowledged|executed|failed|timeout|cancelled",
  "created_at": "datetime", "sent_at": "datetime|null",
  "acknowledged_at": "datetime|null", "executed_at": "datetime|null",
  "failure_reason": "string|null"
}
```

### Acknowledging receipt
```
POST /commands/{command_id}/ack
```
No body. Call this the moment the app receives/processes the command.
Only legal from `status == "sent"` — `409` if already acknowledged
(prevents a duplicate ack from corrupting state; safe to retry-and-ignore
a 409 here).

### Reporting the result
```
POST /commands/{command_id}/result
Content-Type: application/json

{ "success": true }
```
or
```json
{ "success": false, "failure_reason": "Camera permission denied" }
```
Only legal from `status == "acknowledged"`. Transitions to `executed` or
`failed` accordingly.

**The app must genuinely execute the command (e.g. actually start
recording) before reporting `success: true`.** The Control Room UI treats
`executed` as ground truth, not as "the API call succeeded."

---

## 13. Error Responses

| Status | Meaning |
|---|---|
| `401` | Missing/invalid/expired token |
| `403` | Authenticated but not authorized for this specific resource (wrong device, wrong constable, wrong role) |
| `404` | Resource genuinely does not exist |
| `409` | Valid request, but conflicts with current state (invalid transition, duplicate chunk) |
| `413` | Uploaded chunk exceeds 500 MB |
| `422` | Request body/field validation failure (e.g. `battery_percent` out of 0–100 range) |
| `429` | Login rate-limited |

All error bodies follow FastAPI's standard shape: `{"detail": "..."}` (string) or `{"detail": [{"loc": [...], "msg": "...", "type": "..."}]}` (422 validation errors).

---

## 14. What Is NOT Yet Implemented

Documented honestly, not silently omitted:
- No offline-queue/retry-with-backoff guidance beyond "duplicate chunk_number is safely rejected" — the app is responsible for its own retry logic.
- `command_type` currently supports only `start_recording`/`stop_recording` — no other remote commands exist yet.
- No push-notification channel exists outside the WebSocket connection — if the app is fully closed (not backgrounded), it will not receive `command.sent` until it reconnects and calls `GET /devices/{id}/commands`.
