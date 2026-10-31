# Full-Stack Implementation Plan — Restaurant Table Reservation & Queue Management System

## 1. Mission and scope

Implement a complete, working full-stack website for a Restaurant Table Reservation & Queue Management System (RTRQMS) using the MERN stack:

- MongoDB — database
- Express.js — backend API framework
- React + Vite — frontend
- Node.js — server runtime

Use the existing website/project in the current workspace as the starting point. Inspect the repository before editing. Preserve and improve the existing UI rather than replacing it with an unrelated template.

The implementation must contain exactly these three functional modules:

1. User Authentication & Registration
2. Reservation Management
3. Walk-in Queue Management

Do not add separate product modules such as payments, restaurant analytics, reviews, menus, or a full admin dashboard. Small shared UI components and supporting backend utilities are allowed when required by the three modules.

## 2. Visual reference and design direction

The supplied screenshots are references for aesthetics and layout only. They are not a request to reproduce their exact text or brand.

Preserve this visual direction throughout the site:

- Premium, understated restaurant aesthetic.
- Near-black / charcoal page backgrounds.
- Warm, muted gold accents and fine gold borders.
- Large editorial serif headings paired with clean sans-serif body text.
- Generous whitespace and clear visual hierarchy.
- High-quality restaurant photography with dark overlays where appropriate.
- Thin, low-contrast dividers and restrained hover transitions.
- Minimal outlined or gold-filled call-to-action buttons.
- Responsive layouts that remain usable on mobile, tablet, and desktop.
- Forms should use dark input backgrounds, readable labels, visible focus states, validation messages, and accessible contrast.

Suggested design tokens (adjust carefully to match the existing code):
- Background: #100F0D or similar near-black.
- Surface: #171511.
- Primary text: warm ivory such as #F1E7D5.
- Accent: muted gold such as #CDA15D.
- Secondary text: warm gray.
- Borders: subtle dark gold/charcoal.
- Headings: an editorial serif such as Playfair Display or a similar available font.
- Body: a readable sans-serif such as DM Sans or a similar available font.

Keep the existing Maison / restaurant-themed identity if present in the repository. Do not introduce a new visual identity without a clear reason. Avoid excessive animations, bright gradients, generic dashboard styling, and unnecessary cards.

## 3. Required working behaviour

The result must be genuinely full stack, not a frontend-only mockup. Forms must call backend APIs, data must persist in MongoDB, and the UI must display actual API responses. Do not use hardcoded fake booking IDs, fake queue positions, fake success states, or local arrays as the source of truth.

### Module A — User Authentication & Registration

Implement:
- Registration with name, email, and password; add confirmation password if useful for the UI.
- Login using email and password.
- Logout.
- Persistent authentication across page refreshes.
- Protected routes for authenticated-user features.
- Clear loading, validation, success, and error states.
- Duplicate-email prevention.
- Secure password hashing using bcrypt or bcryptjs. Never store plaintext passwords.
- Authentication using a signed JWT. Prefer a secure, HttpOnly cookie for browser authentication; configure cookie security and CORS correctly for local development and production. If bearer tokens are chosen instead, explain the security trade-off and do not store long-lived tokens in localStorage without a strong reason.
- Backend authentication middleware and a `/api/auth/me` endpoint to restore the current user.
- Never return password hashes in API responses.
- Validate and normalize email addresses and trim user-entered names.
- Do not expose whether an account exists in a way that creates unnecessary security risk.

Suggested endpoints:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Module B — Reservation Management

Implement:
- Authenticated users can create a reservation.
- Form fields: date, time, number of guests, and optional special request/note.
- Show available time slots or available tables for the requested date/time and party size.
- View the current user's reservations.
- Cancel an eligible reservation.
- Show clear statuses such as Confirmed and Cancelled.
- Enforce date/time validation on the server; do not accept past reservations.
- Prevent overlapping or duplicate reservations from taking the same table/time.
- Respect table capacity and the selected party size.
- Do not mark a booking confirmed until the backend has successfully validated and persisted it.
- Handle two users trying to reserve the same table at nearly the same time. Use a safe database strategy and re-check availability at booking time; document any concurrency limitations.
- If the starter project already has a suitable table/availability UI, retain it and connect it to real API data.

