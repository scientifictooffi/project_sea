# The Case of the Disappearing Sea

An interactive environmental investigation about the Aral Sea. Participants scan a QR code,
enter a nickname, answer five timed questions on their phones, and appear on a live leaderboard
shown on the projector. Scoring happens on the server; the answer key never reaches the browser.

**Stack:** React 19 + TypeScript + Vite + Tailwind CSS v4 · Supabase (Postgres, Row Level Security, Realtime, Edge Functions) · Vercel.

---

## 1. How it works

```
phone  ──start(nickname)──▶  Edge Function "quiz"  ──▶  attempts
phone  ──answer(q, choice)─▶       (service role)   ──▶  attempt_answers  (checks timer, scores)
phone  ──finish()──────────▶                        ──▶  results          (one row per attempt)
projector ◀── Realtime on results + leaderboard view ◀──┘
```

| Where | What |
|---|---|
| `src/pages/` | Landing, Entry (nickname), Quiz, Result, Board (projector), Admin |
| `src/lib/api.ts` | API layer. Talks to the Edge Function, or runs an in-memory **mock** when no Supabase config is present |
| `src/data/questions.ts` | Public question text only (no answers) |
| `supabase/migrations/0001_schema.sql` | Tables, RLS policies, leaderboard view, seed data **including the answer key** |
| `supabase/functions/quiz/index.ts` | Server-side scoring, duplicate protection, admin stats and reset |
| `.env.example` | Placeholder config |

**Scoring.** Each correct answer gives 100 points plus up to 100 speed bonus (remaining seconds / 20 × 100). Maximum 1000.
The server records when each question was served and rejects answers that arrive more than 20 s + 2.5 s network grace later (0 points, marked "expired").

**Duplicate protection.** One `attempt_answers` row per attempt and question (primary key), one `results` row per attempt (unique index). Retried requests return the stored verdict instead of scoring again. A completed attempt cannot answer anything.

**Secrets.** The browser gets only `VITE_SUPABASE_URL` and the anon key. The service-role key is injected into the Edge Function by Supabase automatically; the admin password is an Edge Function secret. Nothing sensitive is in the bundle.

---

## 2. Run locally (no database needed)

```bash
npm install
npm run dev
```

Open http://localhost:5173. The header shows **Mock mode**: everything works in memory (admin password in mock mode is `admin`). Results vanish on reload. This is for checking design and flow only.

---

## 3. Create the Supabase project (about 10 minutes)

1. Go to https://supabase.com, sign in with GitHub, click **New project**. Free plan is enough. Choose a region close to Kazakhstan (e.g. Frankfurt or Singapore), set a database password, create.
2. Wait until the project is ready. Open **SQL Editor → New query**, paste the full contents of `supabase/migrations/0001_schema.sql`, click **Run**. You should see "Success". This creates all tables, security policies, the leaderboard view, and seeds the questions and answer key.
3. Open **Project Settings → API**. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
4. Create a local file `.env` (copy from `.env.example`) and paste those two values. Never commit `.env`.
5. Deploy the Edge Function. Install the Supabase CLI once:
   ```bash
   brew install supabase/tap/supabase        # macOS
   # Windows/Linux: see https://supabase.com/docs/guides/cli
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF      # ref = the part before .supabase.co
   supabase secrets set ADMIN_PASSWORD='choose-a-long-password'
   supabase functions deploy quiz --no-verify-jwt
   ```
   `--no-verify-jwt` is required because participants are anonymous (no login).
6. Restart `npm run dev`. The "Mock mode" badge disappears. Play through once and check **Table Editor → results** in Supabase: a row should appear.

---

## 4. Deploy to Vercel

1. Push the repository to GitHub (do not push `.env`; it is ignored).
2. Go to https://vercel.com → **Add New → Project** → import the repo. Framework preset: **Vite** (detected automatically).
3. Under **Environment Variables** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the same values as in `.env`.
4. Click **Deploy**. You get a URL like `https://disappearing-sea.vercel.app`.
5. `vercel.json` already contains the SPA rewrite so `/board`, `/quiz` etc. work on refresh.

