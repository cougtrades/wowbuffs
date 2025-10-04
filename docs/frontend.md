# Frontend Client Reference (`script.js`)

This file powers the public HCBuffs site.

## Globals
- `buffs`, `pastBuffs`, `groupedBuffs`: in-memory arrays of buff entries
- `faction`: "horde" | "alliance"
- `selectedBuffTypes`: ["all"] or subset of ["onyxia","zandalar","nefarian","rend"]
- `selectedTimezone`: timezone string persisted in localStorage
- `showLocalTime`: boolean persisted in localStorage

## Public UI Behaviors
- `updateFaction(selected)`
  - Switches faction, toggles UI styles, hides `rend` for alliance, reloads data.
- `updateBuffType(type)`
  - Multi-select buttons for filtering buffs; ensures 'all' toggling logic.
- `updateTimezone()`
  - Persist timezone and re-render.
- `toggleTimeFormat()`
  - Toggle between server time and local time in UI.
- `searchBuffs()`
  - Filters displayed buffs by time, guild, buff, or notes within Today/Tomorrow.

## Data Loading
- `fetchWithCache(url, etagKey)`
  - Uses ETag caching to avoid reloading unchanged JSON.
- `loadBuffs()`
  - Loads `{faction}_buffs.json`; also merges Zandalar from the other faction; splits into future (`buffs`) and past (`pastBuffs`).

## Rendering
- `groupBuffsByDate()` and `displayBuffs()`
  - Groups by day (Today/Tomorrow/Date), renders cards, and sets up click-to-expand.
- `updateAllCountdowns()`
  - Updates per-card countdown timers.
- `startCountdown()`
  - Animation loop for global timer and notifications with 10-minute alerts (Onyxia includes sound).

## Utility
- `formatDateTime(date, isServerTime)` and `formatCountdown(buffDate)`
- `handleVisibilityChange()` pauses when the tab is hidden.

## Admin page behaviors (in `buff-tracker.html`)
- Builds and validates entries, converts to UTC server time, calls Netlify functions:
  - `/.netlify/functions/add-buff`
  - `/.netlify/functions/update-buffs` (note: page calls `update-buff`, ensure consistency if renamed)
  - `/.netlify/functions/delete-buff`
  - `/.netlify/functions/cleanup-buffs`

## Data Object Shape
```json
{
  "datetime": "2025-03-26T01:30:00Z",
  "guild": "Aligned",
  "buff": "Onyxia|Zandalar|Nefarian|Rend",
  "notes": "optional",
  "server": "Doomhowl"
}
```
