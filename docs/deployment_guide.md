# SnapStore — Free Deployment Guide

A complete, step-by-step guide to deploying SnapStore on **100% free infrastructure**.
Every platform listed below has a generous free tier that covers a production-ready launch.

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Step 1 — Supabase Backend](#step-1--supabase-backend)
4. [Step 2 — Environment Variables](#step-2--environment-variables)
5. [Step 3 — Build the App](#step-3--build-the-app)
6. [Option A — Vercel (Recommended)](#option-a--vercel-recommended)
7. [Option B — Render](#option-b--render)
8. [Option C — Netlify](#option-c--netlify)
9. [Option D — GitHub Pages](#option-d--github-pages)
10. [Option E — Cloudflare Pages](#option-e--cloudflare-pages)
11. [Option F — Railway](#option-f--railway)
12. [Step 4 — Supabase Edge Functions](#step-4--supabase-edge-functions)
13. [Step 5 — Post-Deployment Configuration](#step-5--post-deployment-configuration)
14. [Troubleshooting](#troubleshooting)
15. [Free Tier Limits Comparison](#free-tier-limits-comparison)

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────┐
│  Users (Browser)                                              │
│      │                                                        │
│      ▼                                                        │
│  ┌─────────────┐      ┌──────────────────────────────────┐   │
│  │  CDN Host   │      │         Supabase (Free tier)     │   │
│  │  (Static)   │─────▶│  • PostgreSQL Database           │   │
│  │             │      │  • Auth (Email + Google OAuth)   │   │
│  │  Vercel /   │      │  • Storage (avatars, assets)     │   │
│  │  Netlify /  │      │  • Edge Functions (AI + billing) │   │
│  │  Render etc.│      │  • Realtime subscriptions        │   │
│  └─────────────┘      └──────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

SnapStore is a **Vite SPA (Single Page Application)**. The frontend is a
completely static build (`dist/` folder) — no Node.js server is needed.
All dynamic logic runs in Supabase Edge Functions (Deno runtime, free tier included).

---

## Prerequisites

Before starting, make sure you have these installed on your machine:

```bash
# Check versions
node --version   # v18+ required
npm --version    # v9+ required
git --version    # any recent version
```

You will also need:
- A **GitHub account** (to push code and connect to hosting platforms)
- A **Supabase account** (free at supabase.com — no credit card)

---

## Step 1 — Supabase Backend

Supabase is our entire backend (database, auth, storage, edge functions).
The free tier includes 500 MB database, 1 GB storage, 50,000 MAU, and 500K edge function invocations/month.

### 1.1 Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → **Start your project** → Sign in with GitHub.
2. Click **New project** → choose your organization.
3. Fill in:
   - **Name:** `snapstore` (or any name)
   - **Database Password:** generate a strong one and **save it somewhere safe**
   - **Region:** pick the closest to your users
4. Click **Create new project** and wait ~2 minutes for provisioning.

### 1.2 Run the Database Migrations

You have two options — CLI (preferred) or the SQL Editor.

#### Option A — Supabase CLI (recommended)

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# In your SnapStore project folder, link to your remote project
# Find YOUR_PROJECT_REF in your project URL:
# https://supabase.com/dashboard/project/<YOUR_PROJECT_REF>
supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations at once
supabase db push
```

#### Option B — SQL Editor (manual, no CLI needed)

1. In Supabase Dashboard → **SQL Editor** → click **New query**.
2. Open each migration file from your project and paste + run them **in order**:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_storage_buckets.sql`
   - `supabase/migrations/004_slides_fix.sql`
   - `supabase/migrations/005_admin_system.sql`
3. Click **Run** after each one. Green = success.

> **Important:** If you get `policy already exists` errors, that's fine —
> it means the migration was already partially run. The files use
> `IF NOT EXISTS` and `DROP … IF EXISTS` guards to be idempotent.

### 1.3 Copy Your API Keys

Go to **Project Settings** (gear icon) → **API**:

| Key | Where to find it | Used for |
|-----|-----------------|----------|
| **Project URL** | Project Settings → API → Project URL | `VITE_SUPABASE_URL` |
| **anon / public key** | Project Settings → API → Project API keys | `VITE_SUPABASE_ANON_KEY` |
| **service_role key** | Project Settings → API → Project API keys | Edge Functions only (never in frontend) |

---

## Step 2 — Environment Variables

### 2.1 Create your `.env.local` (local dev only)

In the root of your project, create or update `.env.local`:

```env
# ── Supabase ──────────────────────────────────────────────────
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsIn...

# ── App URL (change this to your production domain later) ──────
VITE_APP_URL=http://localhost:5173

# ── Optional: Razorpay (billing) ──────────────────────────────
# Leave blank if you are not using billing features yet
VITE_RAZORPAY_KEY_ID=
```

> ⚠️ **Never commit `.env.local` to Git.** It is already in `.gitignore`.

### 2.2 Test the local build

```bash
npm install
npm run dev
```

Visit `http://localhost:5173` — if the app loads and auth works, you're ready to deploy.

---

## Step 3 — Build the App

All hosting platforms will run this command automatically, but you can test it locally first:

```bash
npm run build
```

This outputs a `dist/` folder containing the complete static site.
Test the production build locally:

```bash
npm run preview
# Opens at http://localhost:4173
```

---

## Option A — Vercel (Recommended)

**Free tier:** 100 GB bandwidth/month, unlimited deployments, custom domains, HTTPS.
Best fit because it handles SPA routing automatically and has zero-config Vite support.

### Deploy Steps

1. Push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/snapstore.git
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com) → **Sign up with GitHub** (free).

3. Click **Add New → Project** → Import your `snapstore` repository.

4. Vercel auto-detects Vite. Confirm these settings:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

5. Expand **Environment Variables** and add:
   ```
   VITE_SUPABASE_URL         = https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY    = eyJ...
   VITE_APP_URL              = https://your-app.vercel.app
   ```

6. Click **Deploy**. Done — your app is live in ~60 seconds.

### SPA Routing Fix

If you get 404 on page refresh (e.g., `/dashboard`), create `vercel.json` in your project root:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Commit and push — Vercel will redeploy automatically.

### Custom Domain (Free)

1. In Vercel → your project → **Settings → Domains**.
2. Add your domain (e.g., `snapstore.io`) and follow the DNS instructions.
3. Vercel provisions a free SSL certificate automatically.

---

## Option B — Render

**Free tier:** 750 hours/month of compute (enough for always-on static sites),
100 GB bandwidth, custom domains, HTTPS. Free static sites never sleep.

### Deploy Steps

1. Go to [render.com](https://render.com) → Sign up with GitHub (free).

2. Click **New → Static Site**.

3. Connect your GitHub repository.

4. Configure:
   | Setting | Value |
   |---------|-------|
   | **Name** | `snapstore` |
   | **Branch** | `main` |
   | **Build Command** | `npm run build` |
   | **Publish Directory** | `dist` |

5. Under **Environment Variables**, add:
   ```
   VITE_SUPABASE_URL       = https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY  = eyJ...
   VITE_APP_URL            = https://snapstore.onrender.com
   ```

6. Click **Create Static Site**.

### SPA Routing Fix

In Render dashboard → your site → **Redirects/Rewrites**:

| Source | Destination | Action |
|--------|-------------|--------|
| `/*` | `/index.html` | Rewrite |

Or create a `_redirects` file in your `public/` folder:

```
/*    /index.html   200
```

---

## Option C — Netlify

**Free tier:** 100 GB bandwidth/month, 300 build minutes/month, custom domains, HTTPS, form handling.

### Deploy Steps

#### Method 1 — Drag and Drop (fastest, no CI/CD)

```bash
npm run build
```

1. Go to [netlify.com](https://netlify.com) → Sign up (free).
2. On the dashboard, drag your entire `dist/` folder into the deploy dropzone.
3. Done — you get a `your-site.netlify.app` URL instantly.

#### Method 2 — Git Integration (auto-deploy on push)

1. In Netlify Dashboard → **Add new site → Import an existing project**.
2. Connect GitHub and select your repository.
3. Configure:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Under **Site configuration → Environment variables**, add your `VITE_*` vars.
5. Click **Deploy site**.

### SPA Routing Fix

Create `public/_redirects` (Netlify reads this automatically):

```
/*    /index.html   200
```

Or create `netlify.toml` in your project root:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## Option D — GitHub Pages

**Free tier:** Completely free, unlimited bandwidth for public repos,
custom domains, HTTPS. Best if you want everything in one place.

> **Limitation:** GitHub Pages serves from a subfolder (`/repo-name/`) by default.
> You need to set `base` in `vite.config.ts` if deploying to a subfolder.

### Deploy Steps

#### Setup Vite for GitHub Pages

If deploying to `https://kumodd.github.io/snapstore/`, update `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Set base to '/' if you have a custom domain or using username.github.io
  // Set base to '/snapstore/' if deploying to a repo subfolder
  base: '/',
})
```

#### Method 1 — GitHub Actions (auto-deploy on push)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm install

      - name: Build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          VITE_APP_URL: ${{ secrets.VITE_APP_URL }}
        run: npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

Then add your secrets:

1. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**.
2. Add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_APP_URL`

3. Enable Pages: **Settings → Pages → Source → GitHub Actions**.

Push to `main` — the workflow runs and deploys automatically.

### SPA Routing Fix for GitHub Pages

GitHub Pages does not support SPA routing natively. Add this workaround:

Create `public/404.html` with this content:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>SnapStore</title>
    <script>
      // Redirect 404s back to index with the path preserved
      var path = window.location.pathname;
      var query = window.location.search.slice(1);
      var hash = window.location.hash.slice(1);
      var redirect = '/?p=' + encodeURIComponent(path.slice(1))
        + (query ? '&q=' + encodeURIComponent(query) : '')
        + (hash ? '&h=' + encodeURIComponent(hash) : '');
      window.location.replace(redirect);
    </script>
  </head>
</html>
```

And add this script to the `<head>` of your `index.html`:

```html
<script>
  // Restore URL after 404 redirect
  (function() {
    var redirect = sessionStorage.redirect;
    delete sessionStorage.redirect;
    if (redirect && redirect !== location.href) {
      history.replaceState(null, null, redirect);
    }
    var p = new URLSearchParams(location.search).get('p');
    if (p) history.replaceState(null, null, '/' + p);
  })();
</script>
```

---

## Option E — Cloudflare Pages

**Free tier:** Unlimited bandwidth, 500 deployments/month, unlimited sites,
custom domains, HTTPS, global CDN (fastest option globally).

### Deploy Steps

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com) → Sign up (free).

2. Click **Create a project → Connect to Git**.

3. Authorize Cloudflare to access your GitHub account, select your repository.

4. Configure build settings:
   | Setting | Value |
   |---------|-------|
   | **Framework preset** | Vite |
   | **Build command** | `npm run build` |
   | **Build output directory** | `dist` |
   | **Node.js version** | `20` (set in Environment Variables: `NODE_VERSION = 20`) |

5. Under **Environment Variables (production)**, add:
   ```
   VITE_SUPABASE_URL       = https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY  = eyJ...
   VITE_APP_URL            = https://snapstore.pages.dev
   ```

6. Click **Save and Deploy**.

### SPA Routing Fix

Create `public/_redirects`:

```
/*    /index.html   200
```

Cloudflare Pages reads this automatically.

---

## Option F — Railway

**Free tier:** $5 credit/month (enough for a low-traffic static site),
custom domains, HTTPS. Better suited if you ever add a Node.js backend.

### Deploy Steps (Static Site via Nixpacks)

1. Go to [railway.app](https://railway.app) → Sign up with GitHub (free).

2. Click **New Project → Deploy from GitHub repo**.

3. Select your repository.

4. Railway auto-detects Vite. Set environment variables:
   ```
   VITE_SUPABASE_URL       = https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY  = eyJ...
   VITE_APP_URL            = https://snapstore.up.railway.app
   PORT                    = 3000
   ```

5. Add a `railway.json` in your project root for the static server:
   ```json
   {
     "$schema": "https://railway.app/railway.schema.json",
     "build": {
       "builder": "NIXPACKS"
     },
     "deploy": {
       "startCommand": "npx serve dist -s -l 3000",
       "restartPolicyType": "ON_FAILURE"
     }
   }
   ```

6. Also update `package.json` scripts:
   ```json
   "start": "npx serve dist -s -l 3000"
   ```

---

## Step 4 — Supabase Edge Functions

Edge Functions handle AI (OpenAI) and billing (Razorpay). Deploy them once
and they run globally on Deno. This step is the same regardless of which
frontend host you chose.

### 4.1 Set the Required Secrets

```bash
# Your Supabase service role key (from Project Settings → API)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI (for AI copy generation)
supabase secrets set OPENAI_API_KEY=sk-proj-...

# Razorpay (leave blank if not using billing yet)
supabase secrets set RAZORPAY_KEY_ID=rzp_live_...
supabase secrets set RAZORPAY_KEY_SECRET=...
supabase secrets set RAZORPAY_WEBHOOK_SECRET=...
```

### 4.2 Deploy the Functions

```bash
supabase functions deploy ai-copy
supabase functions deploy create-razorpay-order
supabase functions deploy razorpay-webhook
```

> **No billing setup yet?** You can skip the Razorpay steps and deploy only `ai-copy`.
> The billing functions will just return errors until the keys are set.

### 4.3 Verify Functions Are Live

```bash
supabase functions list
```

Expected output:
```
Name                   Status
ai-copy               ACTIVE
create-razorpay-order ACTIVE
razorpay-webhook      ACTIVE
```

---

## Step 5 — Post-Deployment Configuration

### 5.1 Update Supabase Auth URL

After deploying, you must tell Supabase your production URL:

1. Supabase Dashboard → **Authentication → URL Configuration**.
2. Update **Site URL** to your production URL, e.g. `https://your-app.vercel.app`.
3. Under **Redirect URLs**, add:
   - `https://your-app.vercel.app/auth/callback`
   - Keep `http://localhost:5173/auth/callback` for local dev.
4. Click **Save**.

### 5.2 Add Yourself as Admin

Open the Supabase SQL Editor and run:

```sql
-- First, find your user ID
SELECT id, email FROM auth.users LIMIT 10;

-- Then insert yourself as super_admin
INSERT INTO public.admin_users (id, role)
VALUES ('YOUR_USER_UUID_HERE', 'super_admin')
ON CONFLICT (id) DO UPDATE SET role = 'super_admin';
```

### 5.3 Update VITE_APP_URL

After your site is live, update `VITE_APP_URL` in your hosting platform's
environment variables to match the actual production URL. This is used for
OAuth redirects.

### 5.4 Storage Bucket CORS

If uploading avatars or project assets fails, configure storage CORS:

1. Supabase Dashboard → **Storage → Policies**.
2. Ensure the `assets` bucket has public read access (migration `003_storage_buckets.sql` handles this).
3. If still blocked, go to **Storage → Configuration → CORS** and add:
   ```json
   [
     {
       "AllowedOrigins": ["https://your-app.vercel.app", "http://localhost:5173"],
       "AllowedMethods": ["GET", "POST", "PUT", "DELETE"],
       "AllowedHeaders": ["*"]
     }
   ]
   ```

---

## Troubleshooting

### ❌ White screen after deploy

**Cause:** SPA routing not configured — the server returns 404 for routes like `/dashboard`.

**Fix:** Add the appropriate redirect file for your platform:
- Vercel → `vercel.json` with rewrites
- Netlify → `public/_redirects` file
- Cloudflare Pages → `public/_redirects` file
- Render → add rewrite rule in dashboard

---

### ❌ "Invalid API key" or auth not working

**Cause:** Environment variables not set correctly on the hosting platform.

**Fix:**
1. Double-check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
   in the hosting platform's environment variable settings (not just `.env.local`).
2. After updating env vars, **trigger a new deployment** — the build must re-run
   to bake the new values into the static bundle.
3. Verify the values by checking the deployed site's source:
   `Ctrl+U` → search for `supabase`.

---

### ❌ Google OAuth redirect_uri_mismatch

**Cause:** The redirect URI in Google Cloud Console doesn't match.

**Fix:**
1. Google Cloud Console → **Credentials → OAuth Client → Authorized redirect URIs**.
2. Add `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
3. Also add your production URL callback: `https://your-app.vercel.app/auth/callback`.

---

### ❌ Edge Function returns 500

**Cause:** Missing secrets or wrong service role key.

**Fix:**
```bash
# Check which secrets are set
supabase secrets list

# Re-set a secret
supabase secrets set OPENAI_API_KEY=sk-...

# Check function logs
supabase functions logs ai-copy --tail
```

---

### ❌ Database migration errors

**Cause:** Migrations run out of order, or partially ran before.

**Fix:** Use the idempotent fix files (`004_slides_fix.sql`) and always use
`IF NOT EXISTS` / `DROP … IF EXISTS` in migrations. Re-run only the failing file.

---

## Free Tier Limits Comparison

| Platform | Bandwidth | Builds | Custom Domain | Global CDN | Sleep on Inactivity |
|----------|-----------|--------|---------------|------------|---------------------|
| **Vercel** | 100 GB/mo | Unlimited | ✅ Free | ✅ | ❌ Never |
| **Netlify** | 100 GB/mo | 300 min/mo | ✅ Free | ✅ | ❌ Never |
| **Cloudflare Pages** | Unlimited | 500/mo | ✅ Free | ✅ Fastest | ❌ Never |
| **Render** | 100 GB/mo | Unlimited | ✅ Free | ❌ | ❌ Never (static) |
| **GitHub Pages** | Unlimited | Via Actions | ✅ Free | ✅ | ❌ Never |
| **Railway** | ~$5 credit | Unlimited | ✅ Free | ❌ | ⚠️ Maybe |

| Service | Free Tier Includes |
|---------|-------------------|
| **Supabase** | 500 MB DB, 1 GB storage, 50K MAU, 500K edge fn calls/mo |
| **OpenAI** | Pay per use (no free tier — add $5 credit to start) |
| **Razorpay** | Free to use; they take 2% per transaction |

### Recommendation

> **Best combination for a free launch:**
> **Cloudflare Pages** (frontend) + **Supabase** (backend)
>
> - Unlimited bandwidth on Cloudflare's global CDN
> - Supabase's free tier covers you up to ~50,000 users
> - Both have zero cold-start time

---

## Quick Deploy Summary

```bash
# 1. Clone and install
git clone https://github.com/YOUR_USERNAME/snapstore.git
cd snapstore
npm install

# 2. Configure local env
cp .env.local.example .env.local  # fill in your Supabase keys

# 3. Run database migrations
supabase link --project-ref YOUR_REF
supabase db push

# 4. Deploy edge functions
supabase functions deploy ai-copy
supabase functions deploy create-razorpay-order

# 5. Push to GitHub
git add . && git commit -m "ready for deploy" && git push

# 6. Connect repo to Vercel / Netlify / Cloudflare Pages
# → Add VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_APP_URL
# → Click Deploy
```

**That's it — SnapStore is live for free! 🚀**
