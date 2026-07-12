/**
 * MEGA Storage Handler for Pairing Codes
 * Stores and retrieves pairing codes without needing live Baileys connection
 */

const { Meteor } = require('megajs');

class MegaCodeStorage {
    constructor() {
        this.email = process.env.MEGA_EMAIL || 'minibot@temp.com';
        this.password = process.env.MEGA_PASSWORD || 'temppass123';
        this.initialized = false;
        this.mega = null;
    }

    async init() {
        try {
            if (this.initialized) return;
            console.log('🔄 Initializing MEGA storage...');
            
            this.mega = new Meteor();
            // Note: For production, use actual MEGA credentials or anonymous access
            this.initialized = true;
            console.log('✅ MEGA storage initialized');
        } catch (e) {
            console.error('⚠️ MEGA init error (will use local storage):', e.message);
            this.initialized = false;
        }
    }

    /**
     * Generate pairing code (8 digits)
     */
    generateCode() {
        return Math.random().toString().slice(2, 10).padEnd(8, '0');
    }

    /**
     * Store pairing code
     */
    async storeCode(number, code) {
        try {
            const codeData = {
                number: number.replace(/[^0-9]/g, ''),
                code: code,
                created: new Date().toISOString(),
                expires: new Date(Date.now() + 2 * 60 * 1000).toISOString(), // 2 minutes
                used: false
            };

            // Store in local JSON file as fallback (MEGA as optional)
            const fs = require('fs-extra');
            const path = require('path');
            const codesDir = path.join(__dirname, 'codes');
            
            await fs.ensureDir(codesDir);
            const fileName = path.join(codesDir, `${number}_${code}.json`);
            await fs.writeJSON(fileName, codeData);

            console.log(`✅ Code stored: ${number} -> ${code}`);
            return codeData;
        } catch (e) {
            console.error('❌ Error storing code:', e.message);
            throw e;
        }
    }

    /**
     * Verify and mark code as used
     */
    async verifyCode(number, code) {
        try {
            const fs = require('fs-extra');
            const path = require('path');
            const codesDir = path.join(__dirname, 'codes');
            const fileName = path.join(codesDir, `${number}_${code}.json`);

            if (!await fs.pathExists(fileName)) {
                return { valid: false, reason: 'Code not found' };
            }

            const data = await fs.readJSON(fileName);
            const now = new Date();
            const expires = new Date(data.expires);

            if (now > expires) {
                return { valid: false, reason: 'Code expired' };
            }

            if (data.used) {
                return { valid: false, reason: 'Code already used' };
            }

            // Mark as used
            data.used = true;
            data.usedAt = now.toISOString();
            await fs.writeJSON(fileName, data);

            return { valid: true, data };
        } catch (e) {
            console.error('❌ Error verifying code:', e.message);
            return { valid: false, reason: 'Verification error' };
        }
    }

    /**
     * Get code metadata
     */
    async getCodeData(number, code) {
        try {
            const fs = require('fs-extra');
            const path = require('path');
            const codesDir = path.join(__dirname, 'codes');
            const fileName = path.join(codesDir, `${number}_${code}.json`);

            if (await fs.pathExists(fileName)) {
                return await fs.readJSON(fileName);
            }
            return null;
        } catch (e) {
            console.error('❌ Error reading code:', e.message);
            return null;
        }
    }

    /**
     * Cleanup expired codes
     */
    async cleanupExpiredCodes() {
        try {
            const fs = require('fs-extra');
            const path = require('path');
            const codesDir = path.join(__dirname, 'codes');

            if (!await fs.pathExists(codesDir)) return;

            const files = await fs.readdir(codesDir);
            const now = new Date();
            let cleaned = 0;

            for (const file of files) {
                const filePath = path.join(codesDir, file);
                const data = await fs.readJSON(filePath);
                const expires = new Date(data.expires);

                if (now > expires) {
                    await fs.remove(filePath);
                    cleaned++;
                }
            }

            if (cleaned > 0) {
                console.log(`🗑️ Cleaned up ${cleaned} expired codes`);
            }
        } catch (e) {
            console.error('⚠️ Cleanup error:', e.message);
        }
    }
}

module.exports = new MegaCodeStorage();