Data model guidance:
- Reservation: user reference, reservation date/time, party size, optional note, status, assigned table (or table identifier), timestamps.
- Table: table number/name, capacity, active status. Seed a modest set of sample tables through a seed script if the project needs them. Make seeded/demo data clearly documented.
- If table management is not a separate user-facing module, keep it as supporting data and backend logic only.

Suggested endpoints:
- `GET /api/reservations/availability?date=...&time=...&guests=...`
- `POST /api/reservations`
- `GET /api/reservations/mine`
- `GET /api/reservations/:id`
- `PATCH /api/reservations/:id/cancel`

Authorization rules:
- A user can only view or cancel their own reservation.
- Validate IDs and all request fields.
- Avoid exposing other users' personal data.
- Cancelled reservations must no longer block availability.

### Module C — Walk-in Queue Management

Implement:
- Authenticated users can join the walk-in queue.
- Collect party size and any essential contact detail only if it is not already available on the user's account.
- Generate a unique queue number or code on the server.
- Show the user's queue entry, position, status, and estimated wait.
- Let users view their active and recent queue entries.
- Prevent accidental duplicate active queue entries for the same user unless the prior entry is completed/cancelled.
- Provide a safe queue status transition mechanism. At minimum support Waiting, Called/Ready, Seated, and Cancelled/Left.
- The queue position and estimated wait must be calculated from persisted active queue entries and a documented configurable estimate, not hardcoded per user.
- Recalculate position and estimated wait when queue state changes.
- Include a minimal, access-controlled way for the queue to advance. Do not create a separate full admin dashboard. This can be a small protected staff-only/dev workflow if needed, but document the access model and never allow arbitrary public users to alter other users' queue records.
- If no staff role is implemented, keep user actions limited to joining/viewing/leaving their own queue entry and clearly document how queue advancement is managed in the initial version.

Suggested endpoints:
- `POST /api/queue`
- `GET /api/queue/mine`
- `GET /api/queue/:id`
- `PATCH /api/queue/:id/leave`
- Add a protected queue-advance endpoint only if a legitimate authorized role/workflow is implemented.

Data model guidance:
- QueueEntry: user reference, queue code, party size, status, joined time, optional seated/cancelled time, timestamps.
- Use a stable ordering such as joined time plus a unique tie-breaker.
- Define the wait-time estimate clearly (for example, configurable average minutes per party ahead). Make it clear that it is an estimate, not a guarantee.

## 4. Frontend pages and navigation

Keep the current visual reference and implement a cohesive flow. Minimum pages/views:

1. Landing page
   - Brand/navigation
   - Hero with restaurant photography, headline, short supporting copy
   - Primary action to book a table
   - Secondary action to join the walk-in queue
   - Intro/experience section
   - Reservation entry section or clear navigation to it

2. Register page
3. Login page
4. Reservation page/section
   - Availability results and reservation form
   - Reservation confirmation based on API response
   - My reservations list and cancellation action
5. Walk-in queue page/section
   - Join queue form
   - Active queue status, number, position, and estimated wait
   - Leave queue action

Shared UI:
- Navigation with correct signed-in/signed-out state.
- Reusable buttons, fields, status labels, loading indicators, empty states, confirmation prompts, and error messages.
- A clear account/logout action when signed in.
- Do not display links that do nothing.
- Every visible primary action must work.
- Add responsive navigation for small screens.
- Use semantic HTML and accessible labels/focus states.

## 5. Recommended project structure

Adapt to the existing repository instead of blindly recreating it. A reasonable structure is:

```text
project-root/
  client/
    src/
      components/
      pages/
      layouts/
      context/ or hooks/
      services/
      styles/
      App.jsx
      main.jsx
    package.json
    .env.example
  server/
    src/
      config/
      controllers/
      middleware/
      models/
      routes/
      services/
      utils/
      app.js
      server.js
    scripts/
      seed.js
    package.json
    .env.example
  README.md
  .gitignore
```

