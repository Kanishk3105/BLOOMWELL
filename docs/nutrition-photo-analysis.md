# Meal photo analysis

BloomWell sends a selected meal image to Google Gemini only after the user checks the consent box and chooses **Analyze with Gemini**. The photo is processed by the server route and is not saved to the user's BloomWell profile. Google's handling depends on the Gemini API service terms and billing status: under unpaid services, Google may use submitted content to improve services and human reviewers may process it. The UI links to Google's current terms and warns users not to upload sensitive, confidential, or personal information. BloomWell cannot verify the project's billing status or guarantee Google's data handling; configure an appropriate paid service and review the terms before enabling this feature for real users.

The returned calories, macronutrients, and potential nutrient sources are estimates; users should review the portion and edit the values before saving. Photo analysis should not be used for medical or dietary decisions that require accurate measurements.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set `GEMINI_API_KEY` to a Google Gemini API key in `.env.local`.
3. Restart the Next.js server.

Keep the key server-side. Do not add a `NEXT_PUBLIC_` prefix or commit `.env.local`. Use a Google Cloud project with active billing if you need the paid-service data terms; this application does not detect whether billing is enabled.

The route accepts JPEG, PNG, and WebP images up to 8 MB, verifies the signed-in Supabase account before calling Gemini, and currently uses `gemini-3.8-flash`. It applies an in-memory limit of eight requests per account per hour as a basic safeguard. That limit is per server process and is not a substitute for durable, shared rate limiting and abuse monitoring before exposing a paid Gemini-backed endpoint to the public.
