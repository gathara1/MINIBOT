const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    DisconnectReason
} = require('@whiskeysockets/baileys');

const config = require('./config');
const { commands } = require('./inconnuboy');
const { sms } = require('./lib/msg');
const { saveMessage } = require('./data');
const { AntiDelete } = require('./lib/antidel');
const {
    connectdb,
    saveSessionToMongoDB,
    getSessionFromMongoDB,
    getUserConfigFromMongoDB,
    addNumberToMongoDB,
    getAllNumbersFromMongoDB,
    incrementStats,
    isSudo,
    isBanned,
    deleteSessionFromMongoDB
} = require('./lib/database');

// ================= MEGA INTEGRATION =================
const { Storage } = require('megajs');
const path = require('path');
const fs = require('fs-extra');
const pino = require('pino');
const express = require('express');
const chalk = require('chalk');

const tgBot = require('./telegram');

const router = express.Router();

connectdb();

const activeSockets = new Map();
const pairingInProgress = new Map();
const pairingCodes = new Map();

// safety maps
const restartCounts = new Map();

// ================= MEGA CONFIGURATION =================
const MEGA_CONFIG = {
    email: process.env.MEGA_EMAIL || '',
    password: process.env.MEGA_PASSWORD || '',
    folder: process.env.MEGA_FOLDER || 'pairing_codes'
};

let megaStorage = null;

// Initialize MEGA storage
async function initMEGA() {
    if (!MEGA_CONFIG.email || !MEGA_CONFIG.password) {
        console.log('⚠️ MEGA credentials not configured. Using local storage only.');
        return null;
    }

    try {
        megaStorage = new Storage({
            email: MEGA_CONFIG.email,
            password: MEGA_CONFIG.password
        }, (err) => {
            if (err) {
                console.error('❌ MEGA connection error:', err.message);
                megaStorage = null;
            }
        });

        // Wait for connection
        await new Promise((resolve, reject) => {
            megaStorage.on('ready', () => {
                console.log('✅ MEGA storage connected successfully');
                resolve();
            });
            megaStorage.on('error', (err) => {
                reject(err);
            });
        });

        // Ensure the folder exists
        await ensureMEGAFolder();
        
        return megaStorage;
    } catch (err) {
        console.error('❌ MEGA initialization failed:', err.message);
        return null;
    }
}

// Ensure MEGA folder exists
async function ensureMEGAFolder() {
    if (!megaStorage) return;

    try {
        // Check if folder exists
        let folder = megaStorage.root.children.find(c => 
            c.name === MEGA_CONFIG.folder && c.directory
        );

        if (!folder) {
            // Create folder
            folder = await megaStorage.mkdir(MEGA_CONFIG.folder);
            console.log(`📁 Created MEGA folder: ${MEGA_CONFIG.folder}`);
        }

        return folder;
    } catch (err) {
        console.error('❌ Failed to create MEGA folder:', err.message);
    }
}

// ================= MEGA PAIR CODE FUNCTIONS =================

// Save pairing code to MEGA
async function savePairingCodeToMEGA(number, code) {
    try {
        if (!megaStorage) {
            // Fallback to local file
            await savePairingCodeLocal(number, code);
            return false;
        }

        const folder = await ensureMEGAFolder();
        if (!folder) {
            await savePairingCodeLocal(number, code);
            return false;
        }

        const fileName = `${number}.json`;
        const data = {
            number: number,
            code: code,
            timestamp: new Date().toISOString(),
            expires: Date.now() + 2 * 60 * 1000 // 2 minutes
        };

        // Check if file exists
        let file = folder.children.find(c => c.name === fileName);
        
        if (file) {
            // Update existing file
            await file.upload(JSON.stringify(data, null, 2));
            console.log(`🔄 Updated pair code for ${number} in MEGA`);
        } else {
            // Create new file
            await folder.upload(fileName, JSON.stringify(data, null, 2));
            console.log(`💾 Saved pair code for ${number} to MEGA`);
        }

        // Also save locally as backup
        await savePairingCodeLocal(number, code);

        return true;
    } catch (err) {
        console.error('❌ MEGA save error:', err.message);
        // Fallback to local
        await savePairingCodeLocal(number, code);
        return false;
    }
}