Alternative without GitHub: `npm i -g vercel`, then `vercel` in the project folder and follow the prompts; add the two env vars with `vercel env add`.

### QR code
The leaderboard page (`/board`) and the landing page render a QR code generated **from the current domain at runtime**. After deployment, open `https://your-app.vercel.app/board` on the projector; the QR there already points at the production URL. No manual regeneration is needed; if you change the domain, the QR follows it. Never use the QR from `localhost`: it only works on your own machine.

If you want a printable PNG, open the deployed `/board`, right-click the QR → Save image, or use any generator with the production URL.

---

## 5. Running a session

1. Open `https://your-app.vercel.app/board` on the projector, full screen (F11). Do this a few minutes early so the free-tier database is awake.
2. Students scan, enter a nickname, play. Each finished attempt appears on the board within a second.
3. `https://your-app.vercel.app/admin` + the admin password shows completion stats and per-question accuracy.
4. To clear everything for the next group: Admin → type `RESET` → confirm the browser dialog.

---

## 6. Testing with multiple devices

1. Deploy first (section 4). Phones cannot reach `localhost`.
2. Open `/board` on a laptop. Open the QR on 2–3 phones (different OS if possible: iOS Safari, Android Chrome).
3. On one phone answer every question quickly and correctly: expect a score near 1000 and the rank "Chief Investigator".
4. On another phone, let the timer run out on one question: it should show "Time expired · 0 points" and continue.
5. On a third phone, switch to airplane mode mid-question, tap an answer, then switch back and press **Retry**: the answer is scored once; the result page shows 5 review items.
6. Refresh a phone mid-quiz: it returns to the start page. Finishing a second time with the same nickname creates a separate leaderboard row (nicknames are not unique by design; the organizer can reset).
7. Check the board: rows sorted by score, ties broken by faster time; new rows animate in without refreshing.

---

## 7. Checklist before the lesson

**Mobile usability**
- [ ] Landing, quiz, and result pages readable on a 360 px wide phone without horizontal scrolling.
- [ ] Answer buttons are tappable with a thumb; selected state is visible.
- [ ] Timer is visible while scrolling long questions with images.

**Score accuracy**
- [ ] All-correct fast run ≈ 1000; all-wrong run = 0; mixed run matches `100 + bonus` per correct answer.
- [ ] Expired question gives 0 and shows the correct answer afterwards.
- [ ] Result page "Correct" and "Accuracy" agree with the review list.

**Security**
- [ ] In Supabase SQL Editor run `set role anon; select * from answer_keys;` → must return a permission error or zero rows.
- [ ] `set role anon; select * from attempts;` → permission error.
- [ ] `select * from leaderboard` as anon returns only id, nickname, score, correct_count, duration_ms, created_at.
- [ ] Search the built bundle: `grep -r "service_role\|ADMIN_PASSWORD" dist/` returns nothing.
- [ ] `/admin` with a wrong password is rejected; reset requires typing RESET plus a confirmation dialog.

**Leaderboard updates**
- [ ] A new finished attempt appears on the projector without refreshing.
- [ ] Status dot is teal ("Receiving reports"); if it turns rust, the 15 s polling fallback still refreshes.
- [ ] Reset from admin empties the board on the projector automatically.

---

## 8. Status

- Supabase project created, schema applied, Edge Function `quiz` deployed, admin password set as a secret.
- Frontend deployed on Vercel: https://project-sea-delta.vercel.app
- Verified end to end on production: full five-question run, server-side scoring, duplicate protection, leaderboard row, admin stats and reset.
- Projector page: https://project-sea-delta.vercel.app/board (QR there points at production).
- Multi-device test with real phones (section 6) still to be done by the organizer before the lesson.

## Image credits
- Hero / Exhibit D: Moynaq ship graveyard, Arian Zwegers, CC BY 2.0 (Wikimedia Commons).
- Exhibit A: Aral Sea 1989 vs 2014, NASA Earth Observatory, public domain.
- Exhibit B: Kok-Aral dike, Sentinel-2 imagery, European Space Agency, attribution licence.
- Exhibit C: Fishing boats on the dried seabed, Aliyaassubayeva, CC BY-SA 4.0.
- Background: Aral ship, Staecker, public domain.
