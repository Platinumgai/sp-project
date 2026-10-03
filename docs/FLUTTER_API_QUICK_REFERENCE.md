# Flutter API Quick Reference

Every row confirmed directly against the live OpenAPI schema
(`docs/openapi_snapshot_head_6b1f4a9d3e72.json`, 52 paths total). Only
mobile-relevant endpoints are listed — admin/control-room-only endpoints
(station management, audit logs, incident dispatch, settings, alert
listing, global recordings/commands listing) are omitted; see
`docs/MOBILE_DEVICE_API.md` / `docs/FLUTTER_API_HANDOFF.md` for full
detail on each row below.

| METHOD | PATH | PURPOSE | AUTH | MOBILE USE |
|---|---|---|---|---|
| POST | `/auth/login` | Obtain a JWT access token | None (public) | On every app launch / login screen |
| GET | `/auth/me` | Fetch the current authenticated user's own profile | Bearer, any role | Optional — confirm token validity / get user info |
| POST | `/devices/register` | Register (or re-claim) this install's device | Bearer, constable only | Once per install / first run |
| POST | `/devices/heartbeat` | Report liveness + optionally battery | Bearer, constable only (own device) | Periodically while app is active (~30–60s) |
| POST | `/devices/battery` | Report battery percentage/charging state | Bearer, constable only (own device) | Periodically, or on significant change |
| GET | `/devices/{device_id}` | Fetch a device's current state | Bearer, own device (constable) or elevated roles | Optional — confirm own device's server-side status |
| POST | `/constables/me/location` | Report current GPS location | Bearer, any authenticated role | Periodically while operating |
| POST | `/recordings/start` | Begin a new recording session | Bearer, constable only (own device) | On emergency-button press or manual start |
| POST | `/recordings/{recording_id}/chunks` | Upload one video/audio chunk | Bearer, constable only (own recording) | Continuously while recording, one call per chunk |
| GET | `/recordings/{recording_id}/chunks` | Fetch the ordered chunk manifest | Bearer, own recording or elevated roles | Optional — verify upload completeness client-side |
| GET | `/recordings/{recording_id}` | Fetch recording session status/metadata | Bearer, own recording or elevated roles | Optional — check current session state |
| POST | `/recordings/{recording_id}/complete` | Mark a recording finished | Bearer, constable only (own recording) | When recording genuinely ends |
| POST | `/recordings/{recording_id}/cancel` | Abort a recording | Bearer, constable only (own recording) | When the constable manually stops without a valid completion |
| GET | `/devices/{device_id}/commands` | List commands issued to this device | Bearer, own device (constable) or elevated roles | On reconnect, to catch missed `command.sent` events |
| POST | `/commands/{command_id}/ack` | Acknowledge receipt of a command | Bearer, constable only (own device's command) | Immediately upon receiving `command.sent` |
| POST | `/commands/{command_id}/result` | Report command execution outcome | Bearer, constable only (own device's command) | After genuinely executing (or failing to execute) the command |
| WS | `/ws/control_room?token=<JWT>` | Real-time event stream | JWT via query param | Persistent connection while app is active; receive `command.sent`, own device/battery/recording/alert events |

## Not relevant to the Flutter app (Control Room / admin only)

`GET /devices/`, `GET /alerts/`, `GET /recordings/` (global list), `GET /commands/` (global list), `GET /audit-logs/`, `/police-stations/*`, `/constables/` (roster), `/settings/*`, `/incidents/*`, `/media/*` — these exist for the web Control Room dashboard, not the mobile client.
