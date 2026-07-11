const mongoose = require('mongoose');
const config = require('../config');

const connectdb = async () => {
    try {
        mongoose.set('strictQuery', false);
        await mongoose.connect(config.MONGODB_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log("✅ Database Connected Successfully");
    } catch (e) {
        console.error("❌ Database Connection Failed:", e.message);
    }
};

// ====================================
// MODÈLES
// ===================================

const sessionSchema = new mongoose.Schema({
    number: { 
        type: String, 
        required: true, 
        unique: true,
        index: true 
    },
    credentials: {
        // CORRECTION: Utiliser un type Object générique pour stocker
        // l'ensemble de l'objet creds.json de Baileys de manière simple et robuste.
        type: Object,
        required: true
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const userConfigSchema = new mongoose.Schema({
    number: { 
        type: String, 
        required: true, 
        unique: true,
        index: true 
    },
    config: {
        AUTO_RECORDING: { type: String, default: 'false' },
        AUTO_TYPING: { type: String, default: 'false' },
        ANTI_CALL: { type: String, default: 'false' },
        REJECT_MSG: { type: String, default: '*🔕 ʏᴏᴜʀ ᴄᴀʟʟ ᴡᴀs ᴀᴜᴛᴏᴍᴀᴛɪᴄᴀʟʟʏ ʀᴇᴊᴇᴄᴛᴇᴅ..!*' },
        READ_MESSAGE: { type: String, default: 'false' },
        AUTO_VIEW_STATUS: { type: String, default: 'false' },
        AUTO_LIKE_STATUS: { type: String, default: 'false' },
        AUTO_STATUS_REPLY: { type: String, default: 'false' },
        AUTO_STATUS_MSG: { type: String, default: 'Hello from black pather' },
        AUTO_LIKE_EMOJI: { type: Array, default: ['❤️', '👍', '😮', '😎'] }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const otpSchema = new mongoose.Schema({
    number: { 
        type: String, 
        required: true,
        index: true 
    },
    otp: { type: String, required: true },
    config: { type: Object, required: true },
    expiresAt: { 
        type: Date, 
        default: () => new Date(Date.now() + 5 * 60000), // 5 minutes
        index: { expires: '5m' }
    },
    createdAt: { type: Date, default: Date.now }
});

// 4. Numéros actifs (pour reconnexion)
const activeNumberSchema = new mongoose.Schema({
    number: { 
        type: String, 
        required: true, 
        unique: true,
        index: true 
    },
    lastConnected: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    connectionInfo: {
        ip: String,
        userAgent: String,
        timestamp: Date
    }
});

const statsSchema = new mongoose.Schema({
    number: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    commandsUsed: { type: Number, default: 0 },
    messagesReceived: { type: Number, default: 0 },
    messagesSent: { type: Number, default: 0 },
    groupsInteracted: { type: Number, default: 0 }
});

// ====== SUDO USERS (per session) ======
const sudoSchema = new mongoose.Schema({
    botNumber: { type: String, required: true, index: true }, // which session bot
    sudoNumber: { type: String, required: true },
    addedAt: { type: Date, default: Date.now }
});
sudoSchema.index({ botNumber: 1, sudoNumber: 1 }, { unique: true });

// ====== BANNED USERS (per session) ======
const banSchema = new mongoose.Schema({
    botNumber: { type: String, required: true, index: true }, // which session bot
    bannedNumber: { type: String, required: true },
    reason: { type: String, default: 'No reason provided' },
    bannedAt: { type: Date, default: Date.now }
});
banSchema.index({ botNumber: 1, bannedNumber: 1 }, { unique: true });

// ===============================
// DÉFINITION DES MODÈLES
// ===============================

const Session = mongoose.model('Session', sessionSchema);
const UserConfig = mongoose.model('UserConfig', userConfigSchema);
const OTP = mongoose.model('OTP', otpSchema);
const ActiveNumber = mongoose.model('ActiveNumber', activeNumberSchema);
const Stats = mongoose.model('Stats', statsSchema);
const Sudo = mongoose.model('Sudo', sudoSchema);
const Ban = mongoose.model('Ban', banSchema);

// ====================================
// FONCTIONS
// ==================================

// Sauvegarde session
async function saveSessionToMongoDB(number, credentials) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        await Session.findOneAndUpdate(
            { number: cleanNumber },
            { 
                credentials: credentials,
                updatedAt: new Date()
            },
            { upsert: true, new: true }
        );
        console.log(`📁 Session saved to MongoDB for ${cleanNumber}`);
        return true;
    } catch (error) {
        console.error('❌ Error saving session to MongoDB:', error);
        return false;
    }
}

// Récupération session
async function getSessionFromMongoDB(number) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        const session = await Session.findOne({ number: cleanNumber });
        return session ? session.credentials : null;
    } catch (error) {
        console.error('❌ Error getting session from MongoDB:', error);
        return null;
    }
}

// Suppression session
async function deleteSessionFromMongoDB(number) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        await Session.deleteOne({ number: cleanNumber });
        await ActiveNumber.deleteOne({ number: cleanNumber });
        // Optionnel: Supprimer d'autres données liées si le bot est complètement "oublié"
        // await UserConfig.deleteOne({ number: cleanNumber });
        // await Stats.deleteMany({ number: cleanNumber });
        
        console.log(`🗑️ Session deleted from MongoDB for ${cleanNumber}`);
        return true;
    } catch (error) {
        console.error('❌ Error deleting session from MongoDB:', error);
        return false;
    }
}

// Configuration utilisateur
async function getUserConfigFromMongoDB(number) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        const config = await UserConfig.findOne({ number: cleanNumber });
        
        if (config) {
            return config.config;
        } else {
            // Configuration par défaut
            const defaultConfig = {
                AUTO_RECORDING: 'false',
                AUTO_TYPING: 'false',
                ANTI_CALL: 'false',
                REJECT_MSG: '*🔕 ʏᴏᴜʀ ᴄᴀʟʟ ᴡᴀs ᴀᴜᴛᴏᴍᴀᴛɪᴄᴀʟʟʏ ʀᴇᴊᴇᴄᴛᴇᴅ..!*',
                READ_MESSAGE: 'false',
                AUTO_VIEW_STATUS: 'false',
                AUTO_LIKE_STATUS: 'false',
                AUTO_STATUS_REPLY: 'false',
                AUTO_STATUS_MSG: 'Hello from black pather !',
                AUTO_LIKE_EMOJI: ['❤️', '👍', '😮', '😎']
            };
            
            // Sauvegarde configuration par défaut
            await UserConfig.create({
                number: cleanNumber,
                config: defaultConfig
            });
            
            return defaultConfig;
        }
    } catch (error) {
        console.error('❌ Error getting user config from MongoDB:', error);
        return {};
    }
}