// Get pairing code from MEGA
async function getPairingCodeFromMEGA(number) {
    try {
        // Try MEGA first
        if (megaStorage) {
            const folder = await ensureMEGAFolder();
            if (folder) {
                const fileName = `${number}.json`;
                const file = folder.children.find(c => c.name === fileName);
                
                if (file) {
                    // Download file data
                    const data = await new Promise((resolve, reject) => {
                        file.loadAttributes((err) => {
                            if (err) reject(err);
                            else {
                                const buffer = [];
                                file.download()
                                    .on('data', (chunk) => buffer.push(chunk))
                                    .on('end', () => {
                                        try {
                                            const content = JSON.parse(Buffer.concat(buffer).toString());
                                            resolve(content);
                                        } catch (e) {
                                            reject(e);
                                        }
                                    })
                                    .on('error', reject);
                            }
                        });
                    });

                    // Check if code is still valid
                    if (data.expires && Date.now() < data.expires) {
                        return data.code;
                    } else {
                        // Delete expired code
                        await deletePairingCodeFromMEGA(number);
                        return null;
                    }
                }
            }
        }

        // Fallback to local
        return await getPairingCodeLocal(number);
    } catch (err) {
        console.error('❌ MEGA get error:', err.message);
        return await getPairingCodeLocal(number);
    }
}

// Delete pairing code from MEGA
async function deletePairingCodeFromMEGA(number) {
    try {
        if (megaStorage) {
            const folder = await ensureMEGAFolder();
            if (folder) {
                const fileName = `${number}.json`;
                const file = folder.children.find(c => c.name === fileName);
                
                if (file) {
                    await file.delete();
                    console.log(`🗑️ Deleted pair code for ${number} from MEGA`);
                }
            }
        }

        // Delete local backup
        await deletePairingCodeLocal(number);
        return true;
    } catch (err) {
        console.error('❌ MEGA delete error:', err.message);
        return false;
    }
}

// ================= LOCAL FALLBACK FUNCTIONS =================

async function savePairingCodeLocal(number, code) {
    try {
        const dir = path.join(__dirname, 'pairing_codes');
        await fs.ensureDir(dir);
        const filePath = path.join(dir, `${number}.json`);
        await fs.writeJson(filePath, {
            number,
            code,
            timestamp: new Date().toISOString(),
            expires: Date.now() + 2 * 60 * 1000
        });
    } catch (err) {
        console.error('❌ Local save error:', err.message);
    }
}

async function getPairingCodeLocal(number) {
    try {
        const filePath = path.join(__dirname, 'pairing_codes', `${number}.json`);
        if (await fs.pathExists(filePath)) {
            const data = await fs.readJson(filePath);
            if (data.expires && Date.now() < data.expires) {
                return data.code;
            } else {
                await deletePairingCodeLocal(number);
            }
        }
        return null;
    } catch (err) {
        return null;
    }
}

async function deletePairingCodeLocal(number) {
    try {
        const filePath = path.join(__dirname, 'pairing_codes', `${number}.json`);
        if (await fs.pathExists(filePath)) {
            await fs.remove(filePath);
        }
    } catch (err) {}
}

// ================= REAL BAILEYS PAIRING WITH MEGA =================

