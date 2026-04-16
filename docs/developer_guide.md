# SnapStore Developer Guide — Local Development

This guide provides step-by-step instructions for setting up the SnapStore development environment on your local machine.

## Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js**: Version 18.0 or higher (v23.11.0 recommended).
- **npm**: Usually comes with Node.js.
- **Git**: For version control.

## 1. Environment Setup

### 1.1 Configuration Files
The project uses environment variables for Supabase and Stripe integration. A template is provided in `.env.example`.

1. Copy the example environment file to create your local configuration:
   ```bash
   cp .env.example .env.local
   ```

2. **Supabase Credentials**: The `.env.example` file contains pre-configured test credentials for the SnapStore project. For local development, these are sufficient to get the application running.
   - `VITE_SUPABASE_URL`: The endpoint for the Supabase project.
   - `VITE_SUPABASE_ANON_KEY`: The public anonymous key for API access.

> [!NOTE]
> If you wish to use your own Supabase instance, update these values in `.env.local` with your project's details from the Supabase Dashboard.

### 1.2 Install Dependencies
Install the required npm packages using the following command:
```bash
npm install
```

## 2. Running the Application

### 2.1 Start Development Server
To launch the application with Hot Module Replacement (HMR), run:
```bash
npm run dev
```

The application will typically be available at: [http://localhost:5173](http://localhost:5173)

### 2.2 Available Scripts
- `npm run dev`: Starts the Vite development server.
- `npm run build`: Compiles the TypeScript and builds the project for production.
- `npm run lint`: Runs ESLint to check for code quality issues.
- `npm run preview`: Locally previews the production build.

## 3. Project Structure

- `src/`: Contains the React application source code.
  - `components/`: Reusable UI components.
  - `pages/`: Page-level components and routing.
  - `lib/`: Configuration for external services (Supabase, etc.).
  - `stores/`: State management using Zustand.
- `supabase/`: Database migrations and serverless Edge Functions.
- `public/`: Static assets like icons and logos.

## 4. Troubleshooting Basic Issues

- **Missing Environment Variables**: If the app fails to start, ensure `.env.local` exists and contains the required `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **Node Modules Issues**: If you encounter unexpected errors after an update, try deleting `node_modules` and running `npm install` again.
- **Port Conflict**: If port 5173 is already in use, Vite will automatically try the next available port (e.g., 5174). Look at the terminal output for the correct URL.

## 5. Comprehensive Debugging

### 5.1 Frontend Debugging
- **Browser Console**: Check for JavaScript errors or failed network requests (401, 403, 500).
- **Network Tab**: Filter by `Fetch/XHR` to see interactions with Supabase and Edge Functions. Verify that the `Authorization: Bearer <token>` header is present for protected routes.
- **React DevTools**: Use the "Components" tab to inspect the `AppInitializer` and `ProtectedRoute` state.
- **Zustand State**: You can log state changes in `src/stores/` by adding simple `console.log` statements inside the `set` function during development.

### 5.2 Supabase & Backend Debugging
- **Authentication**: If you are redirected to the Login page unexpectedly, check the "Users" tab in the Supabase Dashboard to ensure your user exists and is confirmed.
- **RLS Policies**: If you receive a `403 Forbidden` or empty results when you expect data, it's likely a Row Level Security (RLS) issue. 
  - Check `supabase/migrations/002_rls_policies.sql` to verify permissions.
  - Use the **SQL Editor** in Supabase to test queries as a specific user.
- **Edge Functions**:
  - **Local Logs**: If you are testing Edge Functions locally (via `supabase start`), use `supabase functions serve` to see real-time logs in your terminal.
  - **Production Logs**: Check **Edge Functions -> [Function Name] -> Logs** in the Supabase Dashboard to see runtime errors or `console.log` output.

### 5.3 Stripe Integration Debugging
- **Stripe Dashboard**: Use the **Developers -> Logs** section to see all API requests and their outcomes (Success/Failure).
- **Webhooks**: If user plans aren't updating after a successful purchase:
  - Verify the webhook signing secret (`STRIPE_WEBHOOK_SECRET`) is correctly set in Supabase Secrets.
  - Use the [Stripe CLI](https://stripe.com/docs/stripe-cli) to forward webhooks to your local environment:
    ```bash
    stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
    ```
- **Test Cards**: Always use [Stripe Test Cards](https://stripe.com/docs/testing) (e.g., `4242...`) when the environment is in test mode.

### 5.4 Environment Variables Debugging
- **Vite Prefix**: Ensure all environment variables used in the frontend start with `VITE_`. Variables without this prefix will not be exposed to the client code.
- **Restaring Vite**: If you change `.env.local`, you **must** restart the Vite development server for the changes to take effect.
