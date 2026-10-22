# hrfwholesale.com — H.R.F Assets LLC

Seller lead site + cash buyer sign-up + buyer deal portal + private CRM. **Phases 1–2.**

- **Public:** Home, Get a Cash Offer form (with TCPA consent proof), Investor sign-up (buy box + proof of funds), About, Contact, Privacy, Terms
- **Buyer portal (`/portal`):** deal listings with photos, comps and the built-in assignment disclosure; buyers acknowledge the disclosure before the address unlocks, then send interest or offers; buy box and proof of funds under My account
- **Deal alerts:** matching buyers are emailed when a deal is published (Tier A first), with one-click unsubscribe
- **CRM (`/crm`):** Today, Dashboard (weekly KPIs, targets vs. actual, cost per contract), Follow-ups, Leads, Deal Analyzer (MAO + GO/PASS), Cash Buyers, Deal Pipeline (disclosure locks, photos, comps, buyer offers, alerts), CSV Import/Export, Team, Settings

Built with Next.js 15 + Supabase (database, logins, private file storage), hosted on Vercel, code on GitHub.

---

## Setup guide (about 45 minutes, no coding)

You'll create three free accounts, then upgrade two to paid plans at launch: **GitHub** (stores the code), **Supabase** (database), **Vercel** (runs the website).

### 1. Supabase: create the database

1. Go to **supabase.com**, sign up, then click **New project**.
   - Name: `hrf-assets`. Set a strong database password and save it in your password manager.
   - Region: choose a US region near Texas.
2. When it's ready, open **SQL Editor**, then **New query**.
3. Open the file `supabase/migrations/0001_phase1.sql` from this project, copy **all** of it, paste it in, and click **Run**. You should see "Success. No rows returned."
4. Go to **Project Settings → API** and keep that tab open. You need three values:
   - **Project URL**
   - **anon public** key
   - **service_role** key. This one is secret: never share it or put it in the browser.

### 2. Supabase: login settings

In **Authentication → URL Configuration**:
- **Site URL:** `https://hrfwholesale.com`
- **Redirect URLs:** add `https://hrfwholesale.com/**` and `https://*.vercel.app/**`

In **Authentication → Sign In / Providers → Email**:
- Keep **Confirm email ON**. Buyers must prove they own their email before they can sign in.

In **Authentication → Emails → Templates**, change the link in three templates (replace the whole `href="..."` value):

| Template | Link to use |
|---|---|
| Confirm signup | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/portal` |
| Invite user | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` |
| Reset password | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` |

**Before launch, set up custom email (SMTP).** Supabase's built-in email only sends a few messages an hour and is meant for testing. Under **Authentication → Emails → SMTP Settings**, connect a sending service (Resend, Postmark or similar) using your business email domain.

### 3. GitHub: store the code

1. Sign up at **github.com** and click **New repository**. Name it `hrfwholesale` and set it to **Private**.
2. Easiest upload: install **GitHub Desktop**, choose *File → Add local repository*, and pick this project folder (it's already a Git repository with the first commit). Click **Publish repository** and keep it private.
   - Or, on the website, open the new repo, click **uploading an existing file**, and drag in everything from the unzipped folder.
3. Never upload a file named `.env` or `.env.local`. The included `.gitignore` already blocks them.

### 4. Vercel: put it online

1. Go to **vercel.com** and sign up **with your GitHub account**.
2. Click **Add New → Project**, pick the `hrfwholesale` repo, and click **Import**.
3. Before clicking Deploy, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL from step 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (secret) |
   | `NEXT_PUBLIC_SITE_URL` | `https://hrfwholesale.com` |

4. Click **Deploy**. In about two minutes you'll get a `...vercel.app` link to test.
5. Upgrade to **Pro** before taking real leads. Vercel's free plan doesn't allow business use.

From now on, every change pushed to GitHub rebuilds the site automatically.

### 5. Connect your domain

In Vercel: **Project → Settings → Domains → Add** `hrfwholesale.com` (and `www.hrfwholesale.com`). Vercel shows the DNS records to create. Add them at the company where you bought the domain. They usually go live within an hour.

### 6. Create your owner login

1. In Supabase: **Authentication → Users → Add user → Create new user**. Enter your email and a strong password, and tick **Auto Confirm User**.
2. In **SQL Editor**, run this with your email:
   ```sql
   update public.profiles set role = 'owner', full_name = 'Gabriel'
   where email = 'you@example.com';
   ```
3. Sign in at `https://hrfwholesale.com/login`. You'll land in the CRM.

Invite teammates from **CRM → Team**. They get an email to set a password, and they only see what their role allows.

### 7. Edit your business details

Open `src/lib/site.ts` (on GitHub you can click the pencil icon to edit in the browser) and set your real **phone number**, **email**, service area and hours. Saving rebuilds the site.

### 8. Upgrade Supabase at launch

Free Supabase projects pause after a week without activity. Switch to **Pro** before you start marketing.

---

## Phase 2 setup (after Phase 1 is live)

### A. Update the database (2 minutes)
In Supabase → **SQL Editor → New query**, paste **all** of `supabase/migrations/0002_phase2.sql` and click **Run**. You should see "Success". (Safe to run again.)

### B. Turn on email with Resend (15 minutes, free tier)
Resend sends deal alerts, new-lead and new-offer notices, and (via SMTP) Supabase's sign-up and invite emails.

