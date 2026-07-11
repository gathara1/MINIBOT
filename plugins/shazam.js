module.exports = {
  name: "shazam",
  alias: ["findmusic", "whatsong"],
  desc: "Identify song from audio",
  category: "search",
  react: "🎵",
  start: async (conn, mek, m, { reply }) => {
    return reply("⚠️ Shazam disabled. Use @audD_bot on Telegram to identify songs.");
  }
}