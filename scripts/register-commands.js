const fetch = require('node-fetch');

const APP_ID = process.env.DISCORD_APP_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID; // optional if doing global
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

if (!APP_ID || !BOT_TOKEN) {
  console.error('Please set DISCORD_APP_ID and DISCORD_BOT_TOKEN (and DISCORD_GUILD_ID for guild registration).');
  process.exit(1);
}

// Helper function to calculate server time and format dates
function getServerTime() {
  const now = new Date();
  // Simple DST check - this is approximate for server time (America/Denver)
  const isDST = now.getMonth() >= 2 && now.getMonth() <= 10; // Rough DST period
  const offset = isDST ? -6 : -7; // ST offset from UTC
  return new Date(now.getTime() + offset * 60 * 60 * 1000);
}

function formatDate(date) {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

// Generate date choices with actual dates
const serverTime = getServerTime();
const dateChoices = [
  { name: `Today (${formatDate(serverTime)})`, value: 'today' },
  { name: `Tomorrow (${formatDate(new Date(serverTime.getTime() + 24 * 60 * 60 * 1000))})`, value: 'tomorrow' },
  { name: `Day After (${formatDate(new Date(serverTime.getTime() + 48 * 60 * 60 * 1000))})`, value: 'day_after' },
  { name: `In 3 Days (${formatDate(new Date(serverTime.getTime() + 72 * 60 * 60 * 1000))})`, value: 'in_3_days' },
  { name: `In 4 Days (${formatDate(new Date(serverTime.getTime() + 96 * 60 * 60 * 1000))})`, value: 'in_4_days' },
  { name: `In 5 Days (${formatDate(new Date(serverTime.getTime() + 120 * 60 * 60 * 1000))})`, value: 'in_5_days' },
  { name: `In 6 Days (${formatDate(new Date(serverTime.getTime() + 144 * 60 * 60 * 1000))})`, value: 'in_6_days' },
  { name: `In 7 Days (${formatDate(new Date(serverTime.getTime() + 168 * 60 * 60 * 1000))})`, value: 'in_7_days' }
];

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
      name: 'time',
      description: 'Time for the buff drop (HH:MM server time, e.g., 19:30 or 7:30 PM)',
      type: 3,
      required: true
    },
    {
      name: 'date',
      description: 'Date for the buff drop',
      type: 3,
      required: true,
      choices: dateChoices
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
      console.error('Full error details:', JSON.stringify(data, null, 2));
      process.exit(1);
    }

    console.log('Slash command registered:', data);
  } catch (e) {
    console.error('Error registering slash command:', e);
    process.exit(1);
  }
})();
