# Feature Plan Addendum --- Restaurant Directory and Restaurant-Specific Admin Login

## Purpose

Extend the existing RTRQM MERN application so customers can browse
multiple restaurants displayed as small, attractive cards/windows,
select a restaurant, and then make reservations or join the walk-in
queue for that specific restaurant. Add a secure restaurant-specific
admin/staff login so each restaurant can manage only its own tables,
reservations, and walk-in queue.

This is an addendum to the existing `plan.md`. Inspect the current code
and data model before implementation. Preserve the current Maison dark
charcoal, warm gold, editorial serif visual style.

## Scope

Keep the customer-facing functionality centered on: 1. User
Authentication & Registration 2. Reservation Management 3. Walk-in Queue
Management

Restaurant selection is part of the reservation/queue experience, not a
separate unrelated module. Add a restaurant-specific staff/admin access
mode to operate those existing modules. Do not add payments, reviews,
menus, analytics dashboards, or unrelated features.

## 1. Customer restaurant directory

-   Add an "Explore restaurants" or "Find a restaurant" section.
-   Show restaurants in a responsive grid of compact cards/windows
    rather than one large restaurant-only form.
-   Desktop: 3 cards per row where space allows; tablet: 2; mobile: 1.
-   Each card should show a restaurant cover image, name, short
    description or cuisine/type, area/location, and a "View restaurant"
    or "Book a table" action.
-   Use subtle borders, dark surfaces, restrained gold hover/focus
    treatment, consistent image aspect ratios, and generous spacing.
    Keep the supplied screenshots as aesthetic references only.
-   Populate cards from the backend and MongoDB, not a hardcoded array
    as the final data source.
-   Add loading, error, and empty states.
-   Seed a few clearly identified fictional demo restaurants so the
    directory is usable. Do not imply demo restaurants are real
    businesses.
-   Selecting a card opens a detail view or focused booking page with
    "Reserve a table" and "Join walk-in queue" actions.
-   Keep the selected restaurant context visible throughout booking and
    queue flows. All availability, tables, reservations, and queue
    entries must be scoped to that restaurant.

Suggested public endpoints: - `GET /api/restaurants` -
`GET /api/restaurants/:restaurantId` - Restaurant-scoped availability
endpoint, or adapt the existing availability endpoint to require a
restaurant ID.

Public restaurant responses must not expose credentials or private staff
information.

## 2. Restaurant-specific admin/staff login

### Authentication and roles

-   Keep customer registration/login.
-   Add a protected staff sign-in path such as `/staff/login`, clearly
    separate from customer sign-in.
-   Add validated roles such as `customer`, `restaurant_admin`, and
    optionally `restaurant_staff`.
-   Every staff/admin account must be associated with a specific
    `restaurantId`.
-   Never allow public customer registration to self-assign a
    staff/admin role.
-   Create demo staff/admin accounts only through a documented seed
    script or protected setup process. Never hardcode production
    passwords.
-   Reuse the current authentication design where appropriate. Hash
    passwords using bcrypt/bcryptjs; keep secrets in environment
    variables.
-   Backend middleware must check both role and restaurant ownership for
    every staff request. Hiding UI controls is not security.
-   Do not add a global super-admin unless explicitly needed;
    restaurant-scoped admins are sufficient.

### Minimal staff workspace

The staff area should support only operations needed by the existing
modules: - View reservations for the admin's own restaurant, including
date/time, party size, assigned table, status, and customer details
necessary for service. - Confirm or cancel reservations where allowed by
business rules. - View walk-in queue entries for their own restaurant in
queue order. - Advance queue status using valid transitions,
e.g. `Waiting -> Called/Ready -> Seated`, and
`Waiting -> Cancelled/Left`. - View table capacity and availability for
their restaurant. - Log out and show loading, empty, error, and
confirmation states. - Do not build a broad analytics dashboard.

Suggested staff endpoints, adapted to current routes as appropriate: -
`POST /api/auth/staff/login` (or safely extend the existing login
endpoint) - `GET /api/staff/me` - `GET /api/staff/reservations` -
`PATCH /api/staff/reservations/:reservationId/status` -
`GET /api/staff/queue` - `PATCH /api/staff/queue/:queueEntryId/status` -
`GET /api/staff/tables`

Every staff endpoint must require authentication, a staff/admin role,
and restaurant scoping.

## 3. MongoDB data model changes

Inspect existing Mongoose models and extend them with minimal
disruption. Do not blindly replace existing schemas.

### Restaurant

Suggested fields: `name`, unique `slug`, `description`, `coverImage`,
`cuisine` or `category`, `location`/`area`, optional `openingHours`,
`isActive`, timestamps.

### User

