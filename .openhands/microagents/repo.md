# Lovemeetly Repository Guide

## What this project is

**Lovemeetly** (`react-example` internally) is a full-stack global dating & partner platform. It combines a React (Vite) single-page app, an Express + Socket.IO Node.js backend served from the same process, and a Capacitor Android wrapper. Core features:

- Discovery of "native" members and "external partner" profiles with swipe/grid modes and filters (age, gender, country, city, online status, relationship goal, source).
- Real-time chat with message read receipts and typing indicators.
- WebRTC voice and video calls with Socket.IO signaling.
- Follow/unfollow, block, like, mutual-match, notifications, and public (Facebook-style) profiles with dynamic Open Graph meta injection.
- AI features via the Gemini API (`gemini-2.5-flash`): profile-bio assistant and chat message translation (38+ UI languages).
- Premium subscriptions (crypto checkout) and paid/promo profile "boosts", both settled through NOWPayments, plus free promotional plans.
- Admin portal: member/sub-admin role management, subscription plan management, payment settings, boost packages, legal documents (Terms/Privacy), moderation of user reports, and analytics.

The repository also contains a shared SQLite database generated at runtime (`data/globalmatch.sqlite`, gitignored), a cPanel deployment guide, and a historical MySQL schema file for reference. Recent history includes "security: harden admin auth and hash all password storage" and "Fix WebRTC video call flicker and add repo docs" — the codebase has already had admin-auth hardening and scrypt password hashing applied (see Authentication/Admin auth).

## Frontend technology & structure

- **Stack**: React 19, Vite 6, TypeScript 5.8, Tailwind CSS 4 (via `@tailwindcss/vite`), `motion` (framer-motion), `lucide-react` icons, `canvas-confetti`.
- **Entry**: `index.html` → `src/main.tsx` → `src/App.tsx`. `index.html` contains a CSS-only loading spinner and a fallback loader that fetches `/dist/index.html` if the main module fails (LiteSpeed/CDN resilience). Social preview meta tags are in `index.html`; the server injects per-profile OG meta at request time.
- **Structure**:
  - `src/App.tsx` — root state machine: auth, discovery, matches, conversations, calls, admin routes, all modals.
  - `src/components/` — UI components; `src/components/admin/` — AdminPortal tabs (Members, SubscriptionPlans, Payments, BoostPackages, LegalDocuments, UserSubscriptionModal).
  - `src/services/api.ts` — API client (token storage, `/server-api` rewriting, fallbacks, typed methods). `src/services/socket.ts` — Socket.IO client singleton.
  - `src/lib/` — Firebase client (`firebase.ts`) and Firebase Admin (`firebase-admin.ts`) initialized from `firebase-applet-config.json`.
  - `src/db/` — Drizzle ORM schema (`schema.ts`) for PostgreSQL, connection pool (`index.ts`), Postgres table bootstrap (`migrate.ts`), seed (`seed.ts`), Postgres⇄SQLite sync engine (`sync.ts`), and a Postgres repository (`repository.ts`).
  - `src/i18n/` — 39-language translation system (`LanguageContext.tsx`, `translations.ts`, `locales/{en,asia,europe,mideast_africa}.ts`).
  - `src/data/` — `worldLocations.ts` (location picker), `fallbackProfiles.ts` (demo profiles rendered before/without API data).
  - `src/utils/` — `storage.ts` (safe localStorage), `sound.ts`, `capacitorApp.ts` (Android back button / status bar handling).
  - `src/types/index.ts` — shared TypeScript domain types (User, Profile, Call, SubscriptionPlan, PaymentTransaction, etc.).

## Backend / server technology & structure

