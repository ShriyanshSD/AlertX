# ResQ deployment checklist

ResQ is a demonstration project, not an emergency dispatch service. Deploying it does not make demo fleet records or OpenStreetMap facility data operationally verified.

## 1. Configure services

- Create a MongoDB Atlas database and a dedicated application user. The Socket.IO Mongo adapter uses change streams, so the database must be an Atlas replica set (the standard Atlas deployment type). Allow Vercel's outbound connections in Atlas Network Access; without that, the API function cannot start.
- Import this repository into Vercel with the repository root as the project root. The included `vercel.json` rewrites `/api/*` to the shared Node function and keeps React Router routes on the SPA.
- Leave `VITE_API_URL` and `VITE_SOCKET_URL` unset for this all-Vercel deployment. The frontend uses same-origin `/api` requests and `/api/server/socket.io` WebSockets. If either variable was added for an older external API, remove it and redeploy. `VITE_SOCKET_PATH` is optional and normally unset.
- Set `CORS_ORIGINS` to the exact HTTPS production frontend origin, without a trailing slash. Vercel's generated `VERCEL_URL` is allowed automatically for preview deployments; add a custom production domain explicitly.
- Production authentication uses secure `HttpOnly`, `SameSite=Lax` cookies. Keeping the frontend and API on the same Vercel origin avoids cross-site cookie issues. Do not change to `SameSite=None` without adding and reviewing CSRF protections.

## 2. Configure backend environment

In Vercel Project Settings → Environment Variables, set the backend values for Production and any Preview environments where needed. Do not commit a populated `.env` file.

- `MONGODB_URI` to the Atlas connection string.
- `JWT_SECRET` to a unique random value of at least 32 characters. Generate it locally with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"`.
- `CORS_ORIGINS` to the exact HTTPS production frontend origin.
- `COOKIE_SECURE=true`.
- `DEMO_MODE=true` for a college demonstration. Demo SOS assignment is constrained to demo vehicles.
- Optionally set `GEMINI_API_KEY` and `GEMINI_MODEL` for server-side AI responses. Never put the key in a `VITE_*` variable.

Never use the test database for deployment. `npm test` drops the isolated `resq_phase2_test` database configured by the test file.

## 3. Seed and run

1. Install the locked project dependencies with `npm ci`.
2. To seed only the assistant knowledge base, run `npm run seed:knowledge` with the production database environment configured. This idempotently upserts the documented knowledge records.
3. Use `npm run seed` only when intentionally creating the four environment-configured demo accounts, vehicles, SOS records, and contacts.
4. For local backend development, run `npm start`. For Vercel, push the changes and deploy the repository; Vercel builds the Vite frontend and discovers `api/server.js` as the shared API/WebSocket function.
5. After setting environment variables, redeploy and check `https://<your-domain>/api/health`. It should return JSON, not the SPA HTML.
6. Log in and verify Socket.IO from the browser. The client uses WebSocket transport and reconnects/resubscribes when Vercel closes a connection at the function duration limit.

## 4. Operational checks

- Verify `GET /api/health` returns JSON, then test login, an authenticated API request, and a Socket.IO connection.
- Check that HTTPS cookies are `HttpOnly`, `Secure`, and `SameSite=Lax`.
- Confirm the browser connects to `/api/server/socket.io`; do not enable wildcard credentialed CORS.
- Configure Vercel Firewall rate limits for public API routes. The Express rate limiter is process-local and does not share counters between serverless instances.
- The demo simulator stores its running state in MongoDB and coordinates ticks with a database lease. Vehicle movement runs while an authenticated Socket.IO connection is active; reconnecting clients reload and resubscribe.
- The MongoDB Socket.IO adapter shares events between function instances and expires adapter events after five minutes. MongoDB change streams must be available.
- Monitor API, database, Gemini, and Overpass failures without logging authorization headers, API keys, chat text, or precise location coordinates.
- Gemini is optional; when unavailable, the assistant uses relevant cited documents or reports that no reliable knowledge-base result was found.
- OpenStreetMap Overpass is an external community service with availability and usage limits. The application shows a fallback message if it cannot be reached.
- Back up the database according to the host's policy and provide a deletion process for account-owned personal data.

## 5. Scope and privacy limits

- This demo does not place emergency calls, dispatch real vehicles, or send SMS/email.
- Nearby facility records are community contributed and may be outdated; ResQ does not verify operating status.
- Nearby assistance location is requested only after a user action and sent to the backend and Overpass for that lookup. It is not stored in the user's account or sent to Gemini.
- Saved AI conversations are opt-in and user-scoped. AI activity analytics contain category/provider metadata, not message content.
- Stress check-in responses are local page state only and are not a diagnosis.
