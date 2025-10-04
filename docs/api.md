# API Reference (Netlify Functions)

Base URL: `/.netlify/functions`

All endpoints require the environment variable `GITHUB_TOKEN` to be configured in the Netlify environment for write operations.

## add-buff
- **Endpoint**: `POST /.netlify/functions/add-buff`
- **Description**: Append a new buff entry to the appropriate faction JSON file in the GitHub repo and commit the change. The file is sorted by `datetime` ascending.
- **Request Body** (JSON):
```json
{
  "faction": "horde" | "alliance",
  "newBuff": {
    "datetime": "2025-03-26T01:30:00Z",
    "guild": "Aligned",
    "buff": "Onyxia" | "Zandalar" | "Nefarian" | "Rend",
    "notes": "optional",
    "server": "Doomhowl"
  }
}
```
- **Responses**:
  - 200: `{ "message": "Buff added successfully" }`
  - 400: `{ "error": "Missing faction or buff data" }`
  - 405: `{ "error": "Method not allowed" }`
  - 500: `{ "error": "GitHub token not configured" | "Failed to fetch/update file: ..." }`

- **Example**:
```bash
curl -X POST https://hcbuffs.com/.netlify/functions/add-buff \
  -H 'Content-Type: application/json' \
  -d '{
    "faction": "horde",
    "newBuff": {
      "datetime": "2025-03-26T01:30:00Z",
      "guild": "Aligned",
      "buff": "Onyxia",
      "notes": "backup head",
      "server": "Doomhowl"
    }
  }'
```

## update-buffs
- **Endpoint**: `POST /.netlify/functions/update-buffs`
- **Description**: Update an existing buff by matching normalized `datetime` (ISO), `guild` (case/whitespace-insensitive), and `buff` type, replacing it with `newBuff` and resorting.
- **Request Body** (JSON):
```json
{
  "faction": "horde" | "alliance",
  "oldBuff": {
    "datetime": "2025-03-26T01:30:00Z",
    "guild": "Aligned",
    "buff": "Onyxia"
  },
  "newBuff": {
    "datetime": "2025-03-26T02:00:00Z",
    "guild": "Aligned",
    "buff": "Onyxia",
    "notes": "delayed 30m",
    "server": "Doomhowl"
  }
}
```
- **Responses**:
  - 200: `{ "message": "Buff updated successfully" }`
  - 404: `{ "error": "Buff not found", "searchCriteria": {..}, "matchingGuildEntries": [..] }`
  - 400, 405, 500 similar to `add-buff`

- **Example**:
```bash
curl -X POST https://hcbuffs.com/.netlify/functions/update-buffs \
  -H 'Content-Type: application/json' \
  -d '{
    "faction": "horde",
    "oldBuff": {
      "datetime": "2025-03-26T01:30:00Z",
      "guild": "Aligned",
      "buff": "Onyxia"
    },
    "newBuff": {
      "datetime": "2025-03-26T02:00:00Z",
      "guild": "Aligned",
      "buff": "Onyxia",
      "notes": "delayed 30m",
      "server": "Doomhowl"
    }
  }'
```

## delete-buff
- **Endpoint**: `POST /.netlify/functions/delete-buff`
- **Description**: Delete an existing buff by normalized match of `datetime`, `guild`, and `buff`.
- **Request Body** (JSON):
```json
{
  "faction": "horde" | "alliance",
  "buff": {
    "datetime": "2025-03-26T01:30:00Z",
    "guild": "Aligned",
    "buff": "Onyxia"
  }
}
```
- **Responses**:
  - 200: `{ "message": "Buff deleted successfully" }`
  - 404: As above
  - 400, 405, 500 similar to others

- **Example**:
```bash
curl -X POST https://hcbuffs.com/.netlify/functions/delete-buff \
  -H 'Content-Type: application/json' \
  -d '{
    "faction": "horde",
    "buff": {
      "datetime": "2025-03-26T01:30:00Z",
      "guild": "Aligned",
      "buff": "Onyxia"
    }
  }'
```

## cleanup-buffs
- **Endpoint**: `POST /.netlify/functions/cleanup-buffs`
- **Description**: Removes buffs older than 24 hours from both faction files and commits the changes. Returns per-faction results.
- **Request Body**: none
- **Responses**:
  - 200: `{ "message": "Cleanup completed successfully", "results": { "horde": {..}, "alliance": {..} } }`
  - 405: Method not allowed
  - 500: Error details

- **Example**:
```bash
curl -X POST https://hcbuffs.com/.netlify/functions/cleanup-buffs
```

## discord-interactions
- **Endpoint**: `POST /.netlify/functions/discord-interactions`
- **Description**: Discord interactions endpoint that verifies signatures and handles the `/post` command, committing new buffs and broadcasting to channels.
- **Environment**: `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN`, `DISCORD_CHANNEL_IDS_HORDE`, `DISCORD_CHANNEL_IDS_ALLIANCE`, `DISCORD_CHANNEL_IDS` (fallback), `GITHUB_TOKEN`.
- **Interactions**:
  - `PING` (type 1): returns `PONG`.
  - `APPLICATION_COMMAND` (type 2): `/post` with options:
    - `faction`: `horde|alliance`
    - `buff`: `Onyxia|Zandalar|Nefarian|Rend`
    - `guild`: string
    - `datetime`: ISO UTC or `YYYY-MM-DD HH:mm` (server time)
    - `notes`: optional string
- **Response**: Ephemeral confirmation or error message to the invoker.

## Auth and Security
- Endpoints rely on `process.env.GITHUB_TOKEN` configured in Netlify to write to the GitHub repo via the GitHub Contents API.
- Client-facing forms/pages must be protected on the frontend as needed. Consider adding server-side auth if exposing write endpoints publicly.
