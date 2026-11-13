# ResQ API

Base URL: `http://localhost:5000/api`

All successful responses are wrapped in `{ "data": ... }`. Errors use `{ "error": { "message": "...", "details": ... } }`. JSON request bodies are limited to 100 KB. Authentication uses an HTTP-only `resq_token` JWT cookie; the API also accepts a Bearer token for non-browser clients. The cookie is `SameSite=Lax`, and CORS is restricted to `CORS_ORIGINS`.

## Roles

| Role | Access |
| --- | --- |
| `user` | Own contacts and SOS requests; available fleet units and vehicles assigned to the user's active SOS |
| `driver` | Vehicles assigned to that driver; status updates for assigned SOS; real location updates for their non-demo vehicles |
| `operator` | Fleet, nearby search, SOS dispatch/status, and operational Socket.IO room |
| `admin` | Operator access plus user/analytics endpoints and demo simulator controls |

Registration always creates a `user`; clients cannot assign their own role. Password hashes are excluded from API responses.

## Authentication

### `POST /auth/register`

```json
{ "name": "Alex Smith", "email": "alex@example.com", "password": "at-least-8-characters", "phone": "+91 90000 00000" }
```

Returns `201` and sets the session cookie.

### `POST /auth/login`

```json
{ "email": "alex@example.com", "password": "..." }
```

Returns the safe user profile and sets the session cookie.

### `GET /auth/me`

Returns the signed-in user. Requires authentication.

### `GET /auth/session`

Returns `{ "user": null }` when signed out or the safe user profile when the session is valid. Invalid/expired cookies are cleared. Used by the browser to restore sessions without treating an anonymous visit as an API error.

### `PATCH /auth/me`

Updates `name` and/or `phone` for the signed-in account.

### `PATCH /auth/password`

Requires `{ "currentPassword": "...", "newPassword": "at-least-8-characters" }`. The current password is verified before the password hash is changed.

### `POST /auth/logout`

Clears the session cookie.

## Vehicles

All vehicle routes require authentication unless otherwise noted. Vehicle `type` is `ambulance`, `fire_truck`, or `police`; `currentLocation` is GeoJSON Point in MongoDB and is returned as `lat`/`lng`.

| Method and path | Access | Behavior |
| --- | --- | --- |
| `GET /vehicles` | Authenticated | Returns only vehicles visible to the caller |
| `GET /vehicles/:vehicleId` | Authenticated | Gets one visible vehicle |
| `GET /vehicles/nearby?lat=28.67&lng=77.45&radiusKm=10&type=ambulance` | Operator/admin | Lists available vehicles with straight-line `distanceKm`; this is not an ETA |
| `GET /vehicles/simulation` | Operator/admin | Gets demo simulator status |
| `POST /vehicles` | Operator/admin | Adds a vehicle using `{ "vehicleId", "type", "driverName", "operatorId", "location": { "lat", "lng" } }` |
| `PATCH /vehicles/:vehicleId` | Operator/admin | Updates the service type and crew label; blocked while an SOS is assigned |
| `PATCH /vehicles/:vehicleId/status` | Operator/admin | Changes status |
| `POST /vehicles/:vehicleId/location` | Assigned driver, non-demo vehicle only | Reports `{ "location": { "lat", "lng" }, "speed": 0 }` |
| `DELETE /vehicles/:vehicleId` | Operator/admin | Removes an unassigned vehicle |

## SOS

| Method and path | Access | Behavior |
| --- | --- | --- |
| `POST /sos` | Authenticated | Creates an SOS, derives priority, and assigns the nearest eligible available vehicle |
| `GET /sos` | Authenticated | Own records for users; all records for dispatch roles |
| `GET /sos/active` | Authenticated | Non-resolved records in the caller's scope |
| `GET /sos/:sosId` | Owner, dispatcher, or assigned driver | Gets an authorized SOS |
| `PATCH /sos/:sosId/status` | Dispatcher or assigned driver | Applies a valid status transition |
| `POST /sos/:sosId/assign` | Operator/admin | Assigns a compatible available vehicle with `{ "vehicleId": "AMB-102" }` |

Create request example:

```json
{
  "emergencyType": "medical",
  "description": "Person needs help near the north entrance",
  "locationLabel": "North entrance, sample clinic",
  "location": { "lat": 28.6702, "lng": 77.4524 },
  "reportedFor": "other",
  "personName": "Jordan Friend",
  "personRelationship": "Friend",
  "alertContactIds": ["65a000000000000000000001"]
}
```

Emergency types: `medical`, `fire`, `accident`, `personal_safety`, `other`. `reportedFor` defaults to `self`; when it is `other`, `personName` is required and `personRelationship` is optional. `location` must contain the selected latitude and longitude; `locationLabel` is an optional address or landmark. The map pin can be placed by clicking or dragging, and current-device location is opt-in. Priorities are server-derived. SOS status transitions are constrained to `pending` → `assigned` → `responding` → `resolved`; a pending request may also be resolved. If no eligible vehicle is available, the SOS remains pending.

Selected contacts are scoped to the SOS owner's account. Alerts are recorded only for selected contacts, and recorded consent controls whether the alert status is `created` or `consent_required`. Only in-app demo records/events are produced; no external provider is called.