1. Sign up at **resend.com**. Go to **Domains → Add Domain** → `hrfassets.com`.
2. Resend shows a few DNS records (TXT/MX/CNAME). Add them wherever **hrfassets.com's** DNS is managed (Namecheap → Advanced DNS if it's there). Wait for **Verified**.
3. **API Keys → Create API Key** (Sending access). Copy it.
4. In Vercel → **Settings → Environment Variables**, add:

   | Name | Type | Value |
   |---|---|---|
   | `RESEND_API_KEY` | Secret | the key from step 3 |
   | `EMAIL_FROM` | Config | `H.R.F Assets LLC <notifications@hrfassets.com>` |
   | `NOTIFY_EMAIL` | Config | where new leads/offers go, e.g. `offers@hrfassets.com` (comma-separate several) |

   Then redeploy (push any change, or Deployments → Create Deployment → `main`).
5. **Supabase emails through Resend:** Supabase → **Authentication → Emails → SMTP Settings** → enable custom SMTP:
   Host `smtp.resend.com`, Port `465`, Username `resend`, Password = your Resend API key,
   Sender email `notifications@hrfassets.com`, Sender name `H.R.F Assets LLC`.

### C. Your mailing address (required in marketing emails)
Deal alert emails must show a physical mailing address (CAN-SPAM). Edit `mailingAddress` in `src/lib/site.ts` — a P.O. box or registered mailbox works.

### D. Set targets and spend
CRM → **Settings**: check the Deal Analyzer defaults, click **Fill 12 months from playbook** with your Month 1, and enter monthly marketing spend per lead source. The Dashboard uses these.

### How listings and alerts work
1. Deal under contract → add **photos**, **comps**, **price shown to buyers** and a description on the deal page.
2. Mark the **seller disclosure signed** → tick **Publish to buyer portal** → Save. Tier A matching buyers are emailed automatically.
3. Use **Email everyone else** on the deal page when you're ready for the full list.
4. Buyers see area, numbers, photos and comps. The **street address unlocks only after they acknowledge the disclosure** (time and IP are recorded). Their interest/offers show under **Buyer interest & offers**, and you get an email.
5. Pick a buyer → set them as End buyer, collect EMD, get the buyer disclosure signed → **Buyer assigned**. The portal shows the deal as Pending.

Matching uses each buyer's areas/ZIPs, price range, rehab levels and property types (blank = any). Each buyer gets at most one alert per deal. Inactive or unsubscribed buyers are never emailed.

## Before you take real leads

- [ ] **Attorney review:** the consent wording (`src/lib/site.ts`), Privacy Policy, Terms, and your seller and buyer disclosure documents.
- [ ] Real phone and email in `src/lib/site.ts`.
- [ ] Custom SMTP connected (step 2).
- [ ] Test end to end: submit the Sell form, then find the lead in CRM → Leads, with its consent record at the bottom.
- [ ] Test buyer sign-up with a second email, confirm it, and sign in to the portal.
- [ ] Download each table from CRM → Export once, to see your backup files.

## How the rules are enforced

These live **in the database**, so no screen, import or teammate can get around them:

- A deal **can't be published** to the buyer portal unless the contract is signed and the **seller disclosure** is marked signed (with a date).
- A deal **can't be marked Buyer assigned** (or Clear to close or Closed) unless the **buyer disclosure** is signed and an end buyer is chosen.
- Every open lead has a **next follow-up date**: day 3, 7, 14, 30, 60, 90, then monthly. Logging a follow-up schedules the next one.
- **Do Not Call** removes a lead from every follow-up list.
- Each role only sees its own data:

| Role | Sees |
|---|---|
| Owner | Everything, plus import, export, team, deletes |
| Acquisitions rep | Their own and unassigned leads, follow-ups, deals they sourced |
| Dispositions | Cash buyers and the whole pipeline (no seller leads) |
| VA / caller | Enter leads and work follow-ups. Can't make offers, reassign, or see buyers or deals |
| Buyer | Only their own buyer profile |

- Proof-of-funds files and signed disclosures sit in **private storage**. The app opens them through 2-minute links, only after checking the viewer's access.
- Every web lead stores the **exact consent wording, time, IP address and page**. If that record can't be saved, the lead isn't saved either.

## Importing your workbook and PropStream lists

CRM → **Import**. In Excel, save the *Lead Tracker* or *Cash Buyers* tab as CSV (File → Save As → CSV), then upload it. Columns are matched automatically where the names are familiar, and you can fix the rest from dropdowns. Addresses already in the CRM, and buyers whose email or phone already exists, are skipped.

## What comes next

- **Phase 3:** Rental Analyzer, Portfolio with balloon alerts, texting and calling inside the CRM (Telnyx), team-role polish
- **Worth adding early:** a CAPTCHA on the public forms if spam shows up (bots are currently filtered by a hidden field and a minimum fill time)

## For developers

```bash
npm install
cp .env.example .env.local   # fill in your Supabase values
npm run dev                  # http://localhost:3000
npm run build                # production build
npm run test:db              # database rule tests (needs a local Postgres 16)
```

Schema and rules: `supabase/migrations/0001_phase1.sql`, `0002_phase2.sql`. Tests: `supabase/tests/rules_test.sql`, `phase2_test.sql`.
