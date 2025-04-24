const { createDatabaseConnection } = require('./database.js');
const { passwordConfig: SQLAuthentication } = require('./config.js');

let databaseInstance = null;

const getDatabase = async () => {
    if (!databaseInstance) {
        databaseInstance = await createDatabaseConnection(SQLAuthentication);
    }
    return databaseInstance;
};

module.exports = { getDatabase };
