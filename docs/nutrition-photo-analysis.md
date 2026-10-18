# Meal photo preview

Automatic meal-photo analysis is disabled in this temporary Android/local-only build. The app can preview a selected JPEG, PNG, or WebP image locally, but does not upload it, store it as a health record, or call an AI service.

Manual meal entry and typical-meal estimates remain available. Do not represent local photo preview as automatic nutrition analysis.

Re-enabling analysis requires a remote authenticated server endpoint, explicit consent, provider-term review, abuse controls, and server-side secret storage. Never put provider API keys in browser code or a `NEXT_PUBLIC_*` variable.
