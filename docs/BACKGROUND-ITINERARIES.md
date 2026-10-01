# Background itinerary delivery

Tara chat now uses the backend background-job endpoints. The runtime lives above routes so leaving chat does not lose the job; polling restores accepted messages and replies after reload. Members can send additions while the plan is generated. These are visibly queued and handled in order after the active reply, rather than running conflicting plan revisions simultaneously.

Itinerary cards recognise bare, Markdown and inline links, including older locally saved chat. They open the exact authenticated Journey document. Journeys refreshes on plan completion.

Flight cards can render an agreed route without made-up times. Web-price evidence appears next to the amount, with basis, unit, terms, source and checked date; all public rates remain indicative. Google Places is used for destination, daily-place and hotel imagery; property names are checked and attribution links displayed. Existing photography remains a labelled fallback when a matching image is unavailable.

Deploy the backend first and confirm `/health` reports `backgroundJobs: true`. Then deploy this frontend. Live search needs `SERPER_API_KEY` on the backend; no key belongs in Vite configuration. Setup and limitations are documented in the backend's `docs/WEB-PRICING-AND-BACKGROUND-PLANS.md`.

Validated with backend-controlled browser fixtures: background plan, queued meal preference, navigation away and reload, Markdown journey card, direct saved-plan opening, and sourced indicative room price. These checks do not substitute for live supplier/search accuracy checks.
