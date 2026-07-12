// lib/megaStorage.js
const mega = require("megajs");
const fs = require('fs-extra');
const path = require('path');

// ================= MEGA CONFIGURATION FROM ENV =================
const MEGA_CONFIG = {
    email: process.env.MEGA_EMAIL || 'myhuxna@gmail.com',
    password: process.env.MEGA_PASSWORD || 'Dodoma2006#',
    folder: process.env.MEGA_FOLDER || 'pairing_codes',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246'
};

let megaStorage = null;
let isConnecting = false;

// ================= MEGA CONNECTION =================
async function connectMEGA() {
    if (megaStorage) return megaStorage;
    if (isConnecting) {
        await new Promise(resolve => {
            const checkConnection = setInterval(() => {
                if (megaStorage || !isConnecting) {
                    clearInterval(checkConnection);
                    resolve();
                }
            }, 100);
        });
        return megaStorage;
    }

    isConnecting = true;
    
    try {
        console.log('[MEGA] Connecting:', MEGA_CONFIG.email);

        megaStorage = new mega.Storage({
            email: MEGA_CONFIG.email,
            password: MEGA_CONFIG.password,
            userAgent: MEGA_CONFIG.userAgent
        });

        await new Promise((resolve, reject) => {
            megaStorage.on('ready', () => {
                console.log('[MEGA] Connected successfully');
                isConnecting = false;
                resolve();
            });
            megaStorage.on('error', (err) => {
                console.error('[MEGA] Connection error:', err.message);
                isConnecting = false;
                reject(err);
            });
        });

        await ensureFolder();
        return megaStorage;
    } catch (err) {
        console.error('[MEGA] Connection failed:', err.message);
        isConnecting = false;
        megaStorage = null;
        return null;
    }
}

