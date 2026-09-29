# Presenting TripAgent, start to end

About 15 minutes. It runs entirely on this laptop, using the production build, which is exactly what members will get from Vercel.

## Before you start (5 minutes)

```bash
# 1. put the demo members back at the start of the story
cd "Chatbot_v1/tripagent" && npm run demo:reset

# 2. build and host everything
cd "../../TripMate - App" && npm run present
```

`npm run present` prints the addresses. Open two windows side by side:

| Window | Address | Who you are |
|---|---|---|
| **Member**: Chrome, device toolbar on (⌥⌘I, then ⇧⌘M, iPhone 14 Pro) | http://localhost:4173 | The member |
| **Desk** | http://127.0.0.1:3000/ops | The advisor |

To show it on a real phone on the same Wi-Fi, run `npm run present -- --lan` and open the "On a phone" address it prints.

**Codes:** use `RK4821MP` (Rohan K.), who has five itineraries ready to book. `EV2410VC` (Eleanor Vance) has two London itineraries.

**Costs:** each AI desk reply costs about $0.21 (the last 30 days: 46 replies, $9.60). The live spend is at http://127.0.0.1:3000/usage. Everything in the walkthrough except step 4 costs nothing.

## The story

### 1. The door

Type `RK4821MP`.

- The code is checked by the server. An unknown code is refused, and repeated guessing is locked out for ten minutes.
- The app holds no list of members, so a stranger reading its code learns nothing.
- Say: *"By invitation, and by name. Nobody self-registers."*

### 2. Home

- The four portrait frames rotate: *Someone who travels with you*, then *The front of the plane*, *A room that's expecting you*, and *Looked after, until you are home*.
- One search: "Which city would you like to go to?"
- Scroll to **When are you free?** and pick a month to see the places at their best then, with flight time and visa on each card.
- Scroll to **The world, within reach.** Tap **Alpine Europe** and the map flies there. Pinch or drag, then **tap Zurich**: it opens Zurich's guide directly.

### 3. A city, deciding

In Zurich (or any city):

- The facts: best months, ideal length, flight time from India, visa.
- **Where to stay**, by tier. Every address carries the award that earned it, sourced and dated.
- **Rooms for your dates**: pick dates and tap **Check live rates**.
  - Today it says live rates are not switched on yet, because Tripsure's IP allow-list is pending.
  - **Ask for a rate** sends the request to the desk. It appears in the Desk window within seconds.
- Tap the bookmark on a hotel. There is one verb, *Save*, and the AI desk reads everything saved.

### 4. The AI desk (optional, costs about $0.21 a reply)

- **Desk** tab, then type "What would you suggest for late October, two of us?"
- It answers from our own 110 guides and the member's saved places.
- A full itinerary takes one to two minutes to build. For the demo, use the ones already built, in step 5.

### 5. The itinerary

Open the **Planner** tab and pick **Korea in late October, end to end** from the trip switcher. It has three flights and three stays.

- **Plan** tab: the recommended flight and stay for each leg, each with two alternatives. **Swap** changes the pick, and the swap is remembered.
- Names show "Rate to confirm" until the desk prices them. The app never invents a fare.
- **Days** tab: day by day, paced to the member's answers.
- Tap **Send for a price**.

### 6. Asking for the price

- The request lists exactly what is being priced, including any swaps. There is a note to the advisor (floors, allergies, arrival times).
- **Terms of this booking**: who you pay (Tripsure, one accountable company), when a price holds, and where refunds go.
- Tap **Send for a price**. A reference such as `TA-7KQ3PX` appears, showing *With your advisor*.

### 7. The desk answers (Desk window)

The request is at the top of `/ops`.

1. Tap **Start pricing**. Within 15 seconds the member's screen moves to *Being priced*.
2. Open **Release a quote** and fill it in:
   - **Lines**, one per row, as `label | amount`:
     ```
     Delhi to Seoul, business, two travellers | 412000
     Four Seasons Seoul, 4 nights, taxes included | 298000
     ```
   - **Held until:** 48 hours is filled in.
   - **Payment link:** in production, the Tripsure/Razorpay link. For the demo, `https://example.com/pay` is fine.
   - **Cancellation terms**, and a line to the member.
3. Tap **Release to the member**.

### 8. Saying yes (Member window)

The request now reads **Your price is ready**, with the total and the time left on the hold. Tap **Review and pay**:

- Every line, the total, the hold time, and this quote's cancellation terms.
- **Pay securely** opens the payment page. The app never takes card details.
- Tap **I have paid**. The desk sees the member's note.

In the Desk window, tap **Payment received: mark paid**. The member's screen then shows **Paid. It is being booked.** That:

- switches on the trip's reminders (visa, check-in, each day);
- changes the Planner's button to *Booked*;
- offers **Take it to WhatsApp**: the member gives a number and the desk sees the handover request.

### 9. A person, whenever wanted

- **Talk to advisor** (the dock on every screen): choose a time, add a note, tap **Request the call**. It appears in the desk inbox.
- **Account** holds the membership terms, privacy and refund pages, and the company details.

### 10. Close on the desk

At the bottom of `/ops`, **Issue a code** for a new member, for example "Meera Iyer", tier Black. Their code appears once. Sign out in the member window and sign in with it. This is how selling starts.

## What is real today, and what is next

| | Status |
|---|---|
| Sign-in, sessions, member codes | Live on the server |
| Guides, months, map, 110 cities, photography | Live |
| AI desk and itineraries | Live (Anthropic); about $0.21 a reply |
| Booking request, desk inbox, quote, paid | Live, run by a person at `/ops` |
| Payment | A Tripsure/Razorpay link the desk attaches to each quote |
| **Tripsure live hotel rates** | Built; waiting on Tripsure to allow-list the server's IP (see DEPLOY.md) |
| WhatsApp | The advisor messages from the business number; no automated sending yet |

## If something goes wrong on the day

- **"We cannot reach the desk"** means the agent is not running. Stop `npm run present` and start it again.
- **The AI desk says it is unavailable:** the model key is missing from `Chatbot_v1/tripagent/.env`. The rest of the walkthrough still works.
- **To start the story over**, run `npm run demo:reset` in `Chatbot_v1/tripagent`, then sign out and back in.
