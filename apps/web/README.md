# PeerTemp Web

Vite + React + TanStack Query frontend for the PeerTemp ADK bot in this repo.

## Architecture

- **Actions as API** — every mutation calls a bot Action via `client.callAction`.
- **Tables as DB** — every dashboard read uses `client.findTableRows` (or read-model Actions like `getOrgDashboardBundle`, `listLeaderboard`, `getMemberProfile`).
- **Type generation** — `src/types/index.ts` triple-slash references `../../../.adk/*.d.ts` so any schema change in the bot fails TypeScript here.

## Setup

```bash
cd apps/web
cp .env.example .env       # fill in workspaceId / botId / PAT
npm install
npm run dev                # http://localhost:5173
```

In a second terminal at the repo root:

```bash
adk dev                    # bot + dev console at http://localhost:3001
```

## Routes

| Hash           | Screen                      |
| -------------- | --------------------------- |
| `#`            | Organization dashboard      |
| `#gc/<id>`     | Group chat workspace + chat |
| `#member/<id>` | Member profile + trend      |
| `#reviews`     | Performance review center   |
| `#admin`       | Admin settings              |

The webchat embed in the GC workspace requires `VITE_BOTPRESS_WEBCHAT_CLIENT_ID`. Without it the panel renders a placeholder so you can still demo the rest of the UI.
