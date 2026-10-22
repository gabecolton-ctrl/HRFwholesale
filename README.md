# hrfwholesale.com — H.R.F Assets LLC

Seller lead site + cash buyer sign-up + private CRM. **Phase 1.**

- **Public:** Home, Get a Cash Offer form (with TCPA consent proof), Investor sign-up (buy box + proof of funds), About, Contact, Privacy, Terms
- **Buyer portal:** buyers edit their buy box and upload proof of funds (deal listings come in Phase 2)
- **CRM (`/crm`):** Today, Follow-ups (overdue / due today / next 7 days), Leads, Cash Buyers (segment filters), Deal Pipeline (disclosure locks), CSV Import, CSV Export, Team

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

- **Phase 2:** buyer portal deal listings (photos, comps, built-in disclosure, acknowledge-before-address), email alerts to matching buyers, Deal Analyzer, KPI dashboard
- **Phase 3:** Rental Analyzer, Portfolio with balloon alerts, SMS/email integrations, instant new-lead notifications
- **Worth adding early:** a CAPTCHA on the public forms if spam shows up (bots are currently filtered by a hidden field and a minimum fill time)

## For developers

```bash
npm install
cp .env.example .env.local   # fill in your Supabase values
npm run dev                  # http://localhost:3000
npm run build                # production build
npm run test:db              # database rule tests (needs a local Postgres 16)
```

Schema and rules: `supabase/migrations/0001_phase1.sql`. Tests: `supabase/tests/rules_test.sql`.