- **Stack**: Node.js (>=18, `tsx` for dev), Express 4, Socket.IO 4 (server + client), cors, dotenv, `pg` + Drizzle ORM (Postgres), `sql.js` (SQLite WASM), Nodemailer (SMTP), `@google/genai` (Gemini), `firebase-admin`. No separate backend directory — `server.ts` is the single entry point and hosts both the API and the frontend.
- **Files**:
  - `server.ts` (~4,875 lines) — Express app, auth middleware, all REST routes, admin middleware, Socket.IO signaling, Vite dev-middleware / static serving, dynamic OG meta injection, process-level error resilience.
  - `server/db.ts` — SQLite layer: `SqlHelper` (queryOne/queryAll/execute/follower helpers…), a serialized write queue (`queueWrite`), atomic persistence to `data/globalmatch.sqlite`, and full table definitions.
  - `server/email.ts` — Nodemailer transporter + branded HTML email templates (`sendPasswordResetEmail`, `sendWelcomeEmail`, and other notification emails).
  - `server/password.ts` — Password hashing utilities: scrypt KDF (`hashPassword`/`verifyPassword`/`isHashedPassword`) with constant-time comparison and in-place migration of legacy plaintext values.
  - `server/nowpayments.ts` — NOWPayments client: config resolution from DB/env, invoice creation, HMAC-SHA512 IPN signature verification, payment status polling, min-amount checks, and subscription expiry date calculation.
  - `src/db/repository.ts` — PostgreSQL data-access functions (public profiles, follow/unfollow, search, profile update for the PG side).

## Install dependencies

Both `package-lock.json` (npm) and `bun.lock` exist. Use npm or bun:

```bash
npm install       # or: bun install
```

`npm run lint` runs `tsc --noEmit` for type checking. `npx cap` commands are used for Capacitor.

## Run the development server

```bash
npm run dev
```

- Starts the whole app with `tsx server.ts` on port **3000** (bound to `0.0.0.0`).
- In dev mode the server creates an in-process Vite dev server (`middlewareMode: true`) so API + HMR serve from one origin. HMR/file-watching can be toggled with `DISABLE_HMR=true` (see `vite.config.ts`).
- On startup it initializes the SQLite DB, bootstraps Postgres tables if `DATABASE_URL` is set, seeds sample data if empty, and runs the Postgres⇄SQLite sync, all in the background after listen.
- The backend expects a `.env` file (copy `.env.example`). Without `DATABASE_URL` it falls back to local Postgres env vars (`SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`).
- Phusion Passenger (cPanel) is auto-detected: if `global.PhusionPassenger` exists the HTTP server listens on the `passenger` socket instead of port 3000.

## Build the Web App

```bash
npm run build      # vite build
                   # + cp -r dist/assets . ; esbuild server.ts -> dist/server.cjs (node bundle)
npm run start      # node dist/server.cjs   (NODE_ENV=production / dist presence -> SPA static serving)
npm run preview    # vite preview (static-only preview)
npm run clean      # rm -rf dist server.js
```

The build (1) compiles the React SPA with Vite into `dist/`, (2) copies `dist/assets` to a top-level `assets/` folder (used by the LiteSpeed/cPanel fallback serving), and (3) bundles the TypeScript server into a single CommonJS file `dist/server.cjs` with `esbuild` (`--packages=external` — production deps must be installed on the host). `server.js` is the ESM entry that imports `./dist/server.cjs`; `app.js` just re-exports it. Deployment to cPanel is via Git VCS + Node.js app (startup file `dist/server.cjs`), see `CPANEL_DEPLOY_GUIDE.md` and `.cpanel.yml`.

## Capacitor Android app structure

