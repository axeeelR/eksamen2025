const { createDatabaseConnection } = require('./database.js');
const { axel, matti } = require('./config.js');

let databaseInstance = null;

const getDatabase = async () => {
    if (!databaseInstance) {
        databaseInstance = await createDatabaseConnection(axel.passwordConfig);
    }
    return databaseInstance;
};

module.exports = { getDatabase };
