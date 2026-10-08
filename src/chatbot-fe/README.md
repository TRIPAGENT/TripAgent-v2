# chatbot-fe chat, with the Tara design

This folder is the chatbot-fe chat (https://github.com/tripagentlaunch/chatbot-fe, branch `dev`, commit
`78be52f`) with our design and extras applied on top. It is laid out like chatbot-fe's own `src/`, so it
can be copied back into that repo as it is. It runs inside this app on the `/concierge` route.

| File | State |
|---|---|
| `api/client.ts`, `types/index.ts` | **Upstream, unchanged.** |
| `pages/Chat.tsx` | Upstream's chat logic (history, streaming, chat id), plus design and extras (below). |
| `components/ChatInput.tsx` | Upstream's input, now controllable from the page, with dictation and the composer design. |
| `components/MessageBubble.tsx` | Upstream's bubble, with the white / frosted-glass design, failed and streaming states. |
| `design/` | **Ours.** `chat.css` (plain CSS, every class prefixed `tc-`), `icons.tsx`, `MeshBackdrop.tsx`, `mesh/` (the mesh-gradient kit). |
| `ChatbotScreen.tsx` | **This app only. Do not copy to chatbot-fe.** Copies the app's session token to chatbot-fe's token key, turns router state from other screens into the chat's `seed`, and wires Back / Call. |

To see exactly what we changed against upstream:

    git diff chatbot-fe/dev:src/pages/Chat.tsx src/chatbot-fe/pages/Chat.tsx

(the remote is `chatbot-fe`; `git fetch chatbot-fe` first).

## What we added on top of upstream

Design: mesh-gradient background, frosted header with back and call buttons, white member bubbles,
frosted-glass Tara bubbles, composer with dictation, no tab bar.
Behaviour: a retry for a failed reply, Tara's name once above a run of replies, day dividers, a row of
suggestions that fill the box, a greeting when the chat is empty, and a `seed` so other screens can open the
chat with a line sent or typed.

Props on `Chat` (all optional, so it still works with none): `memberName`, `onBack`, `onCall`, `onAuthError`, `seed`.

## Moving it to chatbot-fe

Copy `api/`, `types/`, `components/`, `pages/` and `design/` over chatbot-fe's `src/`; not `ChatbotScreen.tsx`.
The chat needs the fonts Jost and Fraunces on the page (chatbot-fe's `index.html` would need the same
`<link>` this app's has). No new npm packages are needed.

## The old chat

`src/screens/Concierge.tsx` is the chat as built before this, kept untouched for reference and switched off:
its route and import are commented out in `src/App.tsx`.

## Local setup

`.env.local` (git-ignored) sets `VITE_API_BASE_URL=/agent` so chatbot-fe's client goes through the dev proxy.
For the Python backend start the dev server with `AGENT_ORIGIN=http://127.0.0.1:8000`.
