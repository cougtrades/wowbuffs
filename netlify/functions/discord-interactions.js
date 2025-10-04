const fetch = require('node-fetch');
const nacl = require('tweetnacl');
const { TextEncoder } = require('util');

// Utilities
function jsonResponse(statusCode, bodyObj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyObj)
  };
}

function getHeader(headers, name) {
  // Netlify lowercases header keys
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
}

function isIsoDatetime(input) {
  return /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.test(input);
}

function parseStToUtcIso(stString) {
  // Accept YYYY-MM-DD HH:mm or YYYY-MM-DDTHH:mm as Server Time (America/Denver)
  const m = stString.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!m) throw new Error('datetime must be ISO 8601 UTC or YYYY-MM-DD HH:mm in ST');
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);

  const offsetHours = isDenverDST(year, month, day, hour, minute) ? 6 : 7; // ST -> UTC
  const utcMs = Date.UTC(year, month - 1, day, hour + offsetHours, minute, 0, 0);
  return new Date(utcMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function isDenverDST(year, month, day, hour, minute) {
  // DST rules: second Sunday in March at 02:00 local, to first Sunday in November at 02:00 local
  const dstStartDay = nthWeekdayOfMonth(year, 3, 0, 2); // March, Sunday(0), 2nd
  const dstEndDay = nthWeekdayOfMonth(year, 11, 0, 1); // November, Sunday(0), 1st

  // Compare as YYYYMMDDHHmm numbers in local ST context
  const val = year * 1e8 + month * 1e6 + day * 1e4 + hour * 1e2 + minute;
  const startVal = year * 1e8 + 3 * 1e6 + dstStartDay * 1e4 + 2 * 1e2 + 0; // 02:00 local
  const endVal = year * 1e8 + 11 * 1e6 + dstEndDay * 1e4 + 2 * 1e2 + 0; // 02:00 local

  return val >= startVal && val < endVal;
}

function nthWeekdayOfMonth(year, month, weekday, n) {
  // month is 1-12, weekday 0-6 (Sun..Sat), n >=1
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const firstDow = firstOfMonth.getUTCDay();
  const delta = (weekday - firstDow + 7) % 7; // days from 1st to first desired weekday
  const day = 1 + delta + (n - 1) * 7;
  return day;
}

function capitalizeWord(word) {
  if (!word) return word;
  const lower = String(word).toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function normalizeBuffType(buff) {
  const b = String(buff).toLowerCase();
  switch (b) {
    case 'onyxia':
    case 'zandalar':
    case 'nefarian':
    case 'rend':
      return capitalizeWord(b);
    default:
      throw new Error('buff must be one of: Onyxia, Zandalar, Nefarian, Rend');
  }
}

async function commitNewBuffToGithub({ faction, newBuff }) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GitHub token not configured');

  const path = faction === 'horde' ? 'horde_buffs.json' : 'alliance_buffs.json';
  const fileUrl = `https://api.github.com/repos/cougtrades/wowbuffs/contents/${path}`;

  const getResp = await fetch(fileUrl, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json'
    }
  });
  const fileData = await getResp.json();
  if (!getResp.ok) throw new Error('Failed to fetch file: ' + (fileData && fileData.message));

  const currentContent = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));
  currentContent.push(newBuff);
  currentContent.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

  const putResp = await fetch(fileUrl, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json'
    },
    body: JSON.stringify({
      message: `Discord /post: add ${newBuff.buff} (${newBuff.guild}) to ${path}`,
      content: Buffer.from(JSON.stringify(currentContent, null, 4)).toString('base64'),
      sha: fileData.sha
    })
  });

  if (!putResp.ok) {
    const e = await putResp.json().catch(() => ({}));
    throw new Error('Failed to update file: ' + (e && e.message));
  }
}