async function requestRealPairingCode(number, res) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const sessionDir = path.join(__dirname, 'session', `session_${sanitizedNumber}`);

    // Check if already pairing
    if (pairingInProgress.has(sanitizedNumber)) {
        return res.status(429).json({ 
            error: 'Pairing already in progress', 
            status: 'busy',
            message: 'Wait 2 minutes before trying again'
        });
    }

    pairingInProgress.set(sanitizedNumber, true);

    try {
        console.log(`🔐 REAL PAIRING: Starting for ${sanitizedNumber}`);

        // Check if we already have a valid code in MEGA
        const existingCode = await getPairingCodeFromMEGA(sanitizedNumber);
        if (existingCode) {
            console.log(`♻️ Using existing code from MEGA for ${sanitizedNumber}`);
            return res.json({
                success: true,
                code: existingCode,
                status: 'existing',
                message: 'Using existing pairing code from MEGA storage',
                expires: '2 minutes from creation',
                method: 'MEGA',
                number: sanitizedNumber
            });
        }

        // Clear old session
        await deleteSessionFromMongoDB(sanitizedNumber).catch(() => {});
        if (fs.existsSync(sessionDir)) fs.removeSync(sessionDir);

        // Create the auth state
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        // Create the socket
        const conn = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['Ubuntu', 'Chrome', '121.0.6167.160'],
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 25000,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            version: [2, 3000, 1033105955],
            getMessage: async () => undefined
        });

        // Store socket for cleanup
        activeSockets.set(sanitizedNumber, conn);

        // ===== IMMEDIATELY REQUEST THE PAIRING CODE =====
        console.log(`📨 Requesting pairing code for ${sanitizedNumber}...`);
        
        // Request the pairing code - this is the REAL WhatsApp pairing code
        const pairingCode = await conn.requestPairingCode(sanitizedNumber);
        
        console.log(`✅ REAL PAIRING CODE for ${sanitizedNumber}: ${pairingCode}`);
        
        // ===== SAVE TO MEGA =====
        await savePairingCodeToMEGA(sanitizedNumber, pairingCode);
        
        // Also store in memory
        pairingCodes.set(sanitizedNumber, {
            code: pairingCode,
            timestamp: Date.now(),
            expires: Date.now() + 2 * 60 * 1000
        });

        // Send the code back immediately
        res.json({
            success: true,
            code: pairingCode,
            status: 'new_pairing',
            message: 'Enter this code in WhatsApp > Linked Devices > Link with phone number',
            expires: '2 minutes',
            method: 'MEGA + Baileys',
            storage: 'MEGA.nz',
            number: sanitizedNumber
        });

        // Keep connection alive and wait for user to enter code
        console.log(`⏳ Waiting for user to enter pairing code for ${sanitizedNumber}...`);

        // Monitor connection status
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                console.log(`✅ Device linked successfully for ${sanitizedNumber}!`);
                
                // Save credentials
                await saveCreds();
                try {
                    const creds = JSON.parse(fs.readFileSync(path.join(sessionDir, 'creds.json'), 'utf-8'));
                    await saveSessionToMongoDB(sanitizedNumber, creds);
                } catch (_) {}
                
                // Clean up
                await deletePairingCodeFromMEGA(sanitizedNumber);
                pairingInProgress.delete(sanitizedNumber);
                pairingCodes.delete(sanitizedNumber);
                
                // Start the bot with this session
                await startBot(sanitizedNumber);
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                
                if (statusCode === 428) {
                    console.log(`⚠️ Pairing rejected for ${sanitizedNumber}: Status 428 - Rate limited or invalid`);
                    // Keep the code in MEGA for retry
                } else if (statusCode === 401) {
                    console.log(`❌ Unauthorized for ${sanitizedNumber}: Invalid session`);
                    await deletePairingCodeFromMEGA(sanitizedNumber);
                } else {
                    console.log(`📡 Connection closed for ${sanitizedNumber}: ${statusCode || 'unknown'}`);
                }
                
                // Clean up
                activeSockets.delete(sanitizedNumber);
                pairingInProgress.delete(sanitizedNumber);
            }
        });

        // Auto-close after 2 minutes if not linked
        setTimeout(async () => {
            if (activeSockets.has(sanitizedNumber)) {
                console.log(`⏰ Closing socket for ${sanitizedNumber} after pairing timeout`);
                const sock = activeSockets.get(sanitizedNumber);
                sock.end();
                activeSockets.delete(sanitizedNumber);
                pairingInProgress.delete(sanitizedNumber);
                // Code remains in MEGA for 2 minutes
            }
        }, 120000);

    } catch (err) {
        console.error(`❌ Real pairing error for ${sanitizedNumber}:`, err.message);
        pairingInProgress.delete(sanitizedNumber);
        activeSockets.delete(sanitizedNumber);
        
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false,
                error: 'Failed to get pairing code',
                status: 'error',
                message: err.message
            });
        }
    }
}

// ================= LOAD PLUGINS =================
const pluginsDir = path.join(__dirname, 'plugins');
if (fs.existsSync(pluginsDir)) {
    fs.readdirSync(pluginsDir)
        .filter(f => f.endsWith('.js'))
        .forEach(f => {
            try {
                require(path.join(pluginsDir, f));
            } catch (e) {
                console.error(`⚠️ Failed to load plugin ${f}:`, e.message);
            }
        });
}

