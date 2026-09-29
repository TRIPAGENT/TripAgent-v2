# Would I book through this? — an HNI walkthrough

25 September 2026. Walked end to end as a member: invitation code → home →
month → city → map → wishlist → desk → itinerary → booking request → desk
window → settlement → handover. Signed in as the demo member, on a phone-sized
screen, against the live agent.

## The verdict

**I would plan a trip here. I would not yet pay for one here.**

Everything up to the itinerary earns trust: the photography is ours, every
address carries the award that earned it, the desk answers from our own guides,
and the copy never oversells. The moment money is involved, the app asks me to
commit to a trip it cannot yet price, run by people it cannot yet name, through
a payment step that tells me it is simulated. A member spending ₹8–15 lakh will
stop there and pick up the phone — which is fine, as long as there is a real
phone to pick up.

## Where it earns confidence

- **It opens like a private house, not a booking site.** The code at the door,
  the carousel of our own lines and photographs, one search box.
- **Deciding is fast.** Month → the places at their best → flight time and visa
  on the card. I knew whether a trip was feasible before opening anything.
- **The guide is evidence, not marketing.** "MICHELIN Three Keys (2025)",
  "World's 50 Best Hotels 2025, No. 15" — sourced, dated, specific.
- **The desk behaves like a good advisor.** Short, calm, answers "where in March"
  from our catalogue, opens with "shall I plan around what you saved?".
- **The itinerary is now one clean document** — one pick per flight and stay, two
  alternatives a tap away, swaps remembered, and the booking request lists what I
  actually chose.
- **It tells the truth.** "Indicative until quoted. Once quoted, it holds."

## What stops me paying — ranked

**1. There is no price I can say yes to.** Every flight and hotel is "Not checked";
the booking request says "To quote" on every line. That is the honest state until
Tripsure is wired in, and the agent is right not to invent fares — but it means the
app cannot close a sale on its own. *Needs: the Tripsure quote, with its validity
window shown ("held until Thursday 6pm").*

**2. The options say "unverified" in their own names.** 82 of 93 options the agent
has written read like *"The Marylebone (candidate — rate and availability
unverified)"*. Honest, but it reads as doubt about the hotel, not about the rate.
*Needs: a clean name, with verification shown as a separate small state — the
schema should carry `verified` and `checked` rather than the name carrying it.*
This is an agent-output change, not a design one.

**3. Three screens tell me it is a demo.** "Use the demonstration code" on the
door; "Simulate rate release" on the desk window; "The payment rail is not yet
connected… simulated and nothing is charged" on the payment step. Each is correct
for testing and fatal in front of a member. *Needs: behind a build flag, gone in
production.*

**4. No named human.** The advisor screen is "The desk", which is honest — but an
HNI hands over this much money to a person. *Needs: a named advisor with a real
number and hours, the moment one exists.* The call-booking screen also does not yet
send anything.

**5. Nothing says who I am paying or what happens if it goes wrong.** No company
name, no cancellation or refund terms per component, no mention of how the money is
protected. As merchant of record this is also a compliance question (see the
integration decisions). *Needs: one plain "Terms of this booking" panel on the
booking request — who, what is refundable, until when.*

**6. Two verbs for one idea.** "Save" and "Add to list" do nearly the same thing
and live on the same card. I was not sure which the desk would read. *Needs: one
action. The shortlist now sits inside the Wishlist, which is a start.*

**7. The wait is long.** A plan takes 75–120 seconds. It streams and says "Building
your plan", which is right — but a member with a plane to catch will not wait
twice. Worth showing the first day of the plan before the rest is done.

## What I changed today because of this

- The Planner is the itinerary and nothing else; the shortlist moved to Wishlist.
- The itinerary is the reference design, in our fonts, in the app and on the
  shared link alike, with swaps that carry through to the booking request.
- Booking a trip now switches on its reminders — and the reminders name what was
  booked (the swapped hotel, not the original pick).

## The order I would fix the rest in

1. Hide the three demo surfaces behind a build flag. *An afternoon.*
2. Clean option names; move verification into its own field. *Agent schema.*
3. A "Terms of this booking" panel. *Copy plus a decision on refunds.*
4. Tripsure quotes with a visible hold window. *The real unlock.*
5. A named advisor and a real number.

## Since then (25 September 2026, evening)

Walked the same path again, with money in mind.

1. **Demo surfaces are gone from production.**
   - The door no longer offers a demonstration code. Development builds keep a "fill the test code" link.
   - "Simulate rate release" and the simulated payment are removed. So are the Stitch claims that could not be backed: projected savings, "Haneda VIP Biometrics", "zero markups", "encrypted end-to-end", "wholesale institutional rates".
2. **Option names are clean.** "Rate to confirm" is a separate tag, and the booking request uses the clean name too.
3. **A "Terms of this booking" panel** sits on the request and on the quote:
   - who you pay: Tripsure, one accountable company;
   - when a price holds;
   - where refunds go: back to the original payment method;
   - how you pay: a Tripsure link, on Razorpay.

   The membership terms, privacy and refund pages come from tripagent.vip.
4. **A price I can say yes to.**
   - The desk releases a quote from its inbox (`/ops`): every line, the total, the hold time, cancellation terms and a payment link.
   - The member sees it within 15 seconds, with a real countdown, and pays through the link or on a call.
   - When the desk marks it paid, the trip is booked and its reminders begin.
   - Tripsure live rates are built into each city's "Where to stay" and switch on once Tripsure allow-lists the server's IP.
5. **A person behind every button.**
   - Call requests, enquiries and the WhatsApp handover all reach the desk's inbox.
   - The advisor screen gives the house's real address, maison@tripsure.com.
   - There is still no named advisor, and the app does not pretend there is.
6. **One verb.** "Add to list" is gone. Save is the only action, and the AI desk reads everything saved.

What would still stop me:

- **Live Tripsure rates** are waiting on Tripsure's IP allow-list.
- **Payment links** have to be real Tripsure links before the first member pays.
- **Someone must be watching `/ops`.**
