# Chat acknowledgement and travel options

Tara acknowledges the member's own message with a small emoji receipt beneath the bubble. Sending shows **⏳ Sending…**. Only the authenticated backend's accepted job changes that to **👀 Received · next in line** or **👀 Tara is on it**. Completed turns show **✅ Answered**; interrupted accepted turns show **👀 Received · reply interrupted**. A request without confirmation shows **Receipt not confirmed · retry**, with an editable review action. Retrying the same pending request reuses its ID rather than adding another bubble.

Receipts survive navigation through the shared chat runtime. History loaded from the backend confirms receipt. Member changes clear the active job, and late responses from a previous member cannot update the current thread. Receipts are UI status, not added AI messages.

After a reply, **Explore with Tara** offers **Compare stays**, **Flights & routes**, **Experiences**, and **Budget & dates**. Each control prepares an editable question in the same conversation and preserves any existing draft; it does not send a request automatically. Prompts refer to the current conversation rather than assuming the app's default city is the destination. Existing itinerary cards and Journeys remain the place to review saved plans.

This provides a conversation flow for later marketplace suggestions. Future offer cards should use real source/quote identifiers, show their verified terms, and pass the chosen option back into this same member conversation. The current controls request advice from Tara; they do not represent live inventory, reserve a room, charge a card or create a booking.

Saved itinerary replies open the member's document in Journeys. WhatsApp history triggers the same refresh as a web chat delivery; Journeys also refreshes while visible. A late response for another member cannot replace the current member's list.

Each itinerary has an inline action as well as its bottom action: **Send for a price** before pricing, **Review quote & pay** after the Desk releases a quote, and booking details after confirmed payment. Checkout revalidates the member, current quote, hold expiry and itinerary revision with the backend before opening the Desk-issued payment link. The Desk must provide that link and confirmed terms; opening it does not record a successful payment. See the backend's `docs/ITINERARY-CHECKOUT.md` for the operator workflow.