- **Config**: `capacitor.config.ts` — `appId com.lovemeetly.app`, `appName Lovemeetly`, `webDir dist`, `server.androidScheme https`, `cleartext: true`, `allowMixedContent: true`, `webContentsDebuggingEnabled: true`, splash screen + status bar plugin settings (dark on `#0c0a09`).
- **Android project** lives in `android/` (generated by `npx cap init` / `cap add android`): Gradle root (`build.gradle`, `settings.gradle`, `variables.gradle`, `gradle.properties`), `gradle/`, wrapper scripts, and `android/app/` containing `MainActivity` (plain `BridgeActivity`), `AndroidManifest.xml`, and res assets.
- **Manifest highlights**: permissions for INTERNET, CAMERA, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, POST_NOTIFICATIONS, media reads, VIBRATE; optional camera/mic hardware features; `usesCleartextTraffic="true"`, FileProvider for attachments, `MainActivity` with `singleTask` launcher.
- **`variables.gradle`**: minSdk 24, compile/targetSdk 36, androidx/cordova versions.
- **`capacitor.config.json`** (generated copy under `android/app/src/main/assets/`) mirrors the root config. `capacitor.plugins.json` lists installed plugins (@capacitor/app, splash-screen, status-bar).
- **Android runtime behavior**: `src/utils/capacitorApp.ts` wires the hardware back button (close modal → back → double-press-to-exit) and status bar. `getApiBaseUrl()` detects the native container (`Capacitor.isNativePlatform()` or capacitor://localhost) and points the API at the live `https://lovemeetly.com` backend rather than the bundled origin.
- Capacitor plugins currently in use by the app code: `@capacitor/app`, `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/browser`; `@capacitor/core` provides `Capacitor.isNativePlatform()`. No push-notification/google-services wiring is active (`google-services.json` is only applied if present).

## Build / sync Android

```bash
npm run cap:sync     # npx cap sync android           (copies webDir -> android assets, syncs plugins/deps)
npm run cap:build    # vite build && npx cap sync android
npm run cap:open     # npx cap open android           (opens Android Studio)
```

To build the actual APK/AAB, open the `android/` folder in Android Studio and run Gradle, or `cd android && ./gradlew assembleDebug` (debug) / `./gradlew bundleRelease` (release). Always run `vite build` before `cap sync` so `dist/` contains the latest UI.

## Environment variables

All values in `.env.example`; **`.env` must not be committed** (gitignored). No secrets should be placed in source files.

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Server-side Google Gemini API (`@google/genai`) for AI bio assistant + chat translation + moderation. |
| `APP_URL` | Canonical public base URL (e.g. `https://lovemeetly.com`); used for payment success/cancel/IPN callback URLs and absolute asset links. |
| `DATABASE_URL` | Neon/PostgreSQL connection string (primary persistent store; `sslmode=require`/`neon.tech` enables SSL). |
| `SQL_HOST` / `SQL_USER` / `SQL_PASSWORD` / `SQL_DB_NAME` | Local Postgres fallback when `DATABASE_URL` is unset (also used by `drizzle.config.ts` with `SQL_ADMIN_USER`/`SQL_ADMIN_PASSWORD`). |
| `JWT_SECRET`, `SESSION_SECRET` | Listed legacy auth/session secrets (the active auth uses DB token sessions; see Authentication). |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Listed legacy Stripe placeholders; current payment path is NOWPayments. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth placeholders (Firebase config is in `firebase-applet-config.json`). |
| `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` | S3-compatible storage placeholders. |
| `EXTERNAL_PROVIDER_API_KEY` | External partner-provider integration placeholder. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Nodemailer SMTP for reset codes and notifications. |
| `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, `NOWPAYMENTS_SANDBOX` | NOWPayments gateway credentials (env fallbacks used alongside DB `payment_settings`). |
| `VITE_API_BASE_URL` (frontend) | Optional explicit API base; otherwise auto-detected (same-origin, or `https://lovemeetly.com` inside Capacitor). |
| `DISABLE_HMR` | Build-time/dev flag to disable Vite HMR + file watching. |

> Note: `firebase-applet-config.json` is committed and contains Firebase *public* config values (project `tokyo-well-2dtd0`, web `apiKey`). These are client-safe identifiers by design (Firebase web API keys are not secrets).

## API architecture

- Single Express server on port 3000; JSON body limit 50 MB (attachments are sent as base64 inside JSON).
- CORS fully permissive, with credentials and the following headers allowed: `Content-Type`, `Authorization`, `x-session-token`, `X-Requested-With`.
- **URL rewrite**: `/server-api/*` → `/api/*` to bypass LiteSpeed's `/api` interception on the cPanel host. The client (`api.ts` → `resolveApiUrl`) calls `/server-api/...` primarily and falls back to `/api/...` on 404/502/503.
- **Auth flow**: `POST /api/auth/login` or `/register` return `{ user, profile, token }`. The client stores the token under `globalmatch_auth_token` and sends it as both `Authorization: Bearer <token>` and `x-session-token`. A global middleware resolves the session to `req.user` / `req.profile` for every request; endpoints return 401 when unauthenticated is required. `GET /api/auth/me` returns the current user+profile.
- **Route groups** (all under `server.ts`):
  - Auth: `/api/auth/*` (me, login, register, logout, forgot-password with email OTP + rate limiting, verify-reset-code, reset-password, change-password, sessions).
  - Public & browsing: `/api/discover` (SQL-filtered search with boosted-first ordering), `/api/profiles`, `/api/public-profiles/:id` (Postgres-first via `getPublicProfileById`, then SQLite fallbacks), `/api/users/search` (real members from Postgres).
  - Social: `/api/users/:id/{follow,unfollow,followers,following,block,unblock}`, `/api/users/blocked`, `/api/notifications*`.
  - Profiles/messages: `PUT /api/profiles/me` (with URL/social-link sanitization and username conflict checks), `/api/conversations*`, `/api/messages`, `/api/upload` (base64 attachment stored in SQLite `attachments` table).
  - Calls: `/api/calls`, `/api/calls/:id/accept|reject|end`, `/api/calls/history`.
  - AI: `/api/ai/bio-assistant`, `/api/ai/translate` (Gemini `gemini-2.5-flash`; graceful static fallbacks if no API key).
  - Subscriptions/payments: `/api/subscriptions/plans`, `/api/subscriptions/my-status`, `/api/subscriptions/subscribe-free`, `/api/subscriptions/checkout`, `/api/payments/create-invoice`, `/api/payments/nowpayments-ipn` (webhook), `/api/payments/check-status/:orderId`.
  - Boosts: `/api/boosts/packages`, `/api/boosts/create-invoice`, `/api/boosts/complete-payment`, `/api/boosts/purchase`.
  - External partner provider stubs: `/api/external/providers`, `/sync`, `/api/external/sync-logs`, `/api/external/track-click`.
  - Safety/legal: `/api/reports`, `/api/legal/documents`.
  - Admin (all behind `requireAdmin`/`requirePermission`): `/api/admin/*` — verify-access, my-permissions, members CRUD, subscription plans CRUD, payments list, payments settings (NOWPayments), user subscription assignment + history, boost packages CRUD, legal documents, moderation, analytics.
- `GET /api/health` returns `{ status: 'ok', time }`.
- Static serving: dev → Vite middleware (with profile-URL OG injection); prod → `express.static(dist)` + SPA fallback `GET *` (excluding `/api`, `/server-api`, `/socket.io`), with Lovemeetly-domain link rewriting and per-profile OG meta injection for `/profile/:id` and `/@:id`.

## Socket.IO architecture

- Socket.IO server (`io`) created on the same HTTP server with CORS `*`; broadcasts also flow through the global 3.x/4.x emitter. Client connects via `src/services/socket.ts`: websocket-first (`transports: ['websocket', 'polling']`), autoConnect, 10 reconnection attempts.
- **Rooms**: users join `user_<userId>` (presence, notifications, incoming calls); call participants join `call_<callId>`; conversations join `<conversationId>`.
- **Client→server events**: `user:join`, `user:online`, `conversation:join`, `conversation:leave`, `typing:start`, `typing:stop`, `message:read`, and the call/WebRTC set: `call:join`, `call:ready`, `call:request-offer`, `call:initiate`, `call:accept`, `call:reject`, `call:end`, `call:leave`, `webrtc:offer`, `webrtc:answer`, `webrtc:ice-candidate`, `webrtc:media-toggle`, `webrtc:ready`, `webrtc:request-offer`.
- **Server→client emits** (from REST handlers and socket relay): `user:status`, `notification:new`, `follow:update`, `user:blocked`, `match:created`, `message:read`, `message:received`, `message:new`, `call:incoming`, `call:accepted`, `call:rejected`, `call:ended`, `call:peer-joined`, `call:peer-left`, `webrtc:ready`, `webrtc:request-offer`, `webrtc:offer`, `webrtc:answer`, `webrtc:ice-candidate`, `webrtc:media-toggle`.
- **Signaling constraint (latest commit)**: call events are targeted only to private rooms (`user_<id>` / `call_<id>`) rather than globally broadcast, so only the two participants receive call/WebRTC signaling.
- **Listener lifecycle**: the root Socket.IO effect in `src/App.tsx` registers on `match:created`, `follow:update`, `call:incoming`, `call:rejected`, `call:ended`, `notification:new`, plus a notification REST sync `setInterval` every **8 s**. `ChatWindow` registers on `message:new`, `message:received`, `typing:start`, `typing:stop`, `message:read`. `CallOverlay` registers on `webrtc:offer`, `webrtc:answer`, `webrtc:ice-candidate`, `webrtc:ready`, `webrtc:request-offer`, `webrtc:media-toggle`, `call:accepted`, `call:ready`, `call:peer-joined`, `call:ended`. `IncomingCallModal` uses a 3 s ring-tone interval. Subscription payment polling is every 4 s (max ~5 min); boost payment polling is every 5 s (max 30 attempts); there is also a 1 s call-elapsed timer and a 400 ms audio-visualizer in `CallOverlay`. Only one Socket.IO singleton exists (`src/services/socket.ts`, `io(baseUrl|undefined, { autoConnect, reconnectionAttempts: 10, transports: ['websocket','polling'] })`).

## WebRTC / audio-video call architecture

- **Initiation**: `POST /api/calls` creates a `calls` row with `status='ringing'`, builds a `{ id, caller_id, receiver_id, caller_profile, receiver_profile, type: 'voice'|'video', status, duration, created_at }` payload and emits `call:incoming` to `user_<receiver>`. If the receiver has no sockets (auto/offline demo profile), the call auto-accepts after ~2.5s.
- **Accept/Reject/End**: REST endpoints update the `calls` row (status/started_at/ended_at/duration) and emit to `user_<caller>`, `user_<receiver>`, and `call_<callId>` rooms. Call history (`GET /api/calls`, `GET /api/calls/history`) returns last 50 with caller/receiver profiles.
- **Peer connection** (`src/components/CallOverlay.tsx`):
  - `RTCPeerConnection` with public Google STUN servers (stun.l.google.com, stun1-4.l.google.com, stun.cloudflare.com, stun.services.mozilla.com); **no TURN servers configured**.
  - Media from `navigator.mediaDevices.getUserMedia` with mobile-friendly constraints and fallbacks (ideal constraints → standard → audio-only).
  - Offerer (caller) creates the SDP offer; callee answers; candidates exchanged via `webrtc:ice-candidate`; `webrtc:ready`/`webrtc:request-offer` negotiate readiness; `webrtc:media-toggle` relays camera/mic toggles.
  - **Initial-offer idempotency**: every trigger path — `call.status === 'accepted'` effect, inbound `call:accepted`/`call:ready`/`call:peer-joined`/`webrtc:ready`/`webrtc:request-offer` socket events, and the auto-accept branch inside `initLocalMedia` — funnels through `ensureInitialOfferRef` (a referentially-stable inline closure). It sends exactly **one** offer per `RTCPeerConnection` instance (guarded by `hasSentInitialOfferRef` + `hasSentInitialOfferForPcRef`). `sendOffer` clears its in-flight flag in `finally` (not a 500 ms `setTimeout`) so a failed offer can be retried instead of racing.
  - `handleOffer` (callee) drops duplicate/echoed offers (ignores `isCaller` echoes and already-answered states) and only `rollback`s a `have-remote-offer` state; `handleAnswer` ignores answers once negotiation is already stable and resets `isInitiatingOfferRef` after consuming the answer.
  - Remote tracks are deduplicated by track id and `hasRemoteStream` is set true once per call (never reset mid-call), so repeated `ontrack`/ready-signal re-renders cannot remount or toggle the remote `<video>` element.
  - `ontrack` attaches `onmute`/`onunmute` for remote tracks: they only flip `track.enabled` and `isRemoteVideoOff` — they never recreate the peer connection or re-acquire media (source of the ~1 s video flicker fixed).
  - `App.tsx` no longer registers a `call:accepted` socket listener; accept state flows through `handleAcceptCall`/`CallOverlay` only.
  - Signaling is socket-relayed through the `call_<callId>` / `user_<id>` rooms described above.
- `IncomingCallModal.tsx` renders the ringing screen and emits accept/reject.

## Authentication architecture

- **Primary**: email + password registration with an 18+ age gate on registration. Passwords are **hashed** with Node's built-in scrypt KDF (`server/password.ts`) before storage; the stored value never contains plaintext (`scrypt$N=16384,r=8,p=1$<saltB64>$<derivedKeyB64>`). Legacy plaintext values are compared in constant time on login and transparently upgraded to a scrypt hash in place (`verifyPassword`/`hashPassword`). On login/register the server issues an opaque session token (`tok_<base36-timestamp>_<hex>`, 30-day expiry) stored in a `sessions` table; requests authenticate via `Authorization: Bearer <token>` or `x-session-token`. `GET /api/auth/me` resolves the session to `{ user, profile }`.
- **Password reset**: `/api/auth/forgot-password` sends a 6-digit-style OTP via Nodemailer (with in-memory rate limiting: 60s cooldown, max 5/hour per email+IP, 30-min temporary block); `verify-reset-code` and `reset-password` complete the flow. `change-password` handles authenticated changes. Welcome e-mails are also sent on registration.
- **Firebase**: client `firebase.ts` (Firebase web app; `getAuth`, `GoogleAuthProvider`) and server-side `firebase-admin.ts` (`adminAuth`) are initialized from `firebase-applet-config.json`, but **no Firebase/Google sign-in flow is currently wired into the app**; credentials exist for future OAuth/ID-token verification.
- **Roles/tiers**: `users.role` (`USER`/`ADMIN`/`MODERATOR`), `subscription_tier` (`FREE`/`PREMIUM`/`VIP`). `formatUserRow` automatically elevates any account whose email matches `isSuperAdminEmail` (see ADMIN_EMAILS list in `server.ts`, ~line 234) to ADMIN/VIP.
- **Admin auth**: `requireAdmin` middleware requires an authenticated session whose user is either `users.role === 'ADMIN'` or a server-side super-admin email from the `ADMIN_EMAILS` allowlist (`server.ts` ~line 230) — there is **no** master-key/secret-header backdoor, and an inactive `admin_members` entry blocks access. Sub-admins are modeled in the `admin_members` table with `permissions_json` (kpi, subscriptions, payments, users, moderation, providers, logs, settings, admins, boosts, legal); `requirePermission(...)` enforces them. The old `POST /api/admin/claim-superadmin` self-promotion route was removed; admin provisioning happens only through the `requirePermission('admins')` member-management routes. Super-admin status is derived solely from the server-side `ADMIN_EMAILS` allowlist. `AdminView`/`AdminPortal` are the frontend admin surfaces.
- **Flags**: `is_email_verified`, `is_age_verified`, `is_banned` (banned sessions are blocked by middleware).

## Database architecture

Dual-layer storage with background bidirectional sync:

1. **SQLite (runtime primary, WASM)** — `server/db.ts` loads `data/globalmatch.sqlite` via `sql.js` into memory, initializes all tables on boot, and persists atomically (temp-file + rename) through a serialized write queue. `SqlHelper` exposes `queryOne/queryAll/execute` plus follower helpers. This is the DB most REST handlers actually read/write.
2. **PostgreSQL (persistent store, optional)** — via `pg` pool + Drizzle ORM (`src/db/schema.ts`). Tables are auto-created on boot by `src/db/migrate.ts` (`CREATE TABLE IF NOT EXISTS`), seeded if empty by `src/db/seed.ts`, and kept in sync by `src/db/sync.ts` (`syncSqliteWithPostgres`, `syncPostgresToSqlite`, `syncSingleUser`, `syncSinglePayment`, `syncSingleSubscription`) after home-changes/startup. `DATABASE_URL` (e.g. Neon with `sslmode=require`) or local `SQL_*` vars configure it. A committed `prisma/schema.prisma` exists but **Prisma is unused at runtime** (the app uses Drizzle for Postgres and hand-written SQL for SQLite).

**Tables** (SQLite definitions in `server/db.ts`; Postgres Drizzle schema mirrors them in `src/db/schema.ts`):
`users`, `profiles`, `sessions`, `password_reset_tokens`, `conversations`, `messages`, `calls`, `notifications`, `likes`, `matches`, `reports`, `providers`, `attachments`, `follows`, `blocks`, `subscription_plans`, `payment_transactions`, `user_subscriptions`, `payment_settings`, `admin_members`, `boost_packages`, `legal_documents`.

`globalmatch_db.sql` is an older standalone MySQL schema dump (`globalmatch_db`, ENGINE=InnoDB) for reference only — the runtime no longer uses MySQL. `module.exports` helpers on `server.ts` export the sync functions for reuse.

## Payment / NOWPayments architecture

- **Flows**: subscription purchases and profile boosts are paid in crypto via NOWPayments hosted invoices.
  1. `POST /api/payments/create-invoice` (subscriptions) / `POST /api/boosts/create-invoice`: look up plan/package → record a `payment_transactions` row (`status='waiting'`) → call `createNowPaymentsInvoice()` (live or sandbox base URL depending on config). Invoices always use `price_currency='usd'` (USDT≈USD) and optionally `pay_currency`; amounts near the $10 minimum get a small +0.05 buffer to satisfy NOWPayments' minimal-amount check. Returns `invoice_url` + `orderId`.
  2. User pays on NOWPayments checkout; customer returns via `success_url`/`cancel_url` (`?payment_status=success|cancelled&order_id=...`).
  3. **IPN webhook** `POST /api/payments/nowpayments-ipn`: verifies HMAC-SHA512 signature (`x-nowpayments-sig` header) against the IPN secret using `verifyNowPaymentsSignature` (sorting payload keys, `crypto.timingSafeEqual`). Updates the transaction; on `payment_status === 'finished'` activates the subscription (updates `users.subscription_tier`/`expires_at` via `calculateExpirationDate`) or applies the boost (`profiles.is_boosted`, `boost_expires_at`), writes `user_subscriptions` records, creates notifications, and emits realtime events. Responds `{ status:'ok', received:true }`.
  4. **Client polling** `GET /api/payments/check-status/:orderId`: if not finished, queries NOWPayments directly (`getNowPaymentsPaymentStatus`) and auto-activates when status becomes finished.
- **Free plans**: `POST /api/subscriptions/subscribe-free` activates zero-price promo plans with abuse prevention (no existing active paid sub; one claim per user per plan).
- **Config precedence**: `payment_settings` row `'nowpayments'` (editable from Admin Portal → payments settings) with env-var fallbacks (`NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, `NOWPAYMENTS_SANDBOX`); values stored masked (`****`) are ignored in favor of env. Gateway can be disabled (`is_enabled`).
- Legacy/quick purchase paths exist for boosts (`/api/boosts/purchase`) and a legacy `/api/subscriptions/checkout` (server-side tier upgrade). Stripe env vars remain as unused placeholders; `SubscriptionModal` renders plans from `/api/subscriptions/plans`.

## Important development constraints

- **Deployment model**: cPanel + LiteSpeed + Phusion Passenger. The Node app is the entire web server (API + SPA). Client calls go through `/server-api` to avoid LiteSpeed `/api` interception; never hard-code API endpoints other than through `api.ts`. Production startup file is `dist/server.cjs` (the `assets/` top-level copy is required by the `index.html` fallback loader).
- **Do not break the dual-DB sync**: SQLite is the runtime source of truth for most REST writes while Postgres is the durable store that syncs in the background. When persisting user/profile/payment data, mirror it into both layers (or call the sync helpers) — the app boots with DB init → seed → sync.
- **Auth/session handling**: sessions are DB-backed opaque tokens; changes that affect login, session resolution, admin elevation, or banned-user checks must preserve the middleware contract (`req.user`/`req.profile` populated on every request).
- **Signal privacy**: call/WebRTC signaling must only target private per-user/per-call rooms; global broadcasts of call events are a regression (see latest commit "fix: restrict call signaling to private socket rooms").
- **No TURN servers**: calls rely on public STUN; keep fallback behavior when peer-to-peer connectivity fails.
- **Payload limits**: base64 file uploads flow through JSON (50 MB limit) — large media changes must respect this.
- **Admin security**: admin routes are guarded by `requireAdmin`/`requirePermission` using authenticated sessions only — no master-key/secret-header backdoor exists, and the self-promotion `claim-superadmin` route has been removed. Super-admin emails must remain server-side only (the `ADMIN_EMAILS` allowlist in `server.ts`) and never be committed into client bundles; the same applies to SMTP/PG credentials, which should not be echoed into logs, docs, or new files.
- **Environment**: `.env` is gitignored; new required config must be added to `.env.example` with a comment.
- **Versions**: Node ≥ 18 (cPanel recommends 18/20+); TypeScript strict-ish config with `allowImportingTsExtensions` and `noEmit` — source imports include `.ts`/`.tsx` extensions, so preserve them when moving/renaming files. React 19 + Tailwind 4; keep module-based (`"type": "module"`) for the server bundle.
- **Repository cleanliness**: `dist/`, `server.cjs`, `data/*.sqlite`, `.env*` and the `assets/index-*.js`/`assets/index-*.css` bundles are gitignored. Note that the build also copies `assets/web-*.js` (the fallback-loader module) to the top-level `assets/` folder, which is **not** gitignored and shows up as `?? assets/web-*.js` in `git status` after every build — leave these untracked artifacts alone unless a deployment requires them.