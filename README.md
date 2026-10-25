# Health & Wealth Academy

Wealth Journey Training Program: Next.js (App Router, TypeScript), Claude via the Anthropic SDK.

## Run locally

    npm install
    cp .env.example .env.local      # add a NEW ANTHROPIC_API_KEY
    npm run dev                     # http://localhost:3000

Without an API key the app still runs; the coach, roleplay and scoring show a clear "offline" message.

## What is built

- Learn map (8 weeks, 36 lessons) from `data/curriculum.json`
- Lesson flow: Watch (placeholder player), Check (marked quiz, 80% pass), Practise, Prove
- Quizzes: full banks for lessons 1.1 and 1.3 (`data/quizbanks.json`); sample questions for other lessons (`data/samples.json`)
- Live AI roleplay (`/api/roleplay`) and CLOSER scoring (`/api/score`), four personas in `lib/personas.ts`
- Ask the coach (`/api/coach`), grounded in the FACTS in `lib/ai.ts`, the curriculum and the library
- Library with search, copy and a compliance-flag example (`data/library.json`)
- Leader dashboard with EXAMPLE data only
- Progress is stored in the browser (`lib/progress.ts`)

## Single sign-on from Vendor AI
Set `SSO_SECRET` (a long random string, shared with Vendor AI). Vendor AI's "Training" menu item sends the distributor to
`https://<academy-url>/api/sso?token=<JWT>&next=/` where the JWT is HS256-signed with the same secret and has claims:
`iss` = `vendorai`, `aud` = `academy`, `sub` (member ID), `name`, `upline` (optional), `role` (`distributor` or `leader`), `exp` (at most 10 minutes ahead; Vendor AI uses 2 minutes). Vendor AI's side is in `musa-cebs/nextjs-boilerplate`, branch `claude/academy-sso`.

Node example for Vendor AI:

    import { createHmac } from "node:crypto";
    const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const h = b({ alg: "HS256", typ: "JWT" });
    const p = b({ sub: memberId, name, upline, role, exp: Math.floor(Date.now() / 1000) + 300 });
    const token = `${h}.${p}.${createHmac("sha256", process.env.SSO_SECRET).update(`${h}.${p}`).digest("base64url")}`;

Until `SSO_SECRET` is set the app is open (development mode), so set it before sharing the live URL.

## Database
Run `schema.sql` once in the Neon SQL editor, and make sure `DATABASE_URL` is set. Progress, members and roleplay attempts are then stored per member.

## Before launch (not built yet)

1. (Done in code) SSO login and Postgres progress; needs `SSO_SECRET`, `DATABASE_URL` and the Vendor AI link.
2. Real lecture videos on a streaming host; replace the placeholder player.
3. Leader dashboard on real data.
4. Compliance sign-off on `FACTS` in `lib/ai.ts`, the quiz banks and the library wording.
5. Rate limiting is in-memory per server instance; use a shared store (for example Upstash) at scale.
6. Keep `FACTS` in sync with the Sweety system prompt in Make.
7. More quiz banks, library content and personas (content lives in `data/` and `lib/personas.ts`).

## Deploy (Vercel)

Import this folder as a project and set `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`, `ACADEMY_ACCESS_CODE`) as environment variables.

## Security

The API key in the Make scenario's Module 4 is stored in plain text. Rotate it, and use a separate key for this app.
