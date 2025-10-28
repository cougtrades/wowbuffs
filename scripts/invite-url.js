#!/usr/bin/env node

/**
 * Prints an OAuth2 invite URL to add your Discord bot to a server.
 *
 * Required env:
 *  - DISCORD_APP_ID (aka Client ID)
 * Optional env:
 *  - DISCORD_PERMISSIONS (default: 3072 i.e., View Channels + Send Messages)
 *  - DISCORD_SCOPES (default: "bot applications.commands")
 */

function exitWith(message) {
  console.error(message);
  process.exit(1);
}

const appId = process.env.DISCORD_APP_ID;
if (!appId) exitWith("Please set DISCORD_APP_ID (your application's Client ID).");

const defaultPermissions = "3072"; // VIEW_CHANNEL (1024) + SEND_MESSAGES (2048)
const permissions = String(process.env.DISCORD_PERMISSIONS || defaultPermissions);

const defaultScopes = ["bot", "applications.commands"];
const scopes = String(process.env.DISCORD_SCOPES || defaultScopes.join(" "));

const base = "https://discord.com/api/oauth2/authorize";
const params = new URLSearchParams({
  client_id: appId,
  scope: scopes,
  permissions,
});

const url = `${base}?${params.toString()}`;

console.log("Discord bot invite URL:\n");
console.log(url);
console.log("\nInstructions:\n- Open the URL in a browser.\n- Choose your test server.\n- Ensure the bot role has 'View Channels' and 'Send Messages' in target channels if you set DISCORD_CHANNEL_IDS.");
