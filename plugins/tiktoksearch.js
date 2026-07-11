const axios = require('axios');

module.exports = {
  name: "tiktoksearch",
  alias: ["tiktoks", "ttsearch"],
  desc: "Search TikTok videos",
  category: "search",
  react: "🔍",
  start: async (conn, mek, m, { text, reply }) => {
    if (!text) return reply("❌ Enter search query");
    
    try {
      await reply("⏳ Searching TikTok...");
      const res = await axios.get(`https://api.akuari.my.id/search/tiktok?query=${encodeURIComponent(text)}`);
      const result = res.data?.respon?.[0];
      if (!result) return reply("❌ No results found");
      
      await conn.sendMessage(m.from, { 
        video: { url: result.nowm }, 
        caption: `*${result.title}*\n\n⚡ Powered by lycifer` 
      }, { quoted: mek });
    } catch (e) {
      reply("❌ Error: " + e.message);
    }
  }
}