Each created request is saved to the SOS collection and emits `sosCreated` to the admin, operations, and owning-user rooms. Admins receive the request's beneficiary and chosen location in the live notification. This is not a real emergency call or dispatch.

## Contacts

| Method and path | Access | Behavior |
| --- | --- | --- |
| `GET /contacts` | Owner | Lists active contacts with optional saved location |
| `POST /contacts` | Owner | Creates a contact; `notificationConsent` defaults to false |
| `PATCH /contacts/:contactId` | Owner | Updates contact fields and consent |
| `DELETE /contacts/:contactId` | Owner | Deletes a contact |

Contact locations are optional and only returned to their owning account.

## Admin

Admin-only routes:

- `GET /admin/dashboard` — aggregate counts and recent SOS records.
- `GET /admin/users?page=1&limit=50` — safe user profiles; password hashes are never returned.
- `POST /admin/users` — creates a user, driver, operator, or administrator account. The initial password must be at least 16 characters.
- `PATCH /admin/users/:userId` — updates name, email, phone, and/or role. Administrators cannot change their own role or demote the last administrator.
- `DELETE /admin/users/:userId` — permanently removes an account and its contacts, resolved SOS history, in-app alert records, and AI data. Removal is blocked for the signed-in administrator and for users with active SOS requests; driver assignments are cleared without deleting fleet units.
- `GET /admin/analytics?from=2026-01-01&to=2026-12-31&type=medical&priority=critical&status=resolved` — filtered SOS counts by type/status/priority, vehicle utilization, in-app alert count, and content-free AI activity counts. All filters are optional; date values use `YYYY-MM-DD`.
- `GET /admin/simulation` — simulator state.
- `POST /admin/simulation/start`, `/stop`, `/reset` — controls the server demo simulator.

## AI assistant and nearby resources

These endpoints require authentication. The AI chat endpoint has an additional rate limit. `GEMINI_API_KEY` and `GEMINI_MODEL` are configured only on the backend. Gemini provides general conversation when no references match and generates answers grounded in retrieved references when available. Safety instructions must be supported by retrieved knowledge; without a key, ResQ uses the cited knowledge fallback and cannot generate general-topic replies.

| Method and path | Behavior |
| --- | --- |
| `POST /ai/chat` | Accepts `{ "message": "...", "saveHistory": false }`, retrieves relevant active MongoDB knowledge, and returns `answer`, `citations`, `confidence`, `provider`, `warning`, and emergency-action metadata. Simple greetings receive a brief ResQ-focused response. `provider` is `greeting`, `knowledge_base`, or `gemini`. History saving is opt-in. |
| `GET /ai/conversation` | Returns the signed-in user's saved conversation only. |
| `DELETE /ai/conversation` | Deletes the signed-in user's saved conversation and AI activity metadata. |
| `POST /resources/nearby` | Accepts `{ "lat": 28.67, "lng": 77.45, "radiusKm": 10 }`. Returns OpenStreetMap community facility listings and only available fictional demo vehicles. Coordinates are used for the lookup and are not persisted. |

`POST /ai/chat` never sends account data or saved conversation history to Gemini. The system prompt treats the question and retrieved excerpts as untrusted input. General non-safety conversation may use Gemini's general model knowledge; safety and emergency procedures are restricted to retrieved references. Emergency-intent responses do not dispatch or call anyone. Facility data should be independently verified and is not a verified list of operating services.

If Gemini fails, the response includes a knowledge-base fallback and a safe diagnostic warning. API-key/access, model configuration, quota, timeout/network, and provider-service failures are distinguished without exposing the key, request text, or upstream error body. The server logs only a sanitized failure code.

The knowledge-only fallback works when Gemini is not configured or unavailable. For relevant source-cited answers, seed documents first with `npm run seed:knowledge`.

## Socket.IO

The Socket.IO endpoint is `/socket.io`. Browser clients authenticate using the HTTP-only session cookie; non-browser clients may pass a JWT in the Socket.IO `auth.token` field.

Client events:

- `joinTrackingRoom` — `{ "type": "admin" | "operations" }`, `{ "type": "sos", "id": "SOS-..." }`, or `{ "type": "vehicle", "id": "AMB-101" }`. Room access is checked against role, SOS ownership, and vehicle assignment.
- `leaveTrackingRoom` — leaves an SOS or vehicle room.
- `vehicleLocationUpdate` — `{ "vehicleId", "location": { "lat", "lng" }, "speed" }`; accepted only for an authenticated driver assigned to a non-demo vehicle. The server simulator is the only writer for demo vehicle locations.

Server events:

- `fleetUpdated` — notifies clients to reload the role-scoped fleet list after a fleet change.
- `vehicleLocationUpdated`
- `sosCreated`
- `sosUpdated`
- `vehicleAssigned`
- `emergencyNotification`
- `vehicleStatusChanged`
- `sosResolved`
- `socketError` for rejected events without an acknowledgement callback

Every connection is authenticated and automatically joins its own `user:<id>` room and the fleet dashboard room. `fleetUpdated` carries no record data; clients reload `GET /vehicles` to apply their role-specific visibility. Available vehicle location updates are broadcast to authenticated fleet dashboards, while unavailable fleet locations remain limited to admins/operators, assigned drivers, and users assigned to the SOS. Admin, operations, SOS, and vehicle rooms require explicit authorization. Location history is persisted by the API/simulator and is retained for up to 30 days.
