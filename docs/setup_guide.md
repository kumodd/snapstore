# SnapStore — Production Setup Guide

This guide walks you through the step-by-step process of taking the SnapStore codebase and deploying it to production. It covers setting up Supabase, Razorpay, OpenAI, and deploying the frontend.

## 1. Supabase Backend Setup

Supabase handles our database, authentication, storage, and serverless Edge Functions.

### 1.1 Create a Supabase Project
1. Go to [Supabase Dashboard](https://supabase.com/dashboard) and sign in.
2. Click **New Project**, select your organization, name it `SnapStore`, and generate a strong database password. Click **Create new project**.
3. Once the project is provisioned, go to **Project Settings** (gear icon) -> **API** to find your **Project URL** and **anon public key**.

### 1.2 Link Local Config to Remote
Open a terminal in the root of your `SnapStore` folder.

```bash
# Login to Supabase CLI (if you haven't already)
supabase login

# Link your local project to the remote project
# You can find the Reference ID in your Supabase project URL: https://supabase.com/dashboard/project/<REFERENCE_ID>
supabase link --project-ref YOUR_PROJECT_REFERENCE_ID
```

### 1.3 Push Database Schema
We have already written the migrations locally. Push them to the production database:

```bash
supabase db push
```
*This will create all tables, schemas, RLS policies, and storage buckets.*

### 1.4 Setup Authentication Providers
By default, email sign-ups are enabled, but we need to configure Redirect URLs and Google OAuth.

#### Redirect URLs:
1. Go to **Authentication** -> **URL Configuration**.
2. Set the **Site URL** to your production domain (e.g., `https://snapstore.io`).
3. Add the following **Redirect URLs**:
   - `http://localhost:5173/auth/callback` (for local development)
   - `https://snapstore.io/auth/callback` (for production)

#### Google OAuth (Optional but Recommended):
1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project.
2. Navigate to **APIs & Services** -> **Credentials**.
3. Create new **OAuth client ID** credentials (Application type: Web application).
4. Add your Supabase Callback URL (found in Supabase Dashboard -> Auth -> Providers -> Google) to the "Authorized redirect URIs" in Google Cloud.
5. Copy the Client ID and Client Secret from Google, and paste them into the Google provider settings in the Supabase Dashboard. Turn it on and save.

---

## 2. Razorpay Setup (Billing)

Razorpay is used for handling subscriptions (Indie, Pro, Team plans) and the Pay-Per-Project (PPP) option.

### 2.1 Create Razorpay Subscriptions (Plans)
1. Go to your [Razorpay Dashboard](https://dashboard.razorpay.com/).
2. Navigate to **Subscriptions** -> **Plans** -> **Create Plan**.
3. Create the following plans and copy their **Plan IDs** (`plan_...`):
   - **Indie Plan**: Recurring Monthly (₹499) and Yearly (₹4999)
   - **Pro Plan**: Recurring Monthly (₹999) and Yearly (₹9999)
   - **Team Plan**: Recurring Monthly (₹2499) and Yearly (₹24999)

*Note: Update the `PLAN_MAP` inside `supabase/functions/create-razorpay-order/index.ts` with your actual Razorpay Plan IDs.*

### 2.2 Get API Keys
1. Go to **Settings** -> **API keys** in Razorpay.
2. Click **Generate Key** (or view existing keys).
3. Copy the **Key ID** (`rzp_...`) and **Key Secret**.

### 2.3 Setup Razorpay Webhook
We need a webhook to listen to recurring charges and single payment captures to upgrade the user's plan in Supabase.
1. Go to **Settings** -> **Webhooks** -> **Add New Webhook**.
2. Set the Webhook URL to: `https://<YOUR_REF_ID>.supabase.co/functions/v1/razorpay-webhook`.
3. Set a strong **Secret**, and note it down.
4. Select the events: `subscription.charged` and `payment.captured`.
5. Save Webhook.

---

## 3. OpenAI Setup (AI Features)

1. Go to the [OpenAI Platform](https://platform.openai.com/).
2. Sign in and navigate to **API Keys**.
3. Click **Create new secret key**. Name it `SnapStore Prod`.
4. Copy the secret key (Starts with `sk-...`).

---

## 4. Deploying Supabase Edge Functions

Our backend logic (AI and Razorpay Checkouts) runs securely on Supabase Edge Functions.

### 4.1 Set Edge Function Secrets
In your terminal, set the required secrets so the Edge Functions can access Razorpay, OpenAI, and your database using the service role key.

```bash
# Get your Service Role Key from Supabase Dashboard -> Project Settings -> API
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Set Razorpay Secret Keys
supabase secrets set RAZORPAY_KEY_ID=rzp_live_...
supabase secrets set RAZORPAY_KEY_SECRET=...
supabase secrets set RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Set OpenAI API Key
supabase secrets set OPENAI_API_KEY=sk-...
```

### 4.2 Deploy the Functions
Push the local edge functions to the remote project:

```bash
supabase functions deploy ai-copy
supabase functions deploy create-razorpay-order
supabase functions deploy razorpay-webhook
```

---

## 5. Frontend Deployment (Vercel)

The easiest way to deploy the Vite SPA is using Vercel.

### 5.1 Set Environment Variables locally
Create a `.env.local` file in your project root for local testing:
```env
VITE_SUPABASE_URL=https://<YOUR_REF_ID>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_APP_URL=http://localhost:5173
```

### 5.2 Deploy to Vercel
1. Push your code to a GitHub repository.
2. Go to [Vercel](https://vercel.com/) and click **Add New Project**.
3. Import your GitHub repository.
4. Set the Framework Preset to **Vite**.
5. In the **Environment Variables** section, add:
   - `VITE_SUPABASE_URL` = (Your Supabase Project URL)
   - `VITE_SUPABASE_ANON_KEY` = (Your Supabase Anon Key)
   - `VITE_APP_URL` = `https://snapstore.io` (Or your Vercel deployment URL)
6. Click **Deploy**.

Because this is a Single Page Application (SPA), ensure Vercel routes all traffic to `index.html`. Using Vite on Vercel generally handles this automatically, but you can add a `vercel.json` if needed:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

## 6. Pre-Launch Checklist
- [ ] Confirm local `.env.local` and Vercel environment variables are set.
- [ ] Ensure Supabase database migrations deployed successfully.
- [ ] Ensure Edge Function secrets (`OPENAI_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`) are set in Supabase.
- [ ] Verify Google OAuth redirect URIs point to production.
- [ ] Test the full auth flow in production (Sign up, Sign out, Login).
- [ ] Test the Razorpay checkout flow (Use Razorpay Test Mode first).
- [ ] Verify the AI copy generation (Uses OpenAI credits).
- [ ] Test project export (`canvas.toDataURL()`) and ensure Supabase Storage buckets receive the files.

**Done! SnapStore is now live.**