// Mise à jour configuration
async function updateUserConfigInMongoDB(number, newConfig) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        await UserConfig.findOneAndUpdate(
            { number: cleanNumber },
            { 
                config: newConfig,
                updatedAt: new Date()
            },
            { upsert: true, new: true }
        );
        console.log(`⚙️ Config updated for ${cleanNumber}`);
        return true;
    } catch (error) {
        console.error('❌ Error updating user config in MongoDB:', error);
        return false;
    }
}

// Gestion OTP
async function saveOTPToMongoDB(number, otp, config) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        await OTP.create({
            number: cleanNumber,
            otp: otp,
            config: config
        });
        console.log(`🔐 OTP saved for ${cleanNumber}`);
        return true;
    } catch (error) {
        console.error('❌ Error saving OTP to MongoDB:', error);
        return false;
    }
}

async function verifyOTPFromMongoDB(number, otp) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        const otpRecord = await OTP.findOne({ 
            number: cleanNumber, 
            otp: otp,
            expiresAt: { $gt: new Date() }
        });
        
        if (!otpRecord) {
            return { valid: false, error: 'Invalid or expired OTP' };
        }
        
        // Supprime OTP après vérification
        await OTP.deleteOne({ _id: otpRecord._id });
        
        return {
            valid: true,
            config: otpRecord.config
        };
    } catch (error) {
        console.error('❌ Error verifying OTP from MongoDB:', error);
        return { valid: false, error: 'Verification error' };
    }
}

// Gestion numéros actifs
async function addNumberToMongoDB(number) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        await ActiveNumber.findOneAndUpdate(
            { number: cleanNumber },
            { 
                lastConnected: new Date(),
                isActive: true
            },
            { upsert: true, new: true }
        );
        return true;
    } catch (error) {
        console.error('❌ Error adding number to MongoDB:', error);
        return false;
    }
}

async function removeNumberFromMongoDB(number) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        await ActiveNumber.deleteOne({ number: cleanNumber });
        return true;
    } catch (error) {
        console.error('❌ Error removing number from MongoDB:', error);
        return false;
    }
}

async function getAllNumbersFromMongoDB() {
    try {
        const activeNumbers = await ActiveNumber.find({ isActive: true });
        return activeNumbers.map(num => num.number);
    } catch (error) {
        console.error('❌ Error getting numbers from MongoDB:', error);
        return [];
    }
}

// Statistiques
async function incrementStats(number, field) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        const today = new Date().toISOString().split('T')[0];
        
        await Stats.findOneAndUpdate(
            { number: cleanNumber, date: today },
            { $inc: { [field]: 1 } },
            { upsert: true, new: true }
        );
    } catch (error) {
        console.error('❌ Error updating stats:', error);
    }
}

async function getStatsForNumber(number) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        const stats = await Stats.find({ number: cleanNumber })
            .sort({ date: -1 })
            .limit(30);
        return stats;
    } catch (error) {
        console.error('❌ Error getting stats:', error);
        return [];
    }
}

