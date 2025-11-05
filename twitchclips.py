import requests
from datetime import datetime, timedelta, UTC
import json

# Twitch API credentials (read from environment)
import os
CLIENT_ID = os.getenv("TWITCH_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("TWITCH_CLIENT_SECRET", "")
GAME_ID = "18122"  # World of Warcraft game ID

# Get access token
def get_access_token():
    if not CLIENT_ID or not CLIENT_SECRET:
        raise RuntimeError("TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET are required in environment")
    url = "https://id.twitch.tv/oauth2/token"
    params = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "grant_type": "client_credentials"
    }
    response = requests.post(url, data=params)
    response.raise_for_status()
    return response.json()["access_token"]

# Fetch clips from the past 7 days
def fetch_wow_clips(token):
    url = "https://api.twitch.tv/helix/clips"
    headers = {
        "Authorization": f"Bearer {token}",
        "Client-Id": CLIENT_ID
    }
    # Date range: past 7 days (based on current date, March 21, 2025)
    end_date = datetime.now(UTC)
    start_date = end_date - timedelta(days=7)  # Changed from 30 to 7
    params = {
        "game_id": GAME_ID,
        "started_at": start_date.isoformat(),
        "ended_at": end_date.isoformat(),
        "first": 100  # Max clips per request
    }
    
    all_clips = []
    while True:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        data = response.json()
        all_clips.extend(data["data"])
        
        cursor = data.get("pagination", {}).get("cursor")
        if not cursor:
            break
        params["after"] = cursor
    
    return all_clips

"""Generate HTML embed code for top clips.

The Twitch embed requires specifying the parent domain. This should match the
site where the HTML will be hosted. Defaults to hcbuffs.com.
"""
def generate_embed_html(clips, num_clips=10, domain="hcbuffs.com"):
    # Sort clips by view_count and take top N
    top_clips = sorted(clips, key=lambda x: x["view_count"], reverse=True)[:num_clips]
    
    html = '<div class="clips-wrapper">\n'
    for clip in top_clips:
        embed_url = f"https://clips.twitch.tv/embed?clip={clip['id']}&parent={domain}"
        html += f'''    <div class="clip">
        <div class="clip-content">
            <iframe src="{embed_url}" frameborder="0" allowfullscreen="true" height="360" width="640"></iframe>
            <p>{clip['title']} by {clip['broadcaster_name']} ({clip['view_count']} views)</p>
        </div>
    </div>\n'''
    html += "</div>"
    return html

def main():
    try:
        token = get_access_token()
        clips = fetch_wow_clips(token)
        embed_html = generate_embed_html(clips, num_clips=10, domain="hcbuffs.com")
        
        # Save to a file for use in your website
        with open("twitch_clips.html", "w") as f:
            f.write(embed_html)
        print("Generated twitch_clips.html with top 10 clips.")
        print(f"Total clips fetched: {len(clips)}")
        
    except requests.RequestException as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
