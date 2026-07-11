const fs = require('fs');
const path = require('path');

module.exports = {
  name: "setprefix",
  alias: ["prefix", "setpfx"],
  desc: "Change bot command prefix. Owner only.",
  category: "owner",
  react: "⚙️",
  start: async (conn, mek, m, { isOwner, text, reply }) => {

    if (!isOwner) return reply("❌ Owner only command!");

    if (!text) {
      return reply(
        `*Current Prefix:* \`${global.prefix || '.'}\`\n\n` +
        `*Usage:* ${global.prefix || '.'}setprefix <symbol>\n` +
        `*Example:* ${global.prefix || '.'}setprefix!\n\n` +
        `*Note:* Single character only. No letters/numbers.`
      );
    }

    if (text.length !== 1 || /[a-zA-Z0-9]/.test(text)) {
      return reply("❌ Prefix must be 1 special character only.\n*Examples:* . ! # $ /");
    }

    const oldPrefix = global.prefix || '.';
    const envPath = path.join(__dirname, '../../.env'); // adjust path if needed

    try {
      let envContent = "";
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }

      // Update or add PREFIX line in .env
      if (envContent.includes("PREFIX=")) {
        envContent = envContent.replace(/PREFIX=.*/g, `PREFIX=${text}`);
      } else {
        envContent += `\nPREFIX=${text}\n`;
      }

      fs.writeFileSync(envPath, envContent);

      // Reload config and update global.prefix immediately
      delete require.cache[require.resolve('../../config')]; // adjust path
      const config = require('../../config');
      global.prefix = config.PREFIX;

      await reply(
        `✅ *Prefix Updated*\n\n` +
        `*Old:* \`${oldPrefix}\`\n` +
        `*New:* \`${text}\`\n\n` +
        `All commands now use \`${text}\`\n` +
        `*Example:* ${text}menu\n` +
        `✅ Saved permanently. No restart needed.`
      );

    } catch (e) {
      await reply(
        `❌ Could not update prefix: ${e.message}\n` +
        `Prefix will reset on restart.`
      );
    }
  }
}