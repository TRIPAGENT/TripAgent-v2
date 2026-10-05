# Chat with Tara through WhatsApp

The personal profile (Membership) includes **Tara on WhatsApp**, using the same agent and member account as the web chat.

A member enters their WhatsApp number with country code, then sends a prepared one-time message to TripAgent. The server verifies that it came from that number, links it to the signed-in membership, and updates the profile to **Chat via WhatsApp**. The profile also supports disconnecting a number. Links expire in ten minutes.

The backend supplies availability, number and URLs. **No new frontend secrets are needed.** Keep `VITE_AGENT_URL` pointed at `TripAgent-v2-backend` and allow this frontend origin in its `APP_ORIGINS` setting. The existing `VITE_WHATSAPP_NUMBER` option is for a human Desk contact and does not control Tara's verified connection.

Web and WhatsApp history belongs to the same member. Each other member has a separate history and model context. Saved WhatsApp replies appear in the web conversation while the app is visible or when it comes back into view. Media transcription is not included.

Backend API calls all require the existing member session:

| Endpoint | Behavior |
| --- | --- |
| `GET /api/whatsapp` | Availability and the member's own connection status; number is masked |
| `POST /api/whatsapp/link` | `{ "phone": "+91…" }`; short-lived phone-bound WhatsApp URL |
| `POST /api/whatsapp/link/cancel` | Invalidates a pending account link |
| `POST /api/whatsapp/unlink` | Disconnects the member's own number and cancels pending replies |

The backend stores history and WhatsApp queues in a private Postgres schema, while existing member memory and itinerary files remain on its persistent disk. Deploy one long-lived backend process. See the complete [backend setup guide](../../TripAgent-v2-backend/docs/WHATSAPP-SETUP.md) for Supabase, ACL onboarding, callback signing, deployment settings and live acceptance checks.
