# SmartQueue — Frontend (React + TypeScript + Tailwind + Vite)

```bash
npm install
npm run dev      # http://localhost:5173
```

**Demo logins** — password `Demo@1234`
| Role | Email |
|---|---|
| Admin (Apollo Hospital, code `SQ-HOSP-1024`) | admin@smartqueue.com |
| Staff | staff@smartqueue.com |
| Customer | customer@smartqueue.com |

## How it works
`src/services/store.ts` is a **mock backend** (localStorage) so every workflow functions without a server:
- Roles/org are derived from the session user, never from form input (customers can only self-register; staff are created only in Admin → Staff).
- Every admin/staff function is scoped to the caller's organization (data isolation).
- "Real-time": all views subscribe to store changes; changes also sync across browser tabs (open customer + staff in two tabs and click NEXT CUSTOMER).
- Organization types live in `TYPES` — add a new entry to support a new type.

## Connecting the Express/MongoDB/Socket.IO backend
Replace the exported functions in `store.ts` with `fetch('/api/...')` calls (send the JWT in `Authorization`) and replace `subscribe/commit` with a Socket.IO listener that triggers re-render. Component code stays unchanged.

Structure: `components/ layouts/ pages/ services/ utils/ hooks/ context/` (state lives in `services/store.ts`).