If the current project already has a Vite frontend at the root, it is acceptable to keep that layout and add a `server/` directory. Avoid moving files unless necessary.

Use clear separation between routes, controllers, models, middleware, and service/business logic. Keep components focused and reusable. Use consistent naming and avoid overengineering.

## 6. Backend and database requirements

- Use Express with JSON parsing, sensible request-size limits, and centralized error handling.
- Use Mongoose models and validation.
- Connect to MongoDB using an environment variable; never hardcode credentials.
- Provide `.env.example` files with placeholder values only.
- Add `.env` to `.gitignore`.
- Use a health endpoint such as `GET /api/health`.
- Configure CORS for the actual local frontend origin and credentials if cookie auth is used.
- Use security middleware such as Helmet and reasonable rate limiting, especially on authentication endpoints.
- Validate request data with a consistent approach (for example, Zod, Joi, or express-validator).
- Return consistent JSON responses and appropriate HTTP status codes.
- Do not swallow errors or report success when a database/API operation failed.
- Use database indexes where appropriate, especially unique email and queue code, and indexes that support availability and queue ordering.
- Ensure all asynchronous errors are handled.
- Add a seed script for the supporting table data if needed; make it safe to run and document whether it resets existing data.
- Do not commit secrets or production credentials.

## 7. Security and correctness checklist

- Passwords are hashed with bcrypt/bcryptjs.
- Secrets and database URIs come from environment variables.
- JWT validation is performed on protected endpoints.
- Cookie/CORS configuration works locally and is documented for deployment.
- Backend authorization checks ownership for reservations and queue entries.
- Inputs are validated server-side, not just in React.
- Database errors do not leak secrets or stack traces to the client.
- Login/register endpoints are rate-limited.
- Avoid NoSQL injection by validating inputs and never passing arbitrary client query objects directly to Mongoose.
- Prevent duplicate active queue entries.
- Re-check availability during reservation creation.
- Use safe, predictable status transitions.
- Do not claim a booking/queue entry was created until MongoDB confirms it.
- Add basic tests for critical authentication, reservation, and queue logic.

## 8. Environment configuration and running locally

Provide a complete `README.md` with exact setup instructions for Windows and VS Code.

Document:
- Required versions/prerequisites for Node.js and MongoDB.
- How to install dependencies in the client and server.
- How to create local `.env` files from `.env.example`.
- Example variable names, such as `PORT`, `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`, `NODE_ENV`, and cookie settings if required.
- How to seed supporting table data.
- How to run the backend and frontend in two VS Code terminals.
- How to verify the health endpoint.
- How to test registration, login, booking, cancellation, joining the queue, and leaving the queue.
- Common fixes for MongoDB connection failures, CORS errors, port conflicts, and missing environment variables.
- Do not include real secrets in README examples.

Use npm scripts such as `dev`, `start`, `build`, `lint` (if configured), `seed`, and `test` where appropriate. If useful, add a root-level script to run client and server together, but retain the ability to run them independently.

## 9. Testing and acceptance criteria

Do not consider the project complete just because it compiles or looks good. Verify all of the following:

### Authentication
- A new user can register successfully.
- Duplicate email is rejected with a useful message.
- Invalid fields are rejected.
- Password is hashed in MongoDB.
- A user can log in and access protected pages.
- Refreshing the page restores the signed-in state appropriately.
- Logout invalidates the client session/cookie.
- Unauthenticated API requests to protected endpoints are rejected.

### Reservations
- Availability changes according to existing confirmed reservations and table capacity.
- A valid booking is stored in MongoDB and appears in the user's reservation list.
- Invalid/past bookings are rejected.
- Two conflicting bookings cannot both reserve the same table and time.
- A user cannot view or cancel another user's reservation.
- Cancellation updates status and releases the slot.
- UI loading, empty, success, and error states are all tested.

### Walk-in queue
- Joining creates a persistent queue entry with a unique queue code.
- The queue position reflects persisted active entries and ordering.
- Estimated wait follows the documented formula.
- A user cannot create duplicate active entries.
- A user can view and leave their own queue entry.
- Cancelled/left/seated entries no longer count as waiting parties.
- A user cannot modify someone else's queue entry.
- Queue state updates are reflected in the UI after refresh.