-   Keep existing customer fields and password hashing.
-   Add a validated role if missing.
-   Add `restaurantId` for staff/admin accounts; require it for those
    roles.
-   Do not accept role or restaurant assignment from an untrusted public
    registration request.

### Table

-   Add/retain `restaurantId`.
-   Table number/name should be unique within a restaurant.
-   Keep capacity and active/availability fields.

### Reservation

-   Add/retain `restaurantId` in addition to the user reference.
-   Verify any assigned table belongs to the same restaurant.
-   Availability must only consider reservations for the selected
    restaurant.
-   Re-check availability on the server before creating a reservation.
-   Cancelled reservations must not block availability.

### QueueEntry

-   Add/retain `restaurantId`.
-   Generate queue codes safely and uniquely within the chosen scope.
-   Calculate position only from active entries for the same restaurant.
-   Queue estimates must not mix entries across restaurants.
-   Use stable ordering such as `joinedAt` plus a unique tie-breaker.

Add suitable indexes for unique restaurant slugs and restaurant-scoped
table, queue, and availability queries.

## 4. Seed data and demo accounts

-   Update the seed script to seed several fictional demo restaurants
    with different names, descriptions, cuisine labels, locations, cover
    images, and tables.
-   Keep existing reservations and user data unless a reset is
    explicitly documented. Never silently delete user data.
-   Make repeated seeding idempotent where practical, such as upserting
    by a stable slug.
-   Create demo staff accounts only if needed for local testing. Do not
    commit real secrets or plaintext production passwords.
-   Prefer environment variables for demo passwords, with placeholders
    documented in `.env.example`; alternatively generate a one-time
    local-development credential and document it.
-   Document how to sign in as a demo restaurant admin.

## 5. User flows

Customer: 1. Open the landing page. 2. Browse restaurant cards. 3.
Select a restaurant. 4. Choose reservation or walk-in queue. 5. Submit
the request. 6. View status scoped to that restaurant.

Restaurant staff: 1. Open "Restaurant staff" or "Restaurant admin sign
in". 2. Sign in with assigned credentials. 3. View only their
restaurant's reservations, tables, and queue. 4. Update permitted
reservation/queue statuses. 5. Sign out.

Use the same Maison design system across public and staff pages, but
keep the staff workspace practical and readable.

## 6. Acceptance criteria

### Restaurant directory

-   Restaurant cards come from MongoDB via the API.
-   Grid is responsive and card actions work.
-   Selected restaurant stays associated with reservation and queue
    requests.
-   API failures and empty lists show clear messages.
-   No hardcoded final restaurant list is used as the source of truth.

### Security and isolation

-   Customers cannot self-register as staff/admin.
-   Staff must authenticate before accessing staff pages and APIs.
-   Admin A cannot list, view, or modify Admin B's restaurant
    reservations, queue, or tables.
-   Backend enforces restaurant ownership even if the client tampers
    with IDs.
-   Availability and queue position are calculated per restaurant.
-   Queue status changes obey allowed transitions.
-   Passwords remain hashed and secrets stay in `.env`.

### Regression

-   Existing customer registration/login continues to work.
-   Reservation creation, listing, cancellation, and persistence
    continue to work.
-   Walk-in join, status display, leave action, and persistence continue
    to work.
-   Frontend production build succeeds.
-   Backend tests pass where runnable.
-   README documents setup, seed data, demo credentials, and
    customer/staff flows.
-   Do not claim success unless tested.

## 7. Agent workflow

1.  Read the existing `plan.md`, this addendum, README, Mongoose models,
    routes, middleware, seed script, and React pages before editing.
2.  Record a short impact analysis and identify schema/API compatibility
    risks.
3.  Implement in phases:
    -   A: restaurant model, seed data, public listing API.
    -   B: responsive restaurant-card grid and selected-restaurant flow.
    -   C: restaurant-scoped reservation/queue APIs and regression
        tests.
    -   D: roles, staff login, restaurant-scoped authorization.
    -   E: minimal staff operations for reservations and queue status.
    -   F: integration tests, responsive polish, README, progress log.
4.  After each phase, run relevant tests/build and record actual
    commands/results in `plan.md`.
5.  Preserve existing data. Use safe, repeatable migration/seed
    approaches.
6.  Have a critic review authorization bypasses, cross-restaurant data
    leakage, reservation race conditions, and queue state transitions.
7.  Final handoff must state what was implemented, how to run it, demo
    account setup, actual tests run, and remaining limitations.

## 8. Progress log template

Append progress entries to the existing `plan.md` instead of replacing
history:

``` text
### Feature addendum — Restaurant directory and restaurant-specific staff login
- Status:
- Files inspected:
- Files changed:
- API/data model changes:
- Tests/build commands:
- Actual results:
- Security review:
- Known issues:
- Next step:
```
