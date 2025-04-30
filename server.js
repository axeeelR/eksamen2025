const { log } = require('console');
const express = require('express');
const path = require('path');
const usersRouter = require('./backend/routes/users.js');

const { getDatabase } = require('./backend/database/instance.js');
const { VarChar } = require('mssql');

const app = express();
const port = 3000;

// View engine setup
app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// In-memory database
let db = [];

// Routes
app.use('/users', usersRouter);

app.get('/', (req, res) => {
    res.render('index', { db });
});

app.get('/login', (req, res) => {
    // console.log("GET mottat")
    res.render('login');
});


app.post('/login', async(req, res) => {
    const bruker = req.body
    try{
        const database = await getDatabase();
        const request = database.poolconnection.request();

        request.input('brukernavn', VarChar(255), bruker.brukernavn);
        request.input('passord', VarChar(255), bruker.passord);
        const result = await request.query(`
            SELECT brukernavn FROM investApp.bruker 
            WHERE brukernavn = @brukernavn AND passord = @passord
            `)
        console.log(result)


        if(result.recordset.length === 0){
            console.log("Feil brukernavn eller passord:")
            return res.status(401).json({ message: 'Feil brukernavn eller passord' });
        }

        console.log(req.body);
        console.log("Innlogging vellykket", bruker.brukernavn);

        res.status(200).json({ message: 'Innlogging vellykket' });

    } catch (error) {
        console.error('Error in POST /login:', error);
        res.status(500).json('Internal Server Error');
    }
});

app.get('/blikunde', (req, res) => {
    res.render('blikunde');
});

app.post('/blikunde', async (req, res) => {
    const bruker = req.body
    try{
        const database = await getDatabase();
        const request = database.poolconnection.request();

        request.input('brukernavn', VarChar(255), bruker.brukernavn);
        const checkResult = await request.query(`
            SELECT brukernavn FROM investApp.bruker 
            WHERE brukernavn = @brukernavn
        `);

        if (checkResult.recordset.length > 0) {
            console.log("Brukernavn er allerede i bruk:", bruker.brukernavn);
            return res.status(400).json({ message: 'Brukernavn er allerede i bruk' });
        }
        
        const insertRequest = database.poolconnection.request();
        insertRequest.input('brukernavn', VarChar(255), bruker.brukernavn);
        insertRequest.input('passord', VarChar(255), bruker.passord);
        insertRequest.input('email', VarChar(255), bruker.email);
        const result = await insertRequest.query(`
            INSERT INTO investApp.bruker (brukernavn, passord, email) 
            VALUES (@brukernavn, @passord, @email)
            `)
        console.log(result)

        if(result.rowsAffected[0] <= 0){
            console.log("Kontoen din ble ikke lagt til")
            return res.status(500).json({ message: 'Kunne ikke opprette bruker' });
        }
        console.log(req.body);
        console.log("Ny bruker registrert:", bruker.brukernavn);
        res.status(201).json({ message: 'Bruker registrert' });

    } catch (error) {
        console.error('Error in POST /blikunde:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/konto', async (req, res) => {
    try {
        const brukernavn = req.headers['brukernavn'];

        if (!brukernavn) {
            return res.status(401).json({ message: 'Brukernavn mangler' });
        }

        const database = await getDatabase();
        const request = database.poolconnection.request();

        // Fetch the user's konto from the database
        request.input('brukernavn', VarChar(255), brukernavn);
        const result = await request.query(`
            SELECT name, value FROM investApp.konto 
            WHERE brukernavn = @brukernavn
        `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Ingen konto funnet for brukeren' });
        }

        res.status(200).json({ items: result.recordset });
    } catch (error) {
        console.error('Error in GET /konto:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.post('/submit', (req, res) => {
    const { name, age } = req.body;
    res.json({ message: 'Data mottatt', name, age });
});



app.listen(port, async () => {
    try {
        await getDatabase();
        console.log('Database connection established on server startup.');
    } catch (error) {
        console.error('Database connection failed on server startup:', error);
    }
    console.log(`Server kjører på http://localhost:${port}`);
});

app.post('/byttepassord', async (req, res) => {
    const { brukernavn, oldPassord, newPassord } = req.body;
    try {
      const database = await getDatabase();
      const request = database.poolconnection.request();
  
      // Verify old password
      request.input('brukernavn', VarChar(255), brukernavn);
      request.input('oldPassord', VarChar(255), oldPassord);
      const verifyResult = await request.query(`
        SELECT brukernavn FROM investApp.bruker
        WHERE brukernavn = @brukernavn AND passord = @oldPassord
      `);
  
      if (verifyResult.recordset.length === 0) {
        return res.status(400).json({ message: 'Old password is incorrect' });
      }
  
      // Update to new password
      const updateRequest = database.poolconnection.request();
      updateRequest.input('brukernavn', VarChar(255), brukernavn);
      updateRequest.input('newPassord', VarChar(255), newPassord);
      const updateResult = await updateRequest.query(`
        UPDATE investApp.bruker
        SET passord = @newPassord
        WHERE brukernavn = @brukernavn
      `);
  
      if (updateResult.rowsAffected[0] === 0) {
        return res.status(500).json({ message: 'Failed to update password' });
      }
  
      res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Error in POST /change-password:', error);
      res.status(500).send('Internal Server Error');
    }
  });
  
  app.get('/byttepassord', (req, res) => {
    res.render('byttepassord');
  });
  