# Twitch Clips Utility (`twitchclips.py`)

Generates a static `twitch_clips.html` file containing embedded Twitch top clips for WoW.

## Functions
- `get_access_token()`
  - Client credentials grant; returns bearer token.
- `fetch_wow_clips(token)`
  - Fetches clips for `GAME_ID=18122` for the last 7 days, paginated.
- `generate_embed_html(clips, num_clips=10, domain="hcbuffs.com")`
  - Renders an HTML grid of the top `num_clips` by `view_count` using the given `parent` domain.
- `main()`
  - Orchestrates token, fetch, render; writes `wowbuffs/twitch_clips.html` and logs counts.

## Usage
```bash
python3 twitchclips.py
```

## Output
- Writes `wowbuffs/twitch_clips.html` with a `.clips-wrapper` container of iframes.

## Notes
- Configure `CLIENT_ID`/`CLIENT_SECRET` securely via environment variables in production; do not commit secrets.