// =================================
// SUDO FUNCTIONS
// =================================

async function addSudo(botNumber, sudoNumber) {
    try {
        const cleanBot = botNumber.replace(/[^0-9]/g, '');
        const cleanSudo = sudoNumber.replace(/[^0-9]/g, '');
        await Sudo.findOneAndUpdate(
            { botNumber: cleanBot, sudoNumber: cleanSudo },
            { botNumber: cleanBot, sudoNumber: cleanSudo },
            { upsert: true, new: true }
        );
        return true;
    } catch (e) {
        console.error('❌ addSudo error:', e);
        return false;
    }
}

async function removeSudo(botNumber, sudoNumber) {
    try {
        const cleanBot = botNumber.replace(/[^0-9]/g, '');
        const cleanSudo = sudoNumber.replace(/[^0-9]/g, '');
        await Sudo.deleteOne({ botNumber: cleanBot, sudoNumber: cleanSudo });
        return true;
    } catch (e) {
        console.error('❌ removeSudo error:', e);
        return false;
    }
}

async function getSudoList(botNumber) {
    try {
        const cleanBot = botNumber.replace(/[^0-9]/g, '');
        const list = await Sudo.find({ botNumber: cleanBot });
        return list.map(s => s.sudoNumber);
    } catch (e) {
        console.error('❌ getSudoList error:', e);
        return [];
    }
}

async function isSudo(botNumber, number) {
    try {
        const cleanBot = botNumber.replace(/[^0-9]/g, '');
        const cleanNum = number.replace(/[^0-9]/g, '');
        const found = await Sudo.findOne({ botNumber: cleanBot, sudoNumber: cleanNum });
        return !!found;
    } catch (e) {
        return false;
    }
}

// =================================
// BAN FUNCTIONS
// =================================

async function banUser(botNumber, bannedNumber, reason = 'No reason provided') {
    try {
        const cleanBot = botNumber.replace(/[^0-9]/g, '');
        const cleanBanned = bannedNumber.replace(/[^0-9]/g, '');
        await Ban.findOneAndUpdate(
            { botNumber: cleanBot, bannedNumber: cleanBanned },
            { botNumber: cleanBot, bannedNumber: cleanBanned, reason },
            { upsert: true, new: true }
        );
        return true;
    } catch (e) {
        console.error('❌ banUser error:', e);
        return false;
    }
}

async function unbanUser(botNumber, bannedNumber) {
    try {
        const cleanBot = botNumber.replace(/[^0-9]/g, '');
        const cleanBanned = bannedNumber.replace(/[^0-9]/g, '');
        await Ban.deleteOne({ botNumber: cleanBot, bannedNumber: cleanBanned });
        return true;
    } catch (e) {
        console.error('❌ unbanUser error:', e);
        return false;
    }
}

async function getBanList(botNumber) {
    try {
        const cleanBot = botNumber.replace(/[^0-9]/g, '');
        const list = await Ban.find({ botNumber: cleanBot });
        return list.map(b => ({ number: b.bannedNumber, reason: b.reason, bannedAt: b.bannedAt }));
    } catch (e) {
        console.error('❌ getBanList error:', e);
        return [];
    }
}

async function isBanned(botNumber, number) {
    try {
        const cleanBot = botNumber.replace(/[^0-9]/g, '');
        const cleanNum = number.replace(/[^0-9]/g, '');
        const found = await Ban.findOne({ botNumber: cleanBot, bannedNumber: cleanNum });
        return !!found;
    } catch (e) {
        return false;
    }
}

// =================================
// EXPORTS 
// =================================

module.exports = {
    connectdb,

    Session,
    UserConfig,
    OTP,
    ActiveNumber,
    Stats,
    Sudo,
    Ban,
    
    // Fonctions session
    saveSessionToMongoDB,
    getSessionFromMongoDB,
    deleteSessionFromMongoDB,
    
    // Fonctions configuration
    getUserConfigFromMongoDB,
    updateUserConfigInMongoDB,
    
    // Fonctions OTP
    saveOTPToMongoDB,
    verifyOTPFromMongoDB,
    
    // Fonctions numéros
    addNumberToMongoDB,
    removeNumberFromMongoDB,
    getAllNumbersFromMongoDB,
    
    // Fonctions statistiques
    incrementStats,
    getStatsForNumber,

    // Sudo functions
    addSudo,
    removeSudo,
    getSudoList,
    isSudo,

    // Ban functions
    banUser,
    unbanUser,
    getBanList,
    isBanned,
    
    // Anciennes fonctions (pour compatibilité)
    getUserConfig: async (number) => {
        const config = await getUserConfigFromMongoDB(number);
        return config || {};
    },
    updateUserConfig: updateUserConfigInMongoDB
};
              
