# Maison — Restaurant Table Reservation & Queue Management

Maison is a MERN application for restaurant discovery, customer authentication, reservations, and walk-in queues, with a restaurant-scoped staff workspace. It uses a responsive charcoal-and-gold restaurant aesthetic.

## Requirements

- Node.js 20 or newer and npm.
- MongoDB 6 or newer, running locally or available through a MongoDB connection string. A local Windows MongoDB Community installation is optional if you use MongoDB Atlas.
- VS Code (optional).

## Install on Windows

Open the project folder in VS Code. In a PowerShell terminal:

```powershell
cd server
npm install
Copy-Item .env.example .env
```

Edit `server\.env`. Set `MONGODB_URI` to a working MongoDB instance and replace `JWT_SECRET` with a private random string of at least 32 characters. Do not commit `.env`.

In a second PowerShell terminal:

```powershell
cd client
npm install
Copy-Item .env.example .env
```

The default client URL (`http://localhost:5173`) and API URL (`http://localhost:4000/api`) are configured for local development. If you change either, keep `CLIENT_ORIGIN` in `server\.env` and `VITE_API_URL` in `client\.env` in sync.

## Start the application

Start MongoDB first. For a local MongoDB installation, make sure its service is running. Then, from the project root, use two terminals:

```powershell
cd server
npm run seed
npm run dev
```

```powershell
cd client
npm run dev
```

Open `http://localhost:5173`. Verify the API with `Invoke-RestMethod http://localhost:4000/api/health`; the response should be `{"status":"ok"}`.

The seed command upserts seven restaurant directory records and 42 sample dining tables with capacities from two to eight. The four existing Mumbai restaurant choices remain available; three additional fictional demo venues are clearly labelled as demos and use fictional locations. Records created before restaurants were added are assigned to The Table during seeding so they remain visible and continue to block their existing tables. Seeding does not clear reservations or remove other user/table records. To provision three demo restaurant admins locally, set `DEMO_ADMIN_PASSWORD` in `server\.env` to a private password of at least 12 characters before running the seed command. Never use demo credentials in production.

## Environment variables

See `server/.env.example` and `client/.env.example`.

| Variable | Purpose |
| --- | --- |
| `PORT` | Express API port (default `4000`) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Private signing secret; at least 32 characters |
| `JWT_EXPIRES_IN` | Signed session lifetime (default `7d`) |
| `CLIENT_ORIGIN` | Exact allowed browser origin (default `http://localhost:5173`) |
| `NODE_ENV` | `development`, `test`, or `production` |
| `COOKIE_SECURE` | Set `true` when serving over HTTPS |
| `QUEUE_MINUTES_PER_PARTY` | Queue wait estimate per party ahead (default `12`) |
| `DEMO_ADMIN_PASSWORD` | Optional local-only password for demo restaurant administrators (minimum 12 characters; never set in production) |
| `VITE_API_URL` | Browser API base URL (default `http://localhost:4000/api`) |

The JWT is held in an HttpOnly, SameSite=Lax cookie and is not exposed to browser JavaScript. Production deployments must use HTTPS and set `COOKIE_SECURE=true`; keep the frontend and API on the same site so the cookie's SameSite policy works. Set a strong, unique JWT secret and restrict `CLIENT_ORIGIN` to the deployed frontend. Public customer registration always creates a customer role; restaurant admin accounts are provisioned only by the local seed process.

## Modules and API

