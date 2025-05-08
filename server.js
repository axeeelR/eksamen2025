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

const yahooFinance = require('yahoo-finance2').default;

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

    if (!bruker.brukernavn || !bruker.passord || !bruker.email) {
        return res.status(400).json({ message: 'Brukernavn, passord og email må oppgis' });
    }

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
      const {kontoNavn, opprettelsedatoK, saldo, bank, valuta, brukernavn} = req.body
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
        
        const insertRequest = database.poolconnection.request();
        insertRequest.input('kontoNavn', sql.VarChar(255), kontoNavn);
        insertRequest.input('opprettelsedatoK', sql.Date, formattedOpprettelsedatoK);
        insertRequest.input('saldo', sql.BigInt, saldo);
        insertRequest.input('bank', sql.VarChar(255), bank);
        insertRequest.input('valuta', sql.VarChar(255), valuta);
        insertRequest.input('brukerID', sql.Int, brukerID); // Bruk sql.Int for integer

        const result = await insertRequest.query(`
            INSERT INTO investApp.konto (kontoNavn, saldo, opprettelsedatoK, bank, valuta, brukerID) 
            VALUES (@kontoNavn, @saldo, @opprettelsedatoK, @bank, @valuta, @brukerID)
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

app.get('/portefolje', (req, res) => {
    res.render('portefolje');
});

app.get('/api/portefolje', async (req, res) => {
  const brukernavn = req.headers['brukernavn']; // Hent brukernavn fra query-parameter
  
  try {
    const { poolconnection } = await getDatabase();
    const result = await poolconnection.request().input('brukernavn', sql.VarChar(255), brukernavn).query(
    'SELECT p.portefoljeID, p.portefoljeNavn, p.opprettelsedatoP, k.kontoNavn, k.saldo FROM investApp.portefolje p JOIN investApp.konto k ON p.kontoID = k.kontoID JOIN investApp.bruker b ON k.brukerID = b.brukerID WHERE b.brukernavn = @brukernavn');

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Ingen porteføljer funnet for brukeren' });
    }
    
    res.json(result.recordset);
  } catch (error) {
    console.error('FEIL i GET /portefolje:', error);
    res.status(500).json({message:'Kunne ikke hente porteføljer'});
  }
});

app.post('/transaksjoner', async (req, res) => {
  const {kontoID, portefoljeID, ISIN, verditype, opprettelsedatoK, verdiPapirPris, mengde, totalSum, totalGebyr, transaksjonsID} = req.body
});



app.get('/opprettPortefolje', async (req, res) => {
  const brukernavn = req.query.brukernavn; // Hent brukernavn fra query-parameter
  
  try {
    const database = await getDatabase();
    const request = database.poolconnection.request();
    request.input('brukernavn', sql.VarChar(255), brukernavn);

    const result = await request.query(`SELECT k.kontoID, k.kontoNavn, k.saldo FROM investApp.konto k JOIN investApp.bruker b on k.brukerID = b.brukerID WHERE b.brukernavn = @brukernavn`);
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

  if (!navn || !kontoID) {
    return res.status(400).json({ message: 'Portefoljenavn og kontoID må oppgis' });
  }

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

    res.redirect('/portefolje?brukernavn=' + req.body.brukernavn); // Redirect to portefolje page with brukernavn as query parameter
} catch (error) {
    console.error('Feil i POST /opprettPortefolje:', error);
    res.status(500).send(error.message);
  }
});

app.put('/lukk-konto', async (req, res) => {
  const kontoID = req.body.kontoID;

  try{
    const database = await getDatabase();
    const request = database.poolconnection.request();

    request.input('kontoID', sql.Int, kontoID);
    request.input('lukkedatoK', sql.DateTime, new Date()); // Setter lukkedato til nåværende dato og tid

    const result = await request.query(`
       UPDATE investApp.konto
       SET lukkedatoK = @lukkedatoK
        WHERE kontoID = @kontoID
        `);

       res.json({message: 'konto lukket', success: true});
  }catch(error){
      console.log('Error', error);
    }
  });
  
  app.put('/gjenopne-konto', async (req, res) => {
    const kontoID = req.body.kontoID;
  
    try{
      const database = await getDatabase();
      const request = database.poolconnection.request();
  
      request.input('kontoID', sql.Int, kontoID);
      request.input('lukkedatoK', sql.DateTime, null); 
  
      await request.query(`
         UPDATE investApp.konto
         SET lukkedatoK = @lukkedatoK
          WHERE kontoID = @kontoID
          `);
  
        res.json({message: 'konto gjenåpnet', success: true});
       }catch(error){
        console.log('Error', error);
      }
    });

app.get('/indsettelse', async (req, res) => {
  res.render('indsettelse');
});

app.post('/indsettelse', async (req, res) => {
  const { kontoID, valuta, verdi, type } = req.body;

  try {
    const { poolconnection } = await getDatabase();

    const saldoResult = await poolconnection.request()
      .input('kontoID', sql.Int, kontoID)
      .query('SELECT saldo FROM investApp.konto WHERE kontoID = @kontoID');

    if (saldoResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Konto ikke funnet' });
    }

    let saldo = saldoResult.recordset[0].saldo;
    const beløp = parseFloat(verdi);

    if (type === 'innskudd') {
      saldo += beløp;
    } else if (type === 'uttak') {
      if (saldo < beløp) return res.status(400).json({ message: 'Ikke nok saldo' });
      saldo -= beløp;
    } else {
      return res.status(400).json({ message: 'Ugyldig type' });
    }

    await poolconnection.request()
      .input('kontoID', sql.Int, kontoID)
      .input('saldo', sql.Decimal(18, 2), saldo)
      .query('UPDATE investApp.konto SET saldo = @saldo WHERE kontoID = @kontoID');

    await poolconnection.request()
      .input('kontoID', sql.Int, kontoID)
      .input('valuta', sql.VarChar(10), valuta)
      .input('verdi', sql.Decimal(18, 2), beløp)
      .input('dato_tidspunkt', sql.DateTime, new Date())
      .input('type', sql.VarChar(10), type)
      .input('saldoEtter', sql.Decimal(18, 2), saldo)
      .query(`
        INSERT INTO investApp.indsettelse 
        (kontoID, valuta, verdi, dato_tidspunkt, type, saldoEtter)
        VALUES (@kontoID, @valuta, @verdi, @dato_tidspunkt, @type, @saldoEtter)
      `);

    res.status(200).json({ message: 'Transaksjon registrert', nySaldo: saldo });

  } catch (error) {
    console.error('Feil i POST /indsettelse:', error);
    res.status(500).json({ message: 'Intern feil' });
  }
});

app.get('/enkeltPortefolje', async (req, res) => {
  res.render('enkeltPortefolje');
});

app.get('/api/portefolje/:portefoljeID/info', async (req, res) => {
  const portefoljeID = req.params.portefoljeID;

  try {
    const { poolconnection } = await getDatabase();
    const result = await poolconnection.request()
      .input('portefoljeID', sql.Int, portefoljeID)
      .query(`
        SELECT p.portefoljeNavn 
        FROM investApp.portefolje p 
        WHERE p.portefoljeID = @portefoljeID`);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Portefølje ikke funnet' });
    }

    res.json(result.recordset[0]);

  } catch (error) {
    console.error('Feil i GET /api/portefolje/:id:', error);
    res.status(500).json({ message: 'Intern feil' });
  }
});

app.get('/api/aksje/:navn', async (req, res) => {
  const søk = req.params.navn;

  try {
  const result = await yahooFinance.search(søk); // Søk etter aksje
  const førsteTreff = result.quotes?.[0]

  if (!førsteTreff) {
    return res.status(404).json({ message: 'Ingen treff funnet for søket' });
  }

  const aksjeData = await yahooFinance.quote(førsteTreff.symbol); // Hent detaljer
  res.json(aksjeData);

} catch (error) {
  console.error('Feil i aksjesøk:', error);
  res.status(500).json({ message: 'Klarte ikke hente aksjeinformasjon' });
  }
});

app.get('/handel', (req, res) => {
  res.render('handel');
});

app.get('/api/konto-status/:portefoljeID', async (req, res) => {
  const portefoljeID = req.params.portefoljeID;

  try{
    const database = await getDatabase();
    const result = await database.poolconnection.request()

    .input('portefoljeID', sql.Int, portefoljeID)
    .query(`
      SELECT k.kontoID, k.lukkedatoK
      FROM investApp.portefolje p
      JOIN investApp.konto k ON p.kontoID = k.kontoID
      WHERE p.portefoljeID = @portefoljeID
      `);

    if(result.recordset.length === 0){
      return res.status(404).json({ message: 'Fant verken portofølje eller konto'})
    }
    res.json(result.recordset[0]);
   

  } catch(err){
    console.error(err);
    res.status(500).json({ message:'intern feil ved henting av kontostatus'})
  }
});


app.get('/transaksjon', (req, res) => {
  res.render('transaksjon');
});

app.post('/transaksjon', async (req, res) => {
  const { 
    portefoljeID, 
    ISIN, 
    verditype, 
    opprettelsedatoT, 
    verdiPapirPris, 
    mengde, 
    totalSum, 
    totalGebyr,
    type 
  } = req.body;

  try{
    const database = await getDatabase();

    const kontoResultat = await database.poolconnection.request()
      .input('portefoljeID', sql.Int, portefoljeID)
      .query('SELECT kontoID FROM investApp.portefolje WHERE portefoljeID = @portefoljeID');

      if (kontoResultat.recordset.length === 0) {
        return res.status(404).json({ message: 'Portefølje ikke funnet' });
      }
      const hentetKontoID = kontoResultat.recordset[0].kontoID;

      const saldoResultat = await database.poolconnection.request()
      .input('kontoID', sql.Int, hentetKontoID)
      .query('SELECT saldo FROM investApp.konto WHERE kontoID = @kontoID');

      let saldo = saldoResultat.recordset[0].saldo;

      if (type === 'kjøp') {
        if (saldo < totalSum) {
          return res.status(400).json({ message: 'Ikke nok penger på konto' });
        }
        saldo -= totalSum;
      } else if (type === 'salg') {
        saldo += totalSum;
      } else {
        return res.status(400).json({ message: 'Ugyldig type' });
      }
      await database.poolconnection.request()
        .input('kontoID', sql.Int, hentetKontoID)
        .input('saldo', sql.Decimal(18, 2), saldo)
        .query('UPDATE investApp.konto SET saldo = @saldo WHERE kontoID = @kontoID');

        await database.poolconnection.request()
        .input('kontoID', sql.Int, hentetKontoID)
        .input('portefoljeID', sql.Int, portefoljeID)
        .input('ISIN', sql.VarChar(255), ISIN) 
        .input('verditype', sql.VarChar(255), verditype)
        .input('opprettelsedatoT', sql.Date, opprettelsedatoT)
        .input('verdiPapirPris', sql.Decimal(18, 2), verdiPapirPris)
        .input('mengde', sql.Int, mengde)
        .input('totalSum', sql.Decimal(18, 2), totalSum)
        .input('totalGebyr', sql.Decimal(18, 2), totalGebyr) 
        .query(`
          INSERT INTO investApp.transaksjon 
          (kontoID, portefoljeID, ISIN, verditype, opprettelsedatoT, verdiPapirPris, mengde, totalSum, totalGebyr)
          VALUES (@kontoID, @portefoljeID, @ISIN, @verditype, @opprettelsedatoT, @verdiPapirPris, @mengde, @totalSum, @totalGebyr)`
        );
        res.status(200).json({ message: 'Handel registrert'});

    } catch (error) {
      console.error('Feil i POST /transaksjon:', error);
      res.status(500).json({ message: 'Intern feil' });
    }
});

/*--------------------------------------------------------------------- */

app.post('/api/portefolje/verdiutvikling', async (req, res) => {
  const { portefoljeID } = req.body;
  try {
    const database = await getDatabase();
    const result = await database.poolconnection.request()
      .input('portefoljeID', sql.Int, portefoljeID)
      .query(`
        SELECT opprettelsedatoT, ISIN, mengde, verdiPapirPris
        FROM investApp.transaksjon 
        WHERE portefoljeID = @portefoljeID
        ORDER BY opprettelsedatoT DESC
        `);

        const transaksjoner = result.recordset;
        const dagligVerdiutvikling = {};

        for (const transaksjon of transaksjoner) {
          const dato = new Date(transaksjon.opprettelsedatoT).toISOString().split('T')[0];
          const mengde = transaksjon.mengde;
          const verdiPapirPris = transaksjon.verdiPapirPris;

      if (!dagligVerdiutvikling[dato]) {
        dagligVerdiutvikling[dato] = 0;
      }
      dagligVerdiutvikling[dato] += mengde * verdiPapirPris;
      }
      const verdiHistorikk = Object.keys(dagligVerdiutvikling)
      .sort()
      .map(dato => ({
        dato,
        verdi: dagligVerdiutvikling[dato],
    }));
  res.json(verdiHistorikk);
  }
  catch (error) {
    console.error('Feil i POST /api/portefolje/verdiutvikling:', error);
    res.status(500).json({ message: 'Intern feil' });
  }
});

app.post('/api/portefolje/verdi', async (req, res) => {
  const { portefoljeID } = req.body;
  try {
    const database = await getDatabase();
    const result = await database.poolconnection.request()
      .input('portefoljeID', sql.Int, portefoljeID)
      .query(`
        SELECT ISIN, SUM(mengde) AS totalMengde
        FROM investApp.transaksjon 
        WHERE portefoljeID = @portefoljeID
        GROUP BY ISIN
      `);

      const aksjer = result.recordset;
      let totalVerdi = 0;

      for (const aksje of aksjer) {
        try {
          const markedsdata = await yahooFinance.quote(aksje.ISIN);
          const pris = markedsdata.regularMarketPrice;
          const verdi = pris * aksje.totalMengde;
          totalVerdi += verdi; 

    } catch (feil) {
      console.error('Feil med en aksje:', feil);
    }
  }
  res.json({ totalVerdi });
  }
  catch (error) {
    console.error('Feil i POST /api/portefolje/verdi:', error);
    res.status(500).json({ message: 'Intern feil' });
  }
});
  
app.get('/handelshistorikk', (req, res) => {
  res.render('handelshistorikk');
});

app.get('/api/handelshistorikk/:portefoljeID', async (req, res) => {
  try {
    const portefoljeID = req.params.portefoljeID;

    const database = await getDatabase();
    const result = await database.poolconnection.request()
      .input('portefoljeID', sql.Int, portefoljeID)
      .query(`
        SELECT * FROM investApp.transaksjon 
        WHERE portefoljeID = @portefoljeID
        ORDER by opprettelsedatoT DESC
      `);

    res.json(result.recordset);
  }
  catch (error) {
    console.error('Feil i POST /api/handelshistorikk:', error);
    res.status(500).json({ message: 'Intern feil' });
  }
}
);  

app.post('/innskuddshistorikk', async (req, res) => {
  const { kontoID } = req.body;
  const parsedKontoID = parseInt(kontoID, 10);

  if (!kontoID) {
    return res.status(400).json({ message: 'KontoID mangler' });
  }
  try {  
    const database = await getDatabase();
    const result = await database.poolconnection.request()
    .input('kontoID', sql.Int, parsedKontoID)
    .query(`
      SELECT * FROM investApp.indsettelse 
      WHERE kontoID = @kontoID
      ORDER by dato_tidspunkt DESC
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Feil i POST /innskuddshistorikk:', error);
    res.status(500).json({ message: 'Intern feil' });
  }
});