function formatStTimeFromIso(iso) {
  // Return e.g. "7:30 PM ST" using America/Denver rules without tz libs
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const M = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  let hour = d.getUTCHours();
  const minute = d.getUTCMinutes();
  const isDst = isDenverDST(y, M, day, hour, minute); // use UTC components for boundary decision; ok approximation
  const offset = isDst ? -6 : -7; // UTC->ST hours offset
  // convert to ST hours
  const ms = d.getTime() + offset * 60 * 60 * 1000;
  const st = new Date(ms);
  let h = st.getUTCHours();
  const m = st.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  const mm = m.toString().padStart(2, '0');
  return `${h}:${mm} ${ampm} ST`;
}

async function broadcastToChannels({ faction, newBuff }) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelIds = (process.env.DISCORD_CHANNEL_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!botToken || channelIds.length === 0) return; // Nothing to do

  const content = `[${capitalizeWord(faction)}] ${newBuff.buff} at ${formatStTimeFromIso(newBuff.datetime)} — Guild: ${newBuff.guild}${newBuff.notes ? `\nNotes: ${newBuff.notes}` : ''}\nhttps://hcbuffs.com`;

  await Promise.all(channelIds.map(async (channelId) => {
    const url = `https://discord.com/api/v10/channels/${channelId}/messages`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content })
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      console.warn('Discord broadcast failed for channel', channelId, resp.status, txt);
    }
  }));
}

exports.handler = async function(event) {
  // Verify method
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) return jsonResponse(500, { error: 'DISCORD_PUBLIC_KEY not configured' });

  // Signature verification per Discord docs
  const signature = getHeader(event.headers, 'x-signature-ed25519');
  const timestamp = getHeader(event.headers, 'x-signature-timestamp');
  if (!signature || !timestamp) return jsonResponse(401, { error: 'Bad request signature' });

  const rawBody = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');

  try {
    const encoder = new TextEncoder();
    const isValid = nacl.sign.detached.verify(
      encoder.encode(timestamp + rawBody),
      Buffer.from(signature, 'hex'),
      Buffer.from(publicKey, 'hex')
    );
    if (!isValid) return jsonResponse(401, { error: 'Invalid request signature' });
  } catch (e) {
    return jsonResponse(401, { error: 'Signature verification failed' });
  }

  // Parse interaction
  let interaction;
  try {
    interaction = JSON.parse(rawBody);
  } catch (e) {
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  // PING
  if (interaction && interaction.type === 1) {
    return jsonResponse(200, { type: 1 });
  }

  // APPLICATION_COMMAND
  if (interaction && interaction.type === 2) {
    const name = interaction.data && interaction.data.name;
    if (name !== 'post') {
      return jsonResponse(200, {
        type: 4,
        data: { content: 'Unknown command', flags: 64 }
      });
    }

    const optsArr = interaction.data.options || [];
    const opts = Object.fromEntries(optsArr.map(o => [o.name, o.value]));

    try {
      const factionRaw = String(opts.faction || '').toLowerCase();
      if (!['horde', 'alliance'].includes(factionRaw)) throw new Error('faction must be horde or alliance');

      const buffType = normalizeBuffType(opts.buff);
      const guild = String(opts.guild || '').trim();
      if (!guild) throw new Error('guild is required');

      const datetimeInput = String(opts.datetime || '').trim();
      if (!datetimeInput) throw new Error('datetime is required');
      const isoDatetime = isIsoDatetime(datetimeInput) ? new Date(datetimeInput).toISOString().replace(/\.\d{3}Z$/, 'Z') : parseStToUtcIso(datetimeInput);

      const notes = (opts.notes || '').toString().trim();

      const newBuff = {
        datetime: isoDatetime,
        guild,
        buff: buffType,
        ...(notes ? { notes } : {}),
        server: 'Doomhowl'
      };

      await commitNewBuffToGithub({ faction: factionRaw, newBuff });
      await broadcastToChannels({ faction: factionRaw, newBuff });

      return jsonResponse(200, {
        type: 4,
        data: {
          content: `Posted ${buffType} for ${guild} at ${formatStTimeFromIso(isoDatetime)} (server time).`,
          flags: 64
        }
      });
    } catch (e) {
      return jsonResponse(200, {
        type: 4,
        data: { content: `Error: ${e.message}`, flags: 64 }
      });
    }
  }

  return jsonResponse(400, { error: 'Unsupported interaction' });
};
