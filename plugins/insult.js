const axios = require('axios');
const { cmd } = require('../inconnuboy');

cmd({
    pattern: "insult",
    desc: "Generate a rhyming insult and tag the replied user",
    category: "fun",
    react: "🔥",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        // must reply to a message
        if (!mek.quoted) {
            return reply("⚠️ Reply to someone’s message to insult them 😈");
        }

        // get mentioned user
        const target = mek.quoted.sender;

        // typing effect
        await conn.sendPresenceUpdate('composing', from);

        // fetch insult
        const res = await axios.get(
            'https://evilinsult.com/generate_insult.php?lang=en&type=json'
        );
        const baseInsult = res.data.insult;

        // rhyming endings
        const rhymes = [
            `You talk too much, dusty mid,\nBow down now to *NAPPIER-XMD*! 🎤🔥`,
            `Brain on sleep, thoughts forbid,\nAnother pack smoked by *NAPPIER-XMD*! ⚡`,
            `You stepped wrong, your fate is sealed,\nRoasted clean by *NAPPIER-XMD*! 💀`,
            `Trying to flex? Don’t kid,\nYou got humbled by *NAPPIER-XMD*! 👑`,
            `Weak response, childish bid,\nLearn your place — *NAPPIER-XMD*! 😈`
        ];

        const randomRhyme = rhymes[Math.floor(Math.random() * rhymes.length)];

        // final tagged roast
        const finalRoast = `💥 *INSULT MODE ACTIVATED* 💥

👤 @${target.split('@')[0]}

"${baseInsult}"

${randomRhyme}`;

        await conn.sendMessage(from, {
            text: finalRoast,
            mentions: [target]
        }, { quoted: mek });

    } catch (err) {
        console.error("Insult error:", err);
        reply("❌ Even roasting you felt unnecessary.");
    }
});