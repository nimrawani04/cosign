# CoSign

CoSign helps a buyer delegate product discovery while keeping control over the final purchase. A buyer describes a request, reviews and locks a spending policy, and lets the shopping and review agents find candidate products. CoSign checks the trusted catalog, merchant, price, shipping, return window, and agent assessments before a buyer can approve checkout.

## What the app does

- **Purchase requests:** create a request and lock a policy with a budget, currency, merchant restrictions, required specifications, and return requirements.
- **Agent review:** discover catalog products, assess security and payment risks, and evaluate each proposal against the locked policy.
- **Screenshot tools:** scan one listing or compare up to six listing screenshots against the policy. A ranked listing can be co-signed only after a server-side re-scan, trusted catalog match, and the usual proposal checks.
- **Buyer approval and payments:** revalidate an eligible proposal at approval. PayPal orders remain pending until the buyer approves at PayPal and the app verifies and captures the order. Without PayPal credentials, real purchases fail closed; the security lab remains simulated.
- **Dashboard:** view purchase requests, eligible requests awaiting a co-sign, captured purchases, and recorded screenshot scan counts.
- **Security lab:** run simulated adversarial purchase scenarios without charging a payment method.

The web app uses TanStack Start/React and Supabase for authentication and persisted purchase records. Privileged database operations and PayPal credentials stay on the server. AI assists with extraction and assessments; deterministic policy checks control eligibility.

## Run the web app

Requirements: Node.js and npm (or Bun).

```sh
npm install
npm run dev
```

Connect the Supabase project and configure its server environment before using authenticated features. The browser needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; the server needs `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. AI-backed features also need the AI provider configuration used by `src/server/ai.server.ts`.

To enable PayPal checkout, add server-side `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENVIRONMENT` (`sandbox` or `live`), and `APP_URL` (the public origin, for example `https://app.example.com`). Use sandbox credentials first. Never put a PayPal secret or Supabase service-role key in a `VITE_` variable or Android app. The live PayPal account and production credentials must be supplied by the operator; this repository does not contain them.

## Android app

`android/` contains a small native Kotlin Android shell for the hosted CoSign web app. It provides Android back navigation, retains the web session through the system WebView cookie store, supports screenshot file selection, and hands PayPal/external links to the system browser. It does not embed backend or payment secrets.

Open `android/` in Android Studio, set `COSIGN_URL` in `android/gradle.properties` (or pass `-PCOSIGN_URL=https://your-public-app-url` to Gradle), then run the `app` configuration on a device or emulator. For development against a computer-hosted Vite server, use an emulator-reachable address such as `http://10.0.2.2:5173`; configure that development URL explicitly. The app restricts ordinary navigation to HTTPS except for this explicitly configured development URL.

## Project layout

- `src/routes/` — public, authenticated, request detail, and dashboard pages.
- `src/lib/api/` — authenticated server functions.
- `src/server/` — purchase pipeline, AI prompts, and PayPal server integration.
- `src/lib/cosign/` — deterministic policy and screenshot assessment logic.
- `src/integrations/supabase/` — Supabase clients and generated database types.
- `supabase/` — Supabase project configuration.
- `android/` — Kotlin Android WebView app shell.

