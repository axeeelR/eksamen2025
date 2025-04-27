const sql = require('mssql');

let database = null;

class Database {
  constructor(config) {
    this.config = config;
    this.poolconnection = null;
    this.connected = false;
  }

  async connect() {
    try {
      this.poolconnection = await sql.connect(this.config);
      this.connected = true;
      console.log('Database connected successfully.');
      return this.poolconnection;
    } catch (error) {
      console.error('Error connecting to the database:', error);
      this.connected = false;
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.connected) {
        await this.poolconnection.close();
        this.connected = false;
        console.log('Database disconnected successfully.');
      }
    } catch (error) {
      console.error('Error disconnecting from the database:', error);
    }
  }
  
  async readAll() {
    const request = this.poolconnection.request();
    const result = await request.query("SELECT * FROM Users");

    return result.recordsets[0];
  }

  async create(data) {
    const request = this.poolconnection.request();

    request.input('username', sql.VarChar(255), data.username);
    request.input('email', sql.VarChar(255), data.email);

    const result = await request.query(
      "INSERT INTO [dbo].[Users] ([username], [email]) VALUES (@username, @email)"
    );

    return result.rowsAffected[0];
  }

  async read(id) {
    const request = this.poolconnection.request();
    const result = await request
      .input('id', sql.Int, +id)
      .query("SELECT * FROM Users WHERE user_id = @id");

    return result.recordset[0];
  }

  async update(id, data) {
    const request = this.poolconnection.request();

    request.input('id', sql.Int, +id);
    request.input('username', sql.VarChar(255), data.username);
    request.input('email', sql.VarChar(255), data.email);

    const result = await request.query(
      "UPDATE [dbo].[Users] SET username = @username, email = @email WHERE user_id = @id"
    );

    return result.rowsAffected[0];
  }

  async delete(id) {
    const idAsNumber = Number(id);

    const request = this.poolconnection.request();
    const result = await request
      .input('id', sql.Int, idAsNumber)
      .query("DELETE FROM Users WHERE user_id = @id");

    return result.rowsAffected[0];
  }

  async executeQuery(query) {
    const request = this.poolconnection.request();
    const result = await request.query(query);

    return result.rowsAffected[0];
  }

  async createTable() {
    this.executeQuery(
      "IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Users') BEGIN CREATE TABLE [dbo].[Users]( [user_id] [int] IDENTITY(1,1) NOT NULL, [username] [varchar](255) NOT NULL, [email] [varchar](255) NOT NULL ) ON [PRIMARY] END"
    )
      .then(() => {
        console.log('Users table created');
      })
      .catch((err) => {
        // Table may already exist
        console.error(`Error creating Users table: ${err}`);
      });
  }
}

const createDatabaseConnection = async (passwordConfig) => {
  database = new Database(passwordConfig);
  try {
    await database.connect();
    await database.createTable();
    return database;
  } catch (error) {
    console.error('Failed to create database connection:', error);
    throw error;
  }
};

module.exports = { Database, createDatabaseConnection };
