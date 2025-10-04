# Discord Integration (Proposed)

Add a Discord slash command `/post` for world-buff droppers. Submissions will flow to HCBuffs and designated Discord channels.

## Slash Command: `/post`
- **Description**: Post a scheduled buff drop.
- **Options**:
  - `faction` (required): `horde|alliance`
  - `buff` (required): `Onyxia|Zandalar|Nefarian|Rend`
  - `guild` (required): string
  - `datetime` (required): ISO8601 or `YYYY-MM-DD HH:MM` server time (ST)
  - `notes` (optional): string

## Flow
1. User invokes `/post`.
2. Discord sends an interaction to a Netlify function endpoint (e.g., `/.netlify/functions/discord-interactions`).
3. Function verifies the request signature (`X-Signature-Ed25519`, `X-Signature-Timestamp`) using the Discord public key.
4. On command, parse inputs, convert to ISO UTC, and call the existing `add-buff` logic to write to GitHub.
5. Respond ephemeral success/error to the invoker.
6. Broadcast a formatted message to configured Discord channels via bot token.

## Netlify Function: `discord-interactions`
- **Endpoint**: `POST /.netlify/functions/discord-interactions`
- **Env Vars**:
  - `DISCORD_PUBLIC_KEY` (required for signature verification)
  - `DISCORD_BOT_TOKEN` (required to send follow-up messages to channels)
  - `DISCORD_CHANNEL_IDS_HORDE` (comma-separated channel IDs for Horde announcements)
  - `DISCORD_CHANNEL_IDS_ALLIANCE` (comma-separated channel IDs for Alliance announcements)
  - `DISCORD_CHANNEL_IDS` (fallback; used if per-faction vars are empty)
  - `GITHUB_TOKEN` (already used by `add-buff`)
- **Responsibilities**:
  - Handle `PING` (type 1) with `PONG`.
  - Handle `APPLICATION_COMMAND` for `/post`.
  - Validate and normalize payload; map to `faction` file.
  - Invoke the add-buff workflow.
  - Post channel announcement.

## Example Announcement
```
[Horde] Onyxia at 7:30 PM ST — Guild: Aligned
Notes: backup head
https://hcbuffs.com
```

## Command Registration Script
- Create a Node script that registers the `/post` command via Discord REST API.
- Env: `DISCORD_APP_ID`, `DISCORD_GUILD_ID` (for dev), `DISCORD_BOT_TOKEN`.
- Endpoint: `PUT https://discord.com/api/v10/applications/{app_id}/guilds/{guild_id}/commands`

## Security
- Verify all Discord requests by signature.
- Rate-limit per user/guild if necessary.
- Validate date parsing; convert to ISO UTC.
- Do not expose admin-only endpoints publicly without auth.

## Future Enhancements
- `/update` and `/delete` commands
- Autocomplete for guild names
- Per-server channel mappings