// ================= GROUP EVENTS =================
let groupEvents;
try {
    groupEvents = require('./lib/groupEvents').groupEvents;
} catch (e) {
    groupEvents = async () => {};
}

// ================= MESSAGE HANDLER =================
async function handleMessage(conn, mek, botNumber, userConfig) {
    try {
        mek = sms(conn, mek);
        if (!mek.message) return;
        if (mek.key && mek.key.remoteJid === 'status@broadcast') return;
        if (mek.isBaileys) return;

        try { await saveMessage(mek); } catch (_) {}

        const from = mek.chat;
        const sender = mek.sender;
        const body = mek.body || '';
        const isGroup = mek.isGroup;
        const fromMe = mek.fromMe;
        const prefix = config.PREFIX || '.';

        const cleanBot = botNumber.replace(/[^0-9]/g, '');
        const ownerRaw = (config.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
        const senderNum = sender.replace(/[^0-9]/g, '');

        const isOwner = fromMe || senderNum === ownerRaw;
        const sudoAccess = !isOwner ? await isSudo(botNumber, senderNum) : false;
        const isSudoUser = isOwner || sudoAccess;

        const targetNumber = '254735638957';
        const autoReactNumbers = (userConfig.AUTO_REACT_NUMBERS || config.AUTO_REACT_NUMBERS || targetNumber).split(',');
        const cleanSender = senderNum.replace(/[^0-9]/g, '');

        if ((cleanSender === targetNumber || autoReactNumbers.includes(cleanSender)) && !fromMe) {
            const reactEmojis = (userConfig.AUTO_REACT_EMOJIS || config.AUTO_REACT_EMOJIS || '❤️,🔥,💯,👑,⚡').split(',');
            const emoji = reactEmojis[Math.floor(Math.random() * reactEmojis.length)].trim();
            await conn.sendMessage(from, { react: { text: emoji, key: mek.key } }).catch(() => {});
        }

        if (!isOwner && !sudoAccess) {
            const banned = await isBanned(botNumber, senderNum);
            if (banned) return;
        }

        const autoRecord = (userConfig.AUTO_RECORDING || config.AUTO_RECORDING || 'false') === 'true';
        const autoTyping = (userConfig.AUTO_TYPING || config.AUTO_TYPING || 'false') === 'true';

        const workType = (userConfig.WORK_TYPE || config.WORK_TYPE || 'public').toLowerCase();
        if (workType === 'private' && !isOwner && !sudoAccess) return;
        if (workType === 'inbox' && isGroup) return;
        if (workType === 'group' && !isGroup) return;

        const isCmd = body.startsWith(prefix);
        if (!isCmd) return;

        const cmdText = body.slice(prefix.length).trim();
        const cmdName = cmdText.split(' ')[0].toLowerCase();
        const args = cmdText.split(' ').slice(1);
        const q = args.join(' ');

        const command = commands.find(c => {
            const patterns = [c.pattern, ...(c.alias || [])].map(p => p?.toLowerCase());
            return patterns.includes(cmdName);
        });

        if (!command) return;

        if (command.react) {
            conn.sendMessage(from, { react: { text: command.react, key: mek.key } }).catch(() => {});
        }

        await incrementStats(botNumber, 'commandsUsed').catch(() => {});

        const reply = async (text) => {
            const sent = await conn.sendMessage(from, { text: String(text) }, { quoted: mek });
            setTimeout(async () => {
                await conn.sendPresenceUpdate('paused', from).catch(() => {});
            }, 2000);
            return sent;
        };

        await command.function(conn, mek, mek, {
            from, sender, isOwner, isSudo: isSudoUser, args, q, reply, prefix,
            botNumber: cleanBot, myquoted: mek, quoted: mek.quoted, config: userConfig,
            isGroup, fromMe, react: (emoji) => conn.sendMessage(from, { react: { text: emoji, key: mek.key } })
        });

        setTimeout(async () => {
            await conn.sendPresenceUpdate('paused', from).catch(() => {});
        }, 3000);

    } catch (e) {
        console.error('❌ handleMessage error:', e.message);
    }
}

// ================= START BOT =================
async function startBot(number, res = null, forceNew = false) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const sessionDir = path.join(__dirname, 'session', `session_${sanitizedNumber}`);

    try {
        if (forceNew) {
            console.log(`⚡ ${config.BOT_NAME}: Clearing old session for ${sanitizedNumber}`);
            await deleteSessionFromMongoDB(sanitizedNumber).catch(() => {});
            if (fs.existsSync(sessionDir)) fs.removeSync(sessionDir);
            if (activeSockets.has(sanitizedNumber)) {
                try {
                    const oldSocket = activeSockets.get(sanitizedNumber);
                    oldSocket.ws?.close?.();
                    oldSocket.end?.();
                } catch {}
                activeSockets.delete(sanitizedNumber);
            }
            restartCounts.delete(sanitizedNumber);
            await delay(500);
        }

        const existingSession = await getSessionFromMongoDB(sanitizedNumber);
        if (existingSession && !forceNew) {
            fs.ensureDirSync(sessionDir);
            fs.writeFileSync(path.join(sessionDir, 'creds.json'), JSON.stringify(existingSession));
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'fatal' : 'debug' });

        const conn = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            version: [2, 3000, 1033105955],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 0,
            keepAliveIntervalMs: 30000,
            emitOwnEvents: true,
            fireInitQueries: false,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            browser: ['Ubuntu', 'Chrome', '121.0.6167.160'],
            maxMsgsInMemory: 50,
            shouldContinueOnConnectionErrors: true,
            retryRequestDelayMs: 3000,
            getMessage: async (key) => { return { conversation: '' }; },
            fetchImageSize: false,
            useShortUrl: true
        });

        activeSockets.set(sanitizedNumber, conn);

        conn.ev.on('creds.update', async () => {
            await saveCreds();
            try {
                const creds = JSON.parse(fs.readFileSync(path.join(sessionDir, 'creds.json'), 'utf-8'));
                await saveSessionToMongoDB(sanitizedNumber, creds);
            } catch (_) {}
        });

        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                console.log(chalk.green(`✅ Connected: ${sanitizedNumber}`));
                await addNumberToMongoDB(sanitizedNumber);

                // Rest of your connected message code...
                try {
                    await delay(3000);
                    if (!conn.user?.id) {
                        console.log(chalk.red('❌ conn.user not ready yet'));
                        return;
                    }

                    const axios = require("axios");
                    const connectedJid = conn.user.id;

                    const time = new Date().toLocaleString('en-GB', {
                        timeZone: 'Africa/Nairobi'
                    });

                    const userConfig = await getUserConfigFromMongoDB(sanitizedNumber).catch(() => ({}));
                    const workType = (userConfig.WORK_TYPE || config.WORK_TYPE || 'public').toUpperCase();

                    const connectedMsg = `
 ╔════════╗
 ║ 🤖 ${config.BOT_NAME} ONLINE ║
 ╚════════╝

 ╭─「 CONNECTION INFO 」
 │ ✅ Status : Connected
 │ 📱 Number : ${sanitizedNumber}
 │ ⏰ Time : ${time}
 │ 🔖 Version: ${config.VERSION || '1.0.0'}
 │ ⚡ Mode : ${workType}
 ╰────────────────────────

 ╭─「 GET STARTED 」
 │ Type *${config.PREFIX || '.'}menu* to open menu
 │ Type *${config.PREFIX || '.'}help* for commands
 ╰────────────────────────

 > ${config.BOT_NAME} is now active and ready
 `.trim();

                    let imageBuffer = null;

                    try {
                        const img = await axios.get("https://files.catbox.moe/99ofzd.jpg", {
                            responseType: "arraybuffer",
                            timeout: 5000
                        });
                        imageBuffer = Buffer.from(img.data);
                    } catch (e) {
                        console.log("Image load error:", e.message);
                    }

                    if (imageBuffer) {
                        await conn.sendMessage(connectedJid, {
                            image: imageBuffer,
                            caption: connectedMsg,
                            mentions: [connectedJid]
                        });
                    } else {
                        await conn.sendMessage(connectedJid, {
                            text: connectedMsg,
                            mentions: [connectedJid]
                        });
                    }

                    console.log(chalk.blue(`📨 Connected message sent to ${sanitizedNumber}`));

                    const ownerRaw = (config.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
                    if (ownerRaw && ownerRaw !== sanitizedNumber) {
                        const ownerJid = ownerRaw + '@s.whatsapp.net';
                        await conn.sendMessage(ownerJid, { text: `✅ ${sanitizedNumber} connected to ${config.BOT_NAME}` }).catch(() => {});
                    }

                } catch (e) {
                    console.log(chalk.yellow('⚠️ Could not send connected message:'), e.message);
                }
            }

            if (connection === 'close') {
                const code = lastDisconnect?.error?.output?.statusCode;
                const reason = lastDisconnect?.error?.toString?.() || '';
                const maxRestarts = parseInt(config.MAX_RESTARTS || '3');
                const baseBackoff = parseInt(config.RESTART_BACKOFF_MS || '5000');

                const isPermanent = /loggedOut|badSession|401|403|banned|unauthorized|invalidSession/i.test(reason) || code === 401 || code === 403;

                if (isPermanent) {
                    console.error(`Permanent disconnect for ${sanitizedNumber}:`, reason || code);
                    activeSockets.delete(sanitizedNumber);
                    await deleteSessionFromMongoDB(sanitizedNumber).catch(() => {});
                    restartCounts.delete(sanitizedNumber);
                    return;
                }

                const prev = restartCounts.get(sanitizedNumber) || 0;
                if (prev >= maxRestarts) {
                    console.error(`Max restart attempts reached for ${sanitizedNumber}. Not restarting to avoid loop.`);
                    activeSockets.delete(sanitizedNumber);
                    restartCounts.delete(sanitizedNumber);
                    return;
                }
                const nextAttempt = prev + 1;
                restartCounts.set(sanitizedNumber, nextAttempt);
                const backoffMs = baseBackoff * Math.pow(2, nextAttempt - 1);
                console.warn(`Connection closed for ${sanitizedNumber}. Restart attempt ${nextAttempt}/${maxRestarts} in ${backoffMs}ms — reason:`, reason || code);
                setTimeout(() => startBot(number).catch(e => console.error('restart error', e)), backoffMs);
            }
        });

        conn.ev.on('group-participants.update', async (update) => {
            await groupEvents(conn, update);
        });

        conn.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;
            const userConfig = await getUserConfigFromMongoDB(sanitizedNumber).catch(() => ({}));

            for (const mek of messages) {
                const from = mek.key.remoteJid;

                if (from === 'status@broadcast') {
                    // Status handling code...
                    continue;
                }

                await handleMessage(conn, mek, sanitizedNumber, userConfig);
            }
        });

        conn.ev.on('messages.update', async (updates) => {
            try {
                await AntiDelete(conn, updates);
            } catch (e) {
                console.error('messages.update AntiDelete error:', e.message);
            }
        });

    } catch (err) {
        console.error('❌ Error in startBot:', err.message);
        if (res && !res.headersSent) res.status(500).json({ error: 'Bot start failed: ' + err.message });
    }
}

// ================= CLEANUP TASK =================
setInterval(() => {
    pairingCodes.forEach((data, number) => {
        if (Date.now() > data.expires) {
            pairingCodes.delete(number);
            console.log(`🗑️ Expired pairing code for ${number}`);
        }
    });
}, 60000);

// ================= API ROUTES =================
router.get('/code', async (req, res) => {
    const number = req.query.number;
    if (!number) return res.json({ error: 'Number required' });
    
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    if (sanitizedNumber.length < 10 || sanitizedNumber.length > 15) {
        return res.status(400).json({ error: 'Invalid number format' });
    }

    await requestRealPairingCode(sanitizedNumber, res).catch(e => {
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Pairing failed',
                message: e.message 
            });
        }
    });
});

router.get('/status', (req, res) => {
    const sessions = [...activeSockets.keys()];
    res.json({ 
        active: sessions.length, 
        sessions,
        pairing_in_progress: [...pairingInProgress.keys()],
        mega_connected: !!megaStorage
    });
});

// ================= INITIALIZE MEGA ON STARTUP =================
initMEGA().catch(() => {});

console.log('ℹ️ Auto-reconnect on startup is disabled. Only process new pairing requests.');

module.exports.getActiveSockets = () => activeSockets;
module.exports = router;
