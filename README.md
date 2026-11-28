# Dermalens AI

Dermalens AI is a React and Vite demonstration of an AI-assisted skin assessment experience for dermatology clinics. It supports camera capture, gallery upload, patient details, preliminary Gemini observations, general morning/evening skincare suggestions, a printable three-page report, and WhatsApp consultation booking.

AI output is informational only and is not a diagnosis or prescription. It should not replace assessment by a qualified dermatologist.

## Demonstration clinic profile

Update the demonstration dermatologist and clinic values in [`src/config/clinic.js`](./src/config/clinic.js). Profiles are keyed by ID and the active demonstration profile is selected there. The report snapshots the active profile with each in-memory assessment. Leave unknown values empty; the app omits optional fields rather than filling in invented information. Platform contact details are separate from the treating dermatologist.

## Gemini configuration

Gemini requests use the official `@google/genai` SDK on the server side through `api/analyze-skin.js` (`gemini-3.1-flash-lite` for pre-scan face and image quality validation, and `gemini-4-hydrogen` with automatic cross-model fallback and exponential-backoff retries for skin observations). Never put a Gemini key in frontend code or a `VITE_` variable.

1. Set `GEMINI_API_KEY` in Vercel under **Project Settings → Environment Variables** for **Production**, **Preview**, and **Development**.
2. For local development, copy `.env.example` to `.env.local` (or `.env`), set `GEMINI_API_KEY`, and run `npm run dev` (which starts `server.js` serving both the Vite frontend and `/api/analyze-skin` on port 3000).
3. `vercel.json` configures `maxDuration: 60` for `api/analyze-skin.js` so multi-stage requests and temporary error retries complete reliably on Vercel.

The browser resizes images before submission. The API accepts JPEG, PNG, and WebP images up to 2.5 MB after resizing, and checks their file signatures. Patient name, age, phone, and location are not sent to Gemini; only the image is.

## Demonstration scope and privacy

This phase is a stateless demonstration: patient details, images, and reports are held only in the current browser session and are not saved to a patient database. There is no authentication or role-based access control, so this is not ready for storing real patient records or multi-dermatologist production use. Configure authentication, tenant-scoped server-side storage, and appropriate privacy controls before using it as a clinical SaaS.

## Commands

Use Node.js 22 or newer for the Google Gen AI SDK.

```sh
npm install
npm run dev
npm run lint
npm run build
```

Deploy the Vite app and `api/` function to Vercel. Add `GEMINI_API_KEY` as a server-side environment variable in **Project Settings → Environment Variables** (Production, Preview, and Development), then redeploy.
