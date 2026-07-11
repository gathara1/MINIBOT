module.exports = {
  name: "app",
  alias: ["apk", "playstore"],
  desc: "Search for apps",
  category: "search",
  react: "📱",
  start: async (conn, mek, m, { text, reply }) => {
    if (!text) return reply("❌ Enter app name");
    return reply(`🔍 Search manually: https://play.google.com/store/search?q=${encodeURIComponent(text)}&c=apps`);
  }
}