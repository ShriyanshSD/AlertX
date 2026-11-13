# ResQ — AI-Powered Emergency Response Demo

ResQ is a college minor project for a smart emergency response and live tracking system. It combines a React/Vite dashboard with an Express/MongoDB API, authenticated Socket.IO updates, demo GPS simulation, source-grounded emergency guidance, an opt-in nearby-resource lookup, and a private stress check-in.

> **Demo only:** ResQ does not contact emergency services or dispatch a vehicle in the real world. Vehicle locations and demo accounts are fictional. OpenStreetMap facility data is community-mapped and may be incomplete or out of date. Do not rely on this application during a real emergency.

## Requirements

- Node.js 20.19 or newer
- npm
- MongoDB 7 or newer (local or hosted)

## Install

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` before starting the API:

- Set `JWT_SECRET` to a new random value of at least 32 characters.
- Replace every `DEMO_*_PASSWORD` placeholder with a unique password of at least 12 characters.
- Set `MONGODB_URI` to the MongoDB database to use.
- Keep `DEMO_MODE=true` for the fictional Ghaziabad demo fleet.
- `GEMINI_API_KEY` is optional. Add a Google AI Studio Gemini API key to enable natural general chat and grounded generated responses; the key stays on the server. Without it, source-backed questions use the cited knowledge-base fallback, but open-ended general chat cannot be generated.
- `GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`.

To generate a secret with Node:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
```

Seed demo users, vehicles, SOS records, and trusted contacts:

```powershell
npm run seed
```

The seeder requires all four environment-configured demo accounts (`admin`, `operator`, `driver`, and `user`). It never sets a production password in source code.

Seed only the emergency knowledge documents (safe to re-run; upserts by slug):

```powershell
npm run seed:knowledge
```

Knowledge documents are stored in MongoDB. Retrieval initially uses keyword matching; no user chat text is included in analytics. The assistant only saves conversation messages when the user explicitly enables conversation saving. Clearing a conversation also clears that user's AI activity metadata.

## Run locally

Start the API and frontend in separate terminals:

```powershell
npm run server
npm run dev
```

The API listens on `http://localhost:5000`; Vite proxies `/api` and `/socket.io` to it. Open the Vite URL shown in the frontend terminal. If the API is unavailable, the browser-only Phase 1 demo remains available; authentication and server data require the API.

For a frontend-only production build:

```powershell
npm run build
npm run preview
```

## Test

With MongoDB running and reachable at `MONGODB_URI`:

```powershell
npm test
```

The integration suite uses the isolated `resq_phase2_test` database and drops that database when it finishes. It tests authentication and role checks, contact privacy and consent, nearest-vehicle assignment, admin APIs, driver location authorization, authenticated sockets, bounded demo GPS movement, and Phase 3 API behavior. Unit tests cover RAG retrieval, Gemini fallback, OpenStreetMap response handling, and stress scoring. A live Gemini request requires a configured key and is not required for the deterministic test suite.

## Routes

| Route | Page |
| --- | --- |
| `/` | Landing page |
| `/login`, `/register` | API-backed authentication |
| `/dashboard` | Response overview, charts, map, and quick SOS |
| `/tracking` | Interactive OpenStreetMap, fleet filters, and GPS feed |
| `/sos` | SOS creation and incident queue |
| `/contacts` | Account-scoped trusted contacts and consent |
| `/assistant` | ResQ AI Assistant with retrieved source citations and optional history |
| `/stress-meter` | Private self-reflection check-in and breathing exercise |
| `/admin` | Admin overview, user list, filtered analytics, and AI activity counts |
| `/vehicles` | Fleet management |
| `/history` | Emergency history and CSV export |
| `/settings` | Profile, preferences, and sign out |

## Demo and privacy behavior

- The seed dataset uses fictional Ghaziabad coordinates, IDs, contacts, and SOS records from Phase 1.
- The server simulator is off by default. An administrator can start, pause, or reset it from Live tracking. `DEMO_SIMULATOR_AUTOSTART=true` enables it at server startup.
- Demo vehicle positions update every two seconds inside the configured Ghaziabad bounds. Location history is sampled separately and expires after 30 days.
- Admins/operators and assigned drivers can view all operational vehicle locations. User accounts can see currently available fleet locations and vehicles assigned to their own active SOS; unavailable fleet units remain hidden. Nearby-vehicle search remains dispatcher-only.
- Contact records and any optional precise contact locations are only returned to the owning account. Contact notifications require recorded consent and create in-app demo records only.
- Gemini requests contain only the current question and retrieved knowledge excerpts, not account details or previous conversation. For ordinary non-safety topics, Gemini may use its general model knowledge; emergency, medical, and safety instructions remain limited to retrieved references and the assistant refuses to guess when evidence is missing. The API key is server-only. For aggregate admin metrics, the API stores the account ID, topic category, provider, emergency-related flag, and timestamp—not message content; Clear removes this metadata and any saved conversation. When Gemini is unavailable or unconfigured, source-backed questions use cited knowledge and general questions receive a clear availability message.
- Nearby assistance requests browser location only after an explicit user action. The coordinates are sent to the ResQ API and OpenStreetMap Overpass for the lookup; ResQ does not save them to the account or send them to Gemini. Facility records are not verified as operational. Nearby fleet results are fictional demo units only.
- The stress check-in score is transparent, stays in browser memory, and is not a diagnosis or clinically validated assessment. It must not delay emergency assistance.
- Real GPS updates are accepted only from a driver authenticated for the corresponding non-demo vehicle. Demo vehicle coordinates are updated by the server simulator, not client-supplied vehicle IDs.
- `DEMO_MODE` determines whether new SOS and newly registered fleet records are marked as demo. No real-world dispatch, SMS, or email provider is implemented.
- OpenStreetMap tiles are loaded from `tile.openstreetmap.org` and require an internet connection.

## Project structure

```text
server/
  config/       Environment and MongoDB connection
  controllers/  Auth, vehicle, SOS, contact, and admin handlers
  data/         Fictional Ghaziabad seed data
  middleware/   Authentication, authorization, validation, and errors
  models/       Mongoose schemas and geospatial indexes
  routes/       REST API routers
  seed/         Environment-configured demo seeder
  services/     Assignment, notifications, and GPS simulation
  sockets/      Authenticated Socket.IO rooms and events
  test/         MongoDB-backed API and realtime tests
  server.js     HTTP and Socket.IO startup
src/
  components/   Reusable UI, SOS modal, and Leaflet map components
  context/      Browser auth/session state
  data/         Fictional frontend demo data
  hooks/        Vehicle, SOS, and contact state
  pages/        Landing, auth, dashboard, tracking, and management routes
  services/     API, Socket.IO, GPS simulation, and local storage
  App.jsx       Route definitions
```

See [server/API.md](./server/API.md) for request formats, access rules, and Socket.IO events. See [DEPLOYMENT.md](./DEPLOYMENT.md) for a production deployment checklist and [PHASE3_TESTING.md](./PHASE3_TESTING.md) for the verification report.
