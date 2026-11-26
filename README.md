# Dermalens AI

Dermalens AI is a React and Vite demonstration of an AI-assisted skin assessment experience for dermatology clinics. It supports camera capture, gallery upload, patient details, preliminary Gemini observations, general morning/evening skincare suggestions, a printable three-page report, and WhatsApp consultation booking.

AI output is informational only and is not a diagnosis or prescription. It should not replace assessment by a qualified dermatologist.

## Demonstration clinic profile

Update the demonstration dermatologist and clinic values in [`src/config/clinic.js`](./src/config/clinic.js). Profiles are keyed by ID and the active demonstration profile is selected there. The report snapshots the active profile with each in-memory assessment. Leave unknown values empty; the app omits optional fields rather than filling in invented information. Platform contact details are separate from the treating dermatologist.

## Gemini configuration

Gemini requests use the official `@google/genai` SDK and the vision-capable `gemini-3.8-flash` model through the Vercel serverless function at `api/analyze-skin.js`. Never put a Gemini key in frontend code or a `VITE_` variable.

1. Revoke and replace any Gemini key that was previously placed in browser-accessible source.
2. Set `GEMINI_API_KEY` in the Vercel project’s server-side Environment Variables.
3. For local serverless testing, copy `.env.example` to `.env.local`, set the key there, then run `npx vercel dev`.
4. `npm run dev` starts the Vite frontend only; it does not serve the Vercel `/api/analyze-skin` function.

The browser resizes images before submission. The API accepts JPEG, PNG, and WebP images up to 2.5 MB after resizing, and checks their file signatures. Patient name, age, phone, and location are not sent to Gemini; the image is.

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

Deploy the Vite app and `api/` function to Vercel. Add `GEMINI_API_KEY` as a server-side environment variable in each required Vercel environment, then redeploy. A real Gemini result cannot be shown until a valid key is configured and an image is submitted through the deployed function.
