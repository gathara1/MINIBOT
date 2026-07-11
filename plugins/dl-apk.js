const { cmd } = require('../inconnuboy');
const fetch = require('node-fetch');

cmd({
    pattern: "app",
    desc: "Search app from PlayStore and send APK",
    category: "download",
    react: "📱",
    filename: __filename
}, async (conn, m, mek, { from, reply }) => {

    const query = m.text.split(" ").slice(1).join(" ").trim();
    if (!query) return reply("❗ Enter app name");

    await conn.sendMessage(from, { react: { text: "🔎", key: mek.key } });

    try {

        // STEP 1 — Search PlayStore (accurate app name)
        const psUrl = `https://api.giftedtech.co.ke/api/search/playstore?apikey=gifted&query=${encodeURIComponent(query)}`;
        const psRes = await fetch(psUrl);
        const psJson = await psRes.json();

        if (!psJson.success || !psJson.results.length) {
            return reply("❌ No apps found");
        }

        const app = psJson.results[0];

        // STEP 2 — Search HappyMod / F-Droid for APK
        const apkUrl = `https://api.giftedtech.co.ke/api/search/happymod?apikey=gifted&query=${encodeURIComponent(app.name)}`;
        const apkRes = await fetch(apkUrl);
        const apkJson = await apkRes.json();

        if (!apkJson.success || !apkJson.results.data.length) {
            return reply("❌ APK not available");
        }

        const apk = apkJson.results.data[0];

        if (!apk.url) return reply("❌ Download link missing");

        // STEP 3 — Download APK buffer
        const buffer = await fetch(apk.url).then(res => res.buffer());

        // STEP 4 — Send as document
        await conn.sendMessage(from, {
            document: buffer,
            fileName: `${app.name}.apk`,
            mimetype: "application/vnd.android.package-archive",
            caption:
`📱 ${app.name}
👨‍💻 ${app.developer}
⭐ ${app.rating}
📝 ${app.summary}`
        });

    } catch (err) {
        console.log(err);
        reply("❗ Error fetching app");
    }
});
