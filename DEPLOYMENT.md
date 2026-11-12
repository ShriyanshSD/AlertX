# ResQ deployment checklist

ResQ is a demonstration project, not an emergency dispatch service. Deploying it does not make demo fleet records or OpenStreetMap facility data operationally verified.

## 1. Configure services

- Provision MongoDB and create a dedicated application database/user. Restrict network access to the application host.
- Deploy the Node API on a host that supports long-lived HTTP connections and WebSocket upgrades for Socket.IO.
- Deploy the Vite frontend to Vercel using the included `vercel.json`.
- Use Node.js 22.x for the Vercel build; the project dependencies require Node.js 20.19 or newer.
- Vercel Functions now support WebSockets in public beta, but this API is currently started as a long-lived server and its simulator and Socket.IO room broadcasts are process-local. This project is not yet adapted for Vercel's function lifecycle or cross-instance fan-out, so keep the API on a persistent Node host for this deployment. A Vercel API migration would need function entry points, simulator lifecycle changes, and shared Socket.IO pub/sub.
- In Vercel Project Settings → Environment Variables, set `VITE_API_URL` to the API base URL ending in `/api` (for example, `https://api.example.com/api`) and `VITE_SOCKET_URL` to the API origin (for example, `https://api.example.com`). These values are public build-time URLs, not secrets. Set them for each Vercel environment and redeploy after changing them.
- Set the API host's `CORS_ORIGINS` to the exact HTTPS frontend origin. Keep the frontend and API on the same site, preferably with custom domains such as `app.example.com` and `api.example.com`. The API uses `HttpOnly`, `SameSite=Lax` cookies; unrelated default domains such as `*.vercel.app` and `*.onrender.com` are cross-site, so browser authentication cookies may not be sent. Do not switch to `SameSite=None` without adding and reviewing CSRF protections.
- Vercel preview URLs are distinct origins. Add only the exact preview origins you intend to use to `CORS_ORIGINS`, and use a same-site custom preview domain if you need authenticated preview deployments.

## 2. Configure backend environment

Set environment variables in the hosting provider's secret manager; do not commit a populated `.env` file.

- `NODE_ENV=production`
- `PORT` to the port assigned by the host.
- `MONGODB_URI` to the production database connection string.
- `JWT_SECRET` to a unique random value of at least 32 characters. Generate it locally with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"`.
- `CORS_ORIGINS` to the exact HTTPS frontend origin(s), without a trailing slash.
- `COOKIE_SECURE=true` when serving over HTTPS (the production default).
- Optionally set `GEMINI_API_KEY` and `GEMINI_MODEL` for server-side AI responses. Keep the key out of `VITE_*` variables.
- Keep demo mode enabled only for demonstrations. Do not mix demo and real fleet data; demo SOS assignment is constrained to demo vehicles.

Never use the test database for deployment. `npm test` drops the isolated `resq_phase2_test` database configured by the test file.

## 3. Seed and run

1. Install the locked project dependencies with `npm ci`.
2. To seed only the assistant knowledge base, run `npm run seed:knowledge` with the production database environment configured. This idempotently upserts the documented knowledge records.
3. Use `npm run seed` only when intentionally creating the four environment-configured demo accounts, vehicles, SOS records, and contacts.
4. Start the API with `npm start`.
5. For Vercel, import the Git repository, keep the project root at the repository root, and use the included Vite build/output settings. The SPA rewrite serves `index.html` for React Router routes. Configure the two `VITE_*` URLs before deploying.
6. For a non-Vercel frontend host, build with `npm run build` and serve `dist/` with SPA history fallback enabled.
7. Route `/api/*` and `/socket.io/*` to the API only when using a same-origin reverse proxy. Preserve WebSocket upgrade headers for Socket.IO.

## 4. Operational checks

- Verify `GET /api/health`, login, an authenticated API request, and a Socket.IO connection.
- Check that HTTPS cookies are `HttpOnly`, `Secure`, and `SameSite=Lax`.
- Confirm the browser can reach the configured API and Socket.IO endpoints; do not enable wildcard credentialed CORS.
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
