const axios = require('axios');

module.exports = {
  name: "facebook",
  alias: ["fb", "fbdl"],
  desc: "Download Facebook videos",
  category: "download",
  react: "📘",
  start: async (conn, mek, m, { text, reply }) => {
    if (!text) return reply("❌ Give me a Facebook link");
    if (!text.includes('facebook.com')) return reply("❌ Invalid FB link");
    
    try {
      await reply("⏳ Downloading...");
      const res = await axios.get(`https://api.akuari.my.id/downloader/fbdl?link=${text}`);
      const video = res.data?.respon?.hd || res.data?.respon?.sd;
      if (!video) return reply("❌ Failed to fetch video");
      await conn.sendMessage(m.from, { video: { url: video }, caption: "✅ Powered by NAPPIER-XMD" }, { quoted: mek });
    } catch (e) {
      reply("❌ Error: " + e.message);
    }
  }
}