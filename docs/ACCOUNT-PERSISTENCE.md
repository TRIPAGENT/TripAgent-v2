# Customer account persistence

The signed session determines the customer for every server read and write. Login waits for account details, full chat history, and requests before opening the app. A failed restore displays a retry screen and never uploads empty defaults.

Preferences, saved cities/places, draft itinerary items, active city, booking context, latest plan reference and per-plan hotel/flight selections are stored in the member's `app-state.json` on the backend persistent disk. Actual itineraries and desk requests continue using their existing server stores. Logout clears the session and visible customer state, without deleting the server record. A fresh browser or another device restores the same member's data.

Edits send field patches immediately and retain an account-scoped retry journal in browser storage. Failed writes retry while signed in; signing in again resumes pending changes. The restore uses server values plus that customer's pending edits. Account switches discard in-memory data, reject late responses, and require a valid session before restoring the next account. Hotel/flight selections also populate the existing booking hand-off cache.

Completed conversations use stable message IDs shared by the background worker and history endpoint. Restoring history and polling the current job therefore do not duplicate bubbles or itinerary cards. The backend retains full conversation history; the last 40 entries alone go to the model. Older server history is read without a schema migration, including itinerary attachments. Messages already removed by the previous 40-entry archive limit cannot be reconstructed from that archive.

Existing signed-in browser preferences migrate on first restore where no server value exists. A server failure does not trigger migration or replace saved data.

Deploy the backend before the frontend: the app requires `/api/member-state`. Keep Render's persistent disk mounted at `/data`, with `MEMORY_ROOT=/data/memory` as configured in the Dockerfile. This remains a single-instance file-backed service.

Validation: backend authentication/isolation, restart restoration, simultaneous field patches, full history beyond 40 entries, stable message IDs and attachments; mobile browser logout/login, fresh browser, account switching, selected hotel, saved city, onboarding preference, and failed-restore retry.
