const { log } = require('console');
const express = require('express');
const path = require('path');
const usersRouter = require('./backend/routes/users.js');

const { getDatabase } = require('./backend/database/instance.js');
const { VarChar } = require('mssql');
const sql = require('mssql'); // Importer hele mssql-biblioteket

const app = express();
const port = 3000;

// View engine setup
app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.listen(port, async () => {
    try {
        await getDatabase();
        console.log('Database connection established on server startup.');
    } catch (error) {
        console.error('Database connection failed on server startup:', error);
    }
    console.log(`Server kjører på http://localhost:${port}`);
});

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

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
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

app.get('/konto', (req, res) => {
    res.render('konto');
});

app.get('/api/konto', async (req, res) => {
    const brukernavn = req.headers['brukernavn']; 
    console.log('Brukernavn mottatt fra headers:', brukernavn); // Logg brukernavn
    if (!brukernavn) {
      console.error('Ingen brukernavn mottatt i headers.');
      return res.status(401).json({ message: 'Ikke logget inn' });
    }
  
    try {
      const database = await getDatabase();
  
      // Hent brukerID først
      const brukerResult = await database.poolconnection.request()
        .input('brukernavn', sql.VarChar(255), brukernavn)
        .query('SELECT brukerID FROM investApp.bruker WHERE brukernavn = @brukernavn');
  
      if (brukerResult.recordset.length === 0) {
        return res.status(404).json({ message: 'Bruker ikke funnet' });
      }
  
      const brukerID = brukerResult.recordset[0].brukerID;
  
      // Hent kontoene
      const kontoResult = await database.poolconnection.request()
        .input('brukerID', sql.Int, brukerID)
        .query('SELECT * FROM investApp.konto WHERE brukerID = @brukerID');
  
      res.json(kontoResult.recordset);
    } catch (error) {
      console.error('Error in GET /api/konto:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
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
  

app.post('/opprettKonto', async (req, res) => {
    try{
      const {kontoNavn, opprettelsedatoK, saldo, bank, lukkedatoK, valuta, brukernavn} = req.body
        const database = await getDatabase();

        const brukerResult = await database.poolconnection.request()

      .input('brukernavn', sql.VarChar(255), brukernavn)
      .query('SELECT brukerID FROM investApp.bruker WHERE brukernavn = @brukernavn');

    if (brukerResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Bruker ikke funnet' });
    }

    const brukerID = brukerResult.recordset[0].brukerID;

    //formatere datoene til YYYY-MM-DD
    const formattedOpprettelsedatoK = new Date(opprettelsedatoK).toISOString().split('T')[0];
    const formattedLukkedatoK = lukkedatoK ? new Date(lukkedatoK).toISOString().split('T')[0] : null;
        
        const insertRequest = database.poolconnection.request();
        insertRequest.input('kontoNavn', sql.VarChar(255), kontoNavn);
        insertRequest.input('opprettelsedatoK', sql.Date, formattedOpprettelsedatoK);
        insertRequest.input('saldo', sql.BigInt, saldo);
        insertRequest.input('bank', sql.VarChar(255), bank);
        insertRequest.input('lukkedatoK', sql.Date, formattedLukkedatoK);
        insertRequest.input('valuta', sql.VarChar(255), valuta);
        insertRequest.input('brukerID', sql.Int, brukerID); // Bruk sql.Int for integer

        const result = await insertRequest.query(`
            INSERT INTO investApp.konto (kontoNavn, saldo, opprettelsedatoK, bank, lukkedatoK, valuta, brukerID) 
            VALUES (@kontoNavn, @saldo, @opprettelsedatoK, @bank, @lukkedatoK, @valuta, @brukerID)
            `)
        console.log(result)

         if(result.rowsAffected[0] === 0){
            console.log("Kontoen din ble ikke opprettet")
            return res.status(500).json({ message: 'Kunne ikke opprette konto' });
        }
        console.log(req.body);
        console.log("Ny konto registrert:", kontoNavn);
        res.status(201).json({ message: 'Konto opprettet' });

    } catch (error) {
        console.error('Error in POST /opprettKonto:', error);
        res.status(500).json({message:'Internal Server Error'});
    }
});

app.get('/opprettKonto', (req, res) => {
    res.render('opprettKonto');
});

app.get('/dashboard', (req, res) => {
    res.render('dashboard');
});

app.get('/portofolje', (req, res) => {
    res.render('portofolje');
});

app.post('/transaksjoner', async (req, res) => {
  const {kontoID, portefoljeID, ISIN, verditype, opprettelsedatoK, verdiPapirPris, mengde, totalSum, totalGebyr, transaksjonsID} = req.body
});

/*---------------------------------------------------------*/
/* Opprette portefølje */

app.get('/opprettPortefolje', async (req, res) => {
  try {
    const database = await getDatabase();
    const request = database.poolconnection.request();
    const result = await request.query('SELECT kontoID, kontoNavn, saldo FROM investApp.konto');
    const kontoer = result.recordset;

    console.log('Kontoer hentet fra databasen:', kontoer); //debug
    res.render('opprettPortefolje', { kontoer });
  } catch (error) {
    console.error('FEIL i GET /opprettPortefolje:', error);
    res.status(500).send('Noe er feil');
  }
});

app.post('/opprettPortefolje', async (req, res) => {
  const { navn, kontoID } = req.body;
  const dato = new Date().toISOString().split('T')[0]; // Formater dato til YYYY-MM-DD

  try {
    const { poolconnection } = await getDatabase();
    await poolconnection.request()
    .input('portefoljeNavn', sql.VarChar(255), navn)
    .input('kontoID', sql.Int, kontoID)
    .input('opprettelsedatoP', sql.Date, dato)
    .query(`
      INSERT INTO investApp.portefolje (portefoljeNavn, kontoID, opprettelsedatoP)
      VALUES (@portefoljeNavn, @kontoID, @opprettelsedatoP)
    `);

    res.redirect('/portofolje');
} catch (error) {
    console.error('Feil i POST /opprettPortefolje:', error);
    res.status(500).send(error.message);
  }
});

