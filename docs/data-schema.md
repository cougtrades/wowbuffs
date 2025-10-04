# Data Schema

Two files in the repo serve as the public source of truth:
- `horde_buffs.json`
- `alliance_buffs.json`

Each contains an array of buff entries. Files are updated by Netlify functions via the GitHub Contents API.

## Entry
- `datetime` (string, ISO 8601 UTC, e.g., `2025-03-26T01:30:00Z`)
- `guild` (string, human-readable guild name)
- `buff` (enum: `Onyxia` | `Zandalar` | `Nefarian` | `Rend`)
- `notes` (string, optional)
- `server` (string, e.g., `Doomhowl`)

## Sorting
- Arrays are kept sorted ascending by `datetime` after inserts/updates.

## De-duplication
- Frontend dedupes in-memory by compound key: `datetime + guild + buff`.
- Server-side functions match by normalized `datetime` (to ISO), `guild` (lowercased/trimmed), and `buff`.

## Retention
- `cleanup-buffs` removes entries older than 24 hours.

## Example
```json
[
  {
    "datetime": "2025-03-26T01:30:00Z",
    "guild": "Aligned",
    "buff": "Onyxia",
    "notes": "backup head",
    "server": "Doomhowl"
  }
]
```
