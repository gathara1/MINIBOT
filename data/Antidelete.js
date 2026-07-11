const { DATABASE } = require('../lib/database');
const { DataTypes, QueryTypes } = require('sequelize');
const config = require('../config');

const AntiDelDB = DATABASE.define('AntiDelete', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: false,
        defaultValue: 1,
    },
    status: {
        type: DataTypes.BOOLEAN,
        defaultValue: config.ANTI_DELETE === "true",
    },
}, {
    tableName: 'antidelete',
    timestamps: false,
});

let isInitialized = false;

async function initializeAntiDeleteSettings() {
    if (isInitialized) return;

    try {
        await AntiDelDB.sync();

        await AntiDelDB.findOrCreate({
            where: { id: 1 },
            defaults: {
                id: 1,
                status: config.ANTI_DELETE === "true"
            }
        });

        isInitialized = true;

    } catch (error) {
        console.error('Error initializing anti-delete:', error);
    }
}

async function setAnti(status) {
    try {
        await initializeAntiDeleteSettings();

        const [updated] = await AntiDelDB.update(
            { status: Boolean(status) },
            { where: { id: 1 } }
        );

        return updated > 0;

    } catch (error) {
        console.error('Error setting anti-delete:', error);
        return false;
    }
}

async function getAnti() {
    try {
        await initializeAntiDeleteSettings();

        const record = await AntiDelDB.findByPk(1);

        return record
            ? Boolean(record.status)
            : config.ANTI_DELETE === "true";

    } catch (error) {
        console.error('Error getting anti-delete:', error);
        return config.ANTI_DELETE === "true";
    }
}

module.exports = {
    AntiDelDB,
    initializeAntiDeleteSettings,
    setAnti,
    getAnti,
};