app.get('/innskuddshistorikk', (req, res) => {
  res.render('innskuddshistorikk');
});

app.get('/api/portefolje/:portefoljeID/fordeling', async (req, res) => {
  const portefoljeID = req.params.portefoljeID;

  try {
    const database = await getDatabase();
    const result = await database.poolconnection.request()
      .input('portefoljeID', sql.Int, portefoljeID)
      .query(`
        SELECT ISIN, SUM(mengde * verdiPapirPris) AS totalMengde
        FROM investApp.transaksjon
        WHERE portefoljeID = @portefoljeID
        GROUP BY ISIN
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Feil i GET /api/portefolje/:portefoljeID/fordeling:', error);
  }
});

app.post('/aksjeienkeltportefolje', async (req, res) => {
  const {portefoljeID} = req.body;

  if (!portefoljeID) {
    return res.status(400).json({ message: 'PortefoljeID mangler' });
  }
  try {
    const database = await getDatabase();
    const aksjeResultat = await database.poolconnection.request()
      .input('portefoljeID', sql.Int, portefoljeID)
      .query(`
        SELECT ISIN, SUM(mengde) AS totalMengde 
        FROM investApp.transaksjon
        WHERE portefoljeID = @portefoljeID
        Group by ISIN
      `);
      
        const aksjer = aksjeResultat.recordset;

        const aksjeData = await Promise.all(
          aksjer.map(async (aksje) => {;
            try {
              const markedsdata = await yahooFinance.quote(aksje.ISIN);
              return {
                navn: markedsdata.shortName || aksje.ISIN,
                pris: markedsdata.regularMarketPrice,
                endringProsent: markedsdata.regularMarketChangePercent,
                antall: aksje.totalMengde,
                totalVerdi: markedsdata.regularMarketPrice * aksje.totalMengde,
              };
            } catch (feil) {
              console.error('Feil ved henting av aksjeinformasjon:', feil);
              return null;
            }
          })
        );
        const aksjeDataFiltrert = aksjeData.filter(aksje => aksje !== null);
        res.json(aksjeDataFiltrert);
    
  }
  catch (error) {
    console.error('Feil i POST /aksjeienkeltportefolje:', error);
    res.status(500).json({ message: 'Intern feil' });
  }
});

app.post('/topp5AksjerGevinst', async (req, res) => {
  const brukernavn = req.headers['brukernavn'];
    try {
      const database = await getDatabase();
      const brukerResultat = await database.poolconnection.request()
        .input('brukernavn', sql.VarChar(255), brukernavn)
        .query(`
          SELECT brukerID from investApp.bruker 
          WHERE brukernavn = @brukernavn
        `);
      const brukerID = brukerResultat.recordset[0].brukerID;
      const aksjeResultat = await database.poolconnection.request()
        .input('brukerID', sql.Int, brukerID)
        .query(`
          SELECT ISIN, p.portefoljeNavn, 
          SUM(mengde) AS totalMengde,
          SUM(t.mengde * t.verdiPapirPris) / NULLIF(SUM(t.mengde),0) AS snittKjøpspris
          FROM investApp.transaksjon t
          JOIN investApp.portefolje p ON t.portefoljeID = p.portefoljeID
          JOIN investApp.konto k ON p.kontoID = k.kontoID
          WHERE k.brukerID = @brukerID
          GROUP BY t.ISIN, p.portefoljeNavn
        `);
      const aksjer = [];
      for (const rad of aksjeResultat.recordset) {
        try {
          const markedsdata = await yahooFinance.quote(rad.ISIN);
          const pris = markedsdata.regularMarketPrice;
          const endring = markedsdata.regularMarketChangePercent;

          const gevinst = (pris - rad.snittKjøpspris) * rad.totalMengde;
          aksjer.push({
            navn: markedsdata.shortName || rad.ISIN,
            portefolje: rad.portefoljeNavn,
            gevinst: gevinst.toFixed(2),
            endring24h: endring?.toFixed(2) || 0 
          });
        } catch (feil) {
          console.error('Feil ved henting av aksjeinformasjon:', feil);
        }
      }
      const top5 = aksjer.sort((a, b) => b.gevinst - a.gevinst).slice(0, 5);
      res.json(top5); 
   } catch (error) {
    console.error('Feil i POST /topp5AksjerGevinst:', error);
    res.status(500).json({ message: 'Intern feil' });
   }
});

app.post('/topp5AksjerVerdi', async (req, res) => {
  const brukernavn = req.headers['brukernavn'];
    try {
      const database = await getDatabase();
      const brukerResultat = await database.poolconnection.request()
        .input('brukernavn', sql.VarChar(255), brukernavn)
        .query(`
          SELECT brukerID from investApp.bruker 
          WHERE brukernavn = @brukernavn
        `);
      const brukerID = brukerResultat.recordset[0].brukerID;
      const aksjeResultat = await database.poolconnection.request()
        .input('brukerID', sql.Int, brukerID)
        .query(`
          SELECT ISIN, p.portefoljeNavn, SUM(mengde) AS totalMengde 
          FROM investApp.transaksjon t
          JOIN investApp.portefolje p ON t.portefoljeID = p.portefoljeID
          JOIN investApp.konto k ON p.kontoID = k.kontoID
          WHERE k.brukerID = @brukerID
          GROUP BY t.ISIN, p.portefoljeNavn
        `);
      const aksjer = [];
      for (const rad of aksjeResultat.recordset) {
        try {
          const markedsdata = await yahooFinance.quote(rad.ISIN);
          const pris = markedsdata.regularMarketPrice;
          aksjer.push({
            navn: markedsdata.shortName || rad.ISIN,
            portefolje: rad.portefoljeNavn,
            verdi: (pris * rad.totalMengde).toFixed(2),
            endring24h: markedsdata.regularMarketChangePercent?.toFixed(2) || 0 
          });
        } catch (feil) {
          console.error('Feil ved henting av aksjeinformasjon:', feil);
        }
      }
      const top5 = aksjer.sort((a, b) => b.verdi - a.verdi).slice(0, 5);
      res.json(top5); 
   } catch (error) {
    console.error('Feil i POST /topp5AksjerVerdi:', error);
    res.status(500).json({ message: 'Intern feil' });
   }
}
);


app.listen(port, async () => {
  try {
      await getDatabase();
      console.log('Database connection established on server startup.');
  } catch (error) {
      console.error('Database connection failed on server startup:', error);
  }
  console.log(`Server kjører på http://localhost:${port}`);
});
//Testing ------------------------------------------------------------------------------------------

module.exports = app;

//--------------------------------------------------------------------------------------------------