### UI and project quality
- The visual aesthetic matches the screenshots.
- All three modules share one consistent design system.
- Layout is responsive and usable on desktop/mobile.
- No visible buttons or links are dead.
- No fake success data remains.
- No critical console errors or failed API requests.
- Frontend production build succeeds.
- Backend starts successfully and connects to MongoDB when correctly configured.
- Automated tests cover important business rules.
- README instructions have been followed from a clean setup as far as the available environment permits.

## 10. Agent workflow and plan logging

Work in small, verifiable phases. Maintain this `plan.md` as the source of truth and update it throughout implementation.

At the start:
1. Inspect the entire repository structure, package files, current routes/components/styles, and existing functionality.
2. Identify what is already implemented and what is missing.
3. Record the starting state in a `Progress Log` section at the bottom of this file.
4. Do not overwrite the current UI before understanding it.

Suggested phases:
- Phase 0: Repository inspection and implementation plan confirmation.
- Phase 1: Frontend structure and design-system refinement.
- Phase 2: MongoDB/Mongoose setup and Express server skeleton.
- Phase 3: Authentication and protected frontend routes.
- Phase 4: Reservation data model, availability logic, APIs, and UI integration.
- Phase 5: Walk-in queue model, queue logic, APIs, and UI integration.
- Phase 6: Security, validation, responsive polish, and error handling.
- Phase 7: Automated tests, manual end-to-end verification, and bug fixes.
- Phase 8: README, environment examples, seed script, and final handoff.

For each phase:
1. Inspect the relevant files before editing.
2. Make a small, coherent set of changes.
3. Run the relevant checks/tests.
4. Fix failures before moving forward.
5. Update this file with completed work, commands run, results, unresolved issues, and the next step.
6. Do not mark a task complete unless there is evidence it works.

Progress Log format:

```text
## Progress Log

### Phase 0 — Repository inspection
- Status: Not started
- Files inspected:
- Findings:
- Commands/tests run:
- Results:
- Issues/blockers:
- Next step:

### Phase 1 — Frontend and design
- Status: Not started
- Files changed:
- Commands/tests run:
- Results:
- Issues/blockers:
- Next step:
```

Add a similar entry for every phase. Keep completed entries as historical records; append new updates rather than erasing useful history.

If another AI agent is used as a critic/reviewer, ask it to inspect the diff, test authorization and validation, look for race conditions in availability/queue logic, check secret handling, and report concrete file/line evidence. Fix confirmed issues and log the result here.

## 11. Constraints

- Do not stop after producing a plan or a visual prototype. Implement the working application.
- Do not replace the project with a new unrelated template.
- Do not add modules beyond the three defined above.
- Do not silently remove existing useful features without explaining why.
- Do not fabricate test results or claim commands passed if they were not run.
- If a command cannot be run due to missing tools/services, record the exact blocker and provide the command the developer should run.
- If a required choice is unclear, inspect the existing project first; choose a sensible default when safe and record the decision instead of repeatedly asking the user.
- Avoid committing generated secrets, `.env` files, `node_modules`, build outputs, or local database files.
- Keep the code understandable for a student developer who will need to explain it during a project demo/viva.

## 12. Final handoff

When finished, provide:
- A concise summary of the three working modules.
- Final folder structure.
- Exact commands to install and run the app in VS Code on Windows.
- Required environment variables and MongoDB setup steps.
- Tests run and their actual outcomes.
- Any known limitations that remain.
- A short demo checklist for presenting the project.

The final result must be a coherent, runnable MERN application with persistent MongoDB data and a frontend matching the supplied dark, gold, editorial restaurant aesthetic.

## Progress Log

### Phase 0 — Repository inspection
- Status: Not started
- Files inspected: Not yet inspected by the implementation agent.
- Findings: Pending repository inspection.
- Commands/tests run: None.
- Results: Not started.
- Issues/blockers: None recorded.
- Next step: Inspect the existing project and record the current architecture before changing files.