// ================= ENSURE FOLDER EXISTS =================
async function ensureFolder() {
    if (!megaStorage) return null;

    try {
        let folder = megaStorage.root.children.find(c => 
            c.name === MEGA_CONFIG.folder && c.directory
        );

        if (!folder) {
            folder = await new Promise((resolve, reject) => {
                megaStorage.mkdir(MEGA_CONFIG.folder, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
            console.log(`[MEGA] Created folder: ${MEGA_CONFIG.folder}`);
        }

        return folder;
    } catch (err) {
        console.error('[MEGA] Folder error:', err.message);
        return null;
    }
}

// ================= SAVE PAIRING CODE =================
async function savePairCode(number, code) {
    try {
        const storage = await connectMEGA();
        if (!storage) {
            console.log('[MEGA] Not connected, saving locally only');
            return savePairCodeLocal(number, code);
        }

        const folder = await ensureFolder();
        if (!folder) {
            return savePairCodeLocal(number, code);
        }

        const fileName = `${number}.json`;
        const data = {
            number: number,
            code: code,
            timestamp: new Date().toISOString(),
            expires: Date.now() + 2 * 60 * 1000
        };

        const jsonData = JSON.stringify(data, null, 2);

        const existingFile = folder.children.find(c => c.name === fileName);
        
        if (existingFile) {
            await new Promise((resolve, reject) => {
                existingFile.delete((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            console.log(`[MEGA] Deleted existing file for ${number}`);
        }

        await new Promise((resolve, reject) => {
            const uploadStream = folder.upload(fileName, jsonData, {
                allowUploadBuffering: true
            });

            uploadStream.on('complete', (file) => {
                console.log(`[MEGA] Saved pair code for ${number}`);
                resolve(file);
            });

            uploadStream.on('error', (err) => {
                reject(err);
            });
        });

        await savePairCodeLocal(number, code);
        return true;

    } catch (err) {
        console.error('[MEGA] Save error:', err.message);
        return savePairCodeLocal(number, code);
    }
}

// ================= GET PAIRING CODE =================
async function getPairCode(number) {
    try {
        const localCode = await getPairCodeLocal(number);
        if (localCode) return localCode;

        const storage = await connectMEGA();
        if (!storage) return null;

        const folder = await ensureFolder();
        if (!folder) return null;

        const fileName = `${number}.json`;
        const file = folder.children.find(c => c.name === fileName);

        if (!file) return null;

        const data = await new Promise((resolve, reject) => {
            const chunks = [];
            const stream = file.download();

            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('end', () => {
                try {
                    const content = JSON.parse(Buffer.concat(chunks).toString());
                    resolve(content);
                } catch (err) {
                    reject(err);
                }
            });
            stream.on('error', reject);
        });

        if (data.expires && Date.now() < data.expires) {
            console.log(`[MEGA] Retrieved pair code for ${number}`);
            return data.code;
        } else {
            await deletePairCode(number);
            return null;
        }

    } catch (err) {
        console.error('[MEGA] Get error:', err.message);
        return null;
    }
}

// ================= DELETE PAIRING CODE =================
async function deletePairCode(number) {
    try {
        await deletePairCodeLocal(number);

        const storage = await connectMEGA();
        if (!storage) return false;

        const folder = await ensureFolder();
        if (!folder) return false;

        const fileName = `${number}.json`;
        const file = folder.children.find(c => c.name === fileName);

        if (file) {
            await new Promise((resolve, reject) => {
                file.delete((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            console.log(`[MEGA] Deleted pair code for ${number}`);
            return true;
        }

        return false;
    } catch (err) {
        console.error('[MEGA] Delete error:', err.message);
        return false;
    }
}

// ================= LOCAL FALLBACK FUNCTIONS =================
async function savePairCodeLocal(number, code) {
    try {
        const dir = path.join(__dirname, '../pairing_codes');
        await fs.ensureDir(dir);
        const filePath = path.join(dir, `${number}.json`);
        await fs.writeJson(filePath, {
            number,
            code,
            timestamp: new Date().toISOString(),
            expires: Date.now() + 2 * 60 * 1000
        });
        console.log(`[Local] Saved pair code for ${number}`);
    } catch (err) {
        console.error('[Local] Save error:', err.message);
    }
}

async function getPairCodeLocal(number) {
    try {
        const filePath = path.join(__dirname, '../pairing_codes', `${number}.json`);
        if (await fs.pathExists(filePath)) {
            const data = await fs.readJson(filePath);
            if (data.expires && Date.now() < data.expires) {
                return data.code;
            } else {
                await deletePairCodeLocal(number);
            }
        }
        return null;
    } catch (err) {
        return null;
    }
}

async function deletePairCodeLocal(number) {
    try {
        const filePath = path.join(__dirname, '../pairing_codes', `${number}.json`);
        if (await fs.pathExists(filePath)) {
            await fs.remove(filePath);
        }
    } catch (err) {}
}

// ================= CLEANUP EXPIRED CODES =================
async function cleanupExpiredCodes() {
    try {
        const storage = await connectMEGA();
        if (!storage) return;

        const folder = await ensureFolder();
        if (!folder) return;

        const now = Date.now();
        const files = folder.children.filter(c => c.name.endsWith('.json'));

        for (const file of files) {
            try {
                const chunks = [];
                const stream = file.download();
                
                await new Promise((resolve, reject) => {
                    stream.on('data', (chunk) => chunks.push(chunk));
                    stream.on('end', resolve);
                    stream.on('error', reject);
                });

                const data = JSON.parse(Buffer.concat(chunks).toString());
                if (data.expires && now > data.expires) {
                    await new Promise((resolve, reject) => {
                        file.delete((err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                    console.log(`[MEGA] Cleaned expired code: ${file.name}`);
                }
            } catch (err) {
                // Skip invalid files
            }
        }
    } catch (err) {
        console.error('[MEGA] Cleanup error:', err.message);
    }
}

// ================= EXPORT FUNCTIONS =================
module.exports = {
    connectMEGA,
    savePairCode,
    getPairCode,
    deletePairCode,
    cleanupExpiredCodes
};