- **Authentication:** `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`. Passwords are bcrypt-hashed. Authentication and ownership are enforced server-side.
- **Restaurant directory:** `GET /api/restaurants` and `GET /api/restaurants/:restaurantId` read active restaurants from MongoDB and return public directory fields only.
- **Reservations:** `GET /api/reservations/availability?restaurantId=the-table&date=YYYY-MM-DD&time=17:00&guests=2`, `POST /api/reservations` (include `restaurantId`), `GET /api/reservations/mine`, `GET /api/reservations/:id`, `PATCH /api/reservations/:id/cancel`.
- **Walk-in queue:** `POST /api/queue` (include `restaurantId`), `GET /api/queue/mine`, `GET /api/queue/:id`, `PATCH /api/queue/:id/leave`. Wait positions are calculated separately for each restaurant.
- **Restaurant staff:** `POST /api/auth/staff/login`; `GET /api/staff/me`, `/api/staff/reservations`, `/api/staff/queue`, `/api/staff/tables`; and status updates through `PATCH /api/staff/reservations/:reservationId/status` and `PATCH /api/staff/queue/:queueEntryId/status`. Every staff request re-reads the user's role and restaurant assignment and derives its data scope from that assignment, not from a client-supplied restaurant ID. Queue transitions are `Waiting -> Called/Left` and `Called -> Seated/Left`.
- **Health:** `GET /api/health`.

Reservation seatings are in 90-minute periods at 17:00, 18:30, and 20:00, interpreted in the server's local timezone. Only future confirmed reservations can be cancelled. A unique partial MongoDB index on the table/date/time of confirmed reservations provides the final concurrency guard. The API rechecks the available tables before inserting and tries the next available table if another booking wins the same slot concurrently. MongoDB's unique index prevents double-booking even during races. Queue positions order active entries by join time and ID; the estimate is `(position - 1) × QUEUE_MINUTES_PER_PARTY`. It is an estimate, not a guarantee.

Staff sign in is available at `/staff/login`. With `DEMO_ADMIN_PASSWORD` configured during seeding, demo administrator emails are `admin+copper-cardamom@demo.maison.local`, `admin+ember-olive@demo.maison.local`, and `admin+saffron-room@demo.maison.local`; each account is assigned only to its corresponding fictional demo restaurant. The seed script hashes the supplied password and refuses to provision these accounts in production. The admin workspace exposes only its own restaurant's reservations, queue, and tables. Staff can cancel confirmed future reservations and advance or remove active queue entries.

## Test the flows

1. Register with a name, email, and password of at least eight characters.
2. Refresh the page to check that the HttpOnly-cookie session is restored; sign out to clear it.
3. Choose a restaurant, future date, seating time, and party size. Availability comes from that restaurant’s active MongoDB tables and persisted confirmed reservations. Confirm a table and check **Reservations**.
4. Cancel the confirmed booking and verify the status becomes Cancelled; its table/time becomes available again.
5. Join the walk-in queue and verify the server-generated code, position, and estimated wait. Refresh to verify persistence, then leave the queue.
6. Use a second account to verify that reservation and queue ownership checks do not expose another guest's records.
7. Set `DEMO_ADMIN_PASSWORD`, re-run `npm run seed`, and sign in at `/staff/login` with one of the demo admin emails. Verify that reservations, queue entries, and tables are limited to that account's restaurant; test calling, seating, removing a queue entry, and cancelling a future reservation.

Automated server logic tests:

```powershell
cd server
npm test
```

Frontend production build:

```powershell
cd client
npm run build
```

These checks do not replace end-to-end tests against a running MongoDB instance. MongoDB-backed authentication, persistence, restaurant seeding, reservation race behavior, and cross-account authorization must be verified with a configured database using the manual steps above.

## Troubleshooting

- **MongoDB connection fails:** Start the local MongoDB service or provide a reachable Atlas URI in `server\.env`. Check credentials, IP allowlisting, and network access.
- **Missing environment variables:** Create each `.env` from its `.env.example`; use a JWT secret of at least 32 characters.
- **CORS errors:** Set `CLIENT_ORIGIN` to the exact browser origin, including protocol and port, and restart the server.
- **Port in use:** Change `PORT` in `server\.env` or the Vite port in `client\vite.config.js`; update `VITE_API_URL` accordingly.
- **No tables available:** Run `npm run seed` in `server` after confirming MongoDB is running.
- **Browser cookie not restored:** Use `localhost` consistently for both local URLs. In production, serve over HTTPS and use same-site frontend/API hosts with `COOKIE_SECURE=true`.
