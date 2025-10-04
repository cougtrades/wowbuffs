const fetch = require('node-fetch');

const APP_ID = process.env.DISCORD_APP_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID; // optional if doing global
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

if (!APP_ID || !BOT_TOKEN) {
  console.error('Please set DISCORD_APP_ID and DISCORD_BOT_TOKEN (and DISCORD_GUILD_ID for guild registration).');
  process.exit(1);
}

const command = {
  name: 'post',
  description: 'Post a world-buff drop to HCBuffs',
  type: 1,
  options: [
    {
      name: 'faction',
      description: 'Faction',
      type: 3,
      required: true,
      choices: [
        { name: 'Horde', value: 'horde' },
        { name: 'Alliance', value: 'alliance' }
      ]
    },
    {
      name: 'buff',
      description: 'Buff type',
      type: 3,
      required: true,
      choices: [
        { name: 'Onyxia', value: 'Onyxia' },
        { name: 'Zandalar', value: 'Zandalar' },
        { name: 'Nefarian', value: 'Nefarian' },
        { name: 'Rend', value: 'Rend' }
      ]
    },
    {
      name: 'guild',
      description: 'Guild name',
      type: 3,
      required: true
    },
    {
      name: 'date',
      description: 'Date for the buff drop (YYYY-MM-DD format, e.g., 2024-01-15)',
      type: 3,
      required: true
    },
    {
      name: 'time',
      description: 'Time for the buff drop (HH:MM server time, e.g., 19:30 or 7:30 PM)',
      type: 3,
      required: true
    },
    {
      name: 'notes',
      description: 'Optional notes',
      type: 3,
      required: false
    }
  ]
};

(async () => {
  try {
    const base = 'https://discord.com/api/v10';
    const url = GUILD_ID
      ? `${base}/applications/${APP_ID}/guilds/${GUILD_ID}/commands`
      : `${base}/applications/${APP_ID}/commands`;

    const resp = await fetch(url, {
      method: GUILD_ID ? 'PUT' : 'POST',
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(GUILD_ID ? [command] : command)
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error('Failed to register command:', resp.status, data);
      process.exit(1);
    }

    console.log('Slash command registered:', data);
  } catch (e) {
    console.error('Error registering slash command:', e);
    process.exit(1);
  }
})();
