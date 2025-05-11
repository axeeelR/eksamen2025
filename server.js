//Konfigurasjon og de ulike avhengighetene
const express = require('express');
const path = require('path');
const { getDatabase } = require('./backend/database/instance.js');
const { VarChar } = require('mssql');
const sql = require('mssql'); // Importer hele mssql-biblioteket
const yahooFinance = require('yahoo-finance2').default;

const app = express();
const port = 3000;

//ordner slik at view engine kan bruke ejs og fastsetter view- og public-mapper
app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

//Middleware for å kunne lese body innhold i ulike POST-requests
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

//Viser index siden
app.get('/', (req, res) => {
    res.render('index');
});

//Viser login siden
app.get('/login', (req, res) => {
    // console.log("GET mottat")
    res.render('login');
});

//Logger inn brukeren ved å verifisere brukernavn og passord i databasen
app.post('/login', async(req, res) => {
    const bruker = req.body
    try{
        const database = await getDatabase(); //Etablerer database koblingen (brukes også gjentagende nedover i koden)
        const request = database.poolconnection.request(); //Lager en ny SQL-request

        //Setter parametre og kjører en SELECT spørring som verfiiserer innloggingen av brukeren
        request.input('brukernavn', VarChar(255), bruker.brukernavn);
        request.input('passord', VarChar(255), bruker.passord);
        const result = await request.query(`
            SELECT brukernavn FROM investApp.bruker 
            WHERE brukernavn = @brukernavn AND passord = @passord
            `)
        console.log(result)

        //Hvis ingen treff = ugyldig login
        if(result.recordset.length === 0){
            console.log("Feil brukernavn eller passord:")
            return res.status(401).json({ message: 'Feil brukernavn eller passord' });
        }

        console.log(req.body);
        console.log("Innlogging vellykket", bruker.brukernavn);

        res.status(200).json({ message: 'Innlogging vellykket' });

    } catch (error) {
        console.error('Error in POST /login:', error);
        res.status(500).json('Error i serveren');
    }
});

app.get('/logout', (req, res) => {  
    res.redirect('/logout');
});

//viser skjema for ny bruker
app.get('/blikunde', (req, res) => {
    res.render('blikunde');
});

//Oppretter ny bruker i databasen
app.post('/blikunde', async (req, res) => {
    const bruker = req.body

    //Sjekker at alle felt er med 
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

        //sjekker om brukernavnet allerede finnes
        if (checkResult.recordset.length > 0) {
            console.log("Brukernavn er allerede i bruk:", bruker.brukernavn);
            return res.status(400).json({ message: 'Brukernavn er allerede i bruk' });
        }
        
        //Setter inn en ny bruker
        const insertRequest = database.poolconnection.request();
        insertRequest.input('brukernavn', VarChar(255), bruker.brukernavn);
        insertRequest.input('passord', VarChar(255), bruker.passord);
        insertRequest.input('email', VarChar(255), bruker.email);
        const result = await insertRequest.query(`
            INSERT INTO investApp.bruker (brukernavn, passord, email) 
            VALUES (@brukernavn, @passord, @email)
            `)
        console.log(result)

        //sjekker at indsendinger faktisk har skjedd
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

//----------------------------------------------------------------------------------------
//Viser kontosiden i frontend
app.get('/konto', (req, res) => {
    res.render('konto');
});

//API endepunkt som returnerer alle kontoer tilknyttet den innloggete brukeren
app.get('/api/konto', async (req, res) => {
    const brukernavn = req.headers['brukernavn']; //Hent brukernavn fra header
    console.log('Brukernavn mottatt fra headers:', brukernavn); // Logg brukernavn
    if (!brukernavn) {
      console.error('Ingen brukernavn mottatt i headers.');
      return res.status(401).json({ message: 'Ikke logget inn' });
    }
  
    try {
      const database = await getDatabase();
  
      // Hent brukerID basert på bruker ideen
      const brukerResult = await database.poolconnection.request()
        .input('brukernavn', sql.VarChar(255), brukernavn)
        .query('SELECT brukerID FROM investApp.bruker WHERE brukernavn = @brukernavn');
  
      if (brukerResult.recordset.length === 0) {
        return res.status(404).json({ message: 'Bruker ikke funnet' });
      }
  
      const brukerID = brukerResult.recordset[0].brukerID;
  
      // Hent alle kontoer som tilhører brukerID
      const kontoResult = await database.poolconnection.request()
        .input('brukerID', sql.Int, brukerID)
        .query('SELECT * FROM investApp.konto WHERE brukerID = @brukerID');
  
      res.json(kontoResult.recordset);
    } catch (error) {
      console.error('Error in GET /api/konto:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

//Enepunkt for å bytte passord for en bruker
app.post('/byttepassord', async (req, res) => {
    const { brukernavn, oldPassord, newPassord } = req.body;
    try {
      const database = await getDatabase();
      const request = database.poolconnection.request();
  
      // verifiserer at gammelt passord stemmer
      request.input('brukernavn', VarChar(255), brukernavn);
      request.input('oldPassord', VarChar(255), oldPassord);
      const verifyResult = await request.query(`
        SELECT brukernavn FROM investApp.bruker
        WHERE brukernavn = @brukernavn AND passord = @oldPassord
      `);
  
      if (verifyResult.recordset.length === 0) {
        return res.status(400).json({ message: 'Old password is incorrect' });
      }
  
      //Oppdaterer til nytt passord
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
  
//Viser passordbytte siden
app.get('/byttepassord', (req, res) => {
  res.render('byttepassord');
});
  
//Oppretter en ny konto og knytter den til en eksisterende konto
app.post('/opprettKonto', async (req, res) => {
    try{
      const {kontoNavn, opprettelsedatoK, saldo, bank, valuta, brukernavn} = req.body
      const database = await getDatabase();

      //Hent brukerID basert på brukernavn
      const brukerResult = await database.poolconnection.request()
        .input('brukernavn', sql.VarChar(255), brukernavn)
        .query('SELECT brukerID FROM investApp.bruker WHERE brukernavn = @brukernavn');

    if (brukerResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Bruker ikke funnet' });
    }

    const brukerID = brukerResult.recordset[0].brukerID;

    //formatere datoene til riktig format
    const formattedOpprettelsedatoK = new Date(opprettelsedatoK).toISOString().split('T')[0];
        
        //sett inn ny konto i databasen
        const insertRequest = database.poolconnection.request();
        insertRequest.input('kontoNavn', sql.VarChar(255), kontoNavn);
        insertRequest.input('opprettelsedatoK', sql.Date, formattedOpprettelsedatoK);
        insertRequest.input('saldo', sql.BigInt, saldo);
        insertRequest.input('bank', sql.VarChar(255), bank);
        insertRequest.input('valuta', sql.VarChar(255), valuta);
        insertRequest.input('brukerID', sql.Int, brukerID); 

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

//------------------------------------------------------------------------------------------------------------
//viser siden for å opprette en ny konto
app.get('/opprettKonto', (req, res) => {
    res.render('opprettKonto');
});

//viser dashboard siden
app.get('/dashboard', (req, res) => {
    res.render('dashboard');
});

//viser oversikten over porteføljene
app.get('/portefolje', (req, res) => {
    res.render('portefolje');
});

//API endepunkt som alle porteføljer tilhørende en bruker
app.get('/api/portefolje', async (req, res) => {
  const brukernavn = req.headers['brukernavn']; // Hent brukernavn fra query-parameter
  
  try {
    const { poolconnection } = await getDatabase();
    const result = await poolconnection.request().input('brukernavn', sql.VarChar(255), brukernavn).query(`
      SELECT 
        p.portefoljeID, 
        p.portefoljeNavn, 
        p.opprettelsedatoP, 
        k.kontoNavn, 
        k.saldo, 
        k.bank,
        k.valuta,
        (
          SELECT MAX(t.opprettelsedatoT)
          FROM investApp.transaksjon t
          WHERE t.portefoljeID = p.portefoljeID
        ) AS sisteHandel,
        (
          SELECT SUM(t.mengde * t.verdiPapirPris)
          FROM investApp.transaksjon t
          WHERE t.portefoljeID = p.portefoljeID
        ) AS totalValue
      FROM investApp.portefolje p 
      JOIN investApp.konto k ON p.kontoID = k.kontoID 
      JOIN investApp.bruker b ON k.brukerID = b.brukerID 
      WHERE b.brukernavn = @brukernavn
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Ingen porteføljer funnet for brukeren' });
    }
    
    res.json(result.recordset);
  } catch (error) {
    console.error('FEIL i GET /portefolje:', error);
    res.status(500).json({message:'Kunne ikke hente porteføljer'});
  }
});

//Viser skejma for å opprette en ny portefølje
app.get('/opprettPortefolje', (req, res) => {
  res.render('opprettPortefolje')
})

//oppretter en ny portefølje i databasen
app.post('/opprettPortefolje', async (req, res) => {
  const { navn, kontoID, brukernavn } = req.body;
  const dato = new Date().toISOString().split('T')[0]; // Formater dato til YYYY-MM-DD

  if (!navn || !kontoID || !brukernavn) {
    return res.status(400).json({ message: 'Portefoljenavn og kontoID må oppgis' });
  }

  try {
    const database = await getDatabase();

    //Verifiserer at brukeren finnes
    const brukerResultatet = await database.poolconnection.request()
    .input('brukernavn', sql.VarChar(255), brukernavn)
    .query(` 
      SELECT brukerID
      FROM investApp.bruker
      WHERE brukernavn = @brukernavn
      `);
      const brukerID = brukerResultatet.recordset[0].brukerID

      //her skal det verifiseres at kontoen faktisk hører til brukeren
      const kontoResultatet = await database.poolconnection.request()
      .input('kontoID', sql.Int, kontoID)
      .input('brukerID', sql.Int, brukerID)
      .query(`
        SELECT kontoID
        FROM investApp.konto
        WHERE kontoID = @kontoID
        AND brukerID = @brukerID
        `);

        if (kontoResultatet.recordset.length === 0) {
          return res.status(404).json({ message: 'denne kontoen hører ikke til brukeren' 
          })
        };

    //Oppretter ny portefølje
    await database.poolconnection.request()
    .input('portefoljeNavn', sql.VarChar(255), navn)
    .input('kontoID', sql.Int, kontoID)
    .input('opprettelsedatoP', sql.Date, dato)
    .query(`
      INSERT INTO investApp.portefolje (portefoljeNavn, kontoID, opprettelsedatoP)
      VALUES (@portefoljeNavn, @kontoID, @opprettelsedatoP)
    `);

    res.status(201).json({message: 'porteføle opprettet'})
 } catch (error) {
    console.error('Feil i POST /opprettPortefolje:', error);
    res.status(500).send(error.message);
  }
});

//setter lukkedato for en konto (brukes altså til å stenge kontoen)
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
  
  //Fjerner lukkedatoen for å kunne gjenåpne konto
  app.put('/gjenopne-konto', async (req, res) => {
    const kontoID = req.body.kontoID;
  
    try{
      const database = await getDatabase();
      const request = database.poolconnection.request();
  
      request.input('kontoID', sql.Int, kontoID);
      request.input('lukkedatoK', sql.DateTime, null); //Null = gjengåpne
  
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

//viser innskuddsiden
app.get('/indsettelse', async (req, res) => {
  res.render('indsettelse');
});

//Registrerer innskudd eller uttsak og oppdaterer saldoen til brukern
app.post('/indsettelse', async (req, res) => {
  const { kontoID, valuta, verdi, type } = req.body;

  try {
    const { poolconnection } = await getDatabase();

    //hent den nåværende saldoen
    const saldoResult = await poolconnection.request()
      .input('kontoID', sql.Int, kontoID)
      .query('SELECT saldo FROM investApp.konto WHERE kontoID = @kontoID');

    if (saldoResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Konto ikke funnet' });
    }

    let saldo = saldoResult.recordset[0].saldo;
    const beløp = parseFloat(verdi);

    //oppdaterer saldo baert på innskudd og uttak
    if (type === 'innskudd') {
      saldo += beløp;
    } else if (type === 'uttak') {
      if (saldo < beløp) return res.status(400).json({ message: 'Ikke nok saldo' });
      saldo -= beløp;
    } else {
      return res.status(400).json({ message: 'Ugyldig type' });
    }

    //Oppdaterer saldo i databasen
    await poolconnection.request()
      .input('kontoID', sql.Int, kontoID)
      .input('saldo', sql.Decimal(18, 2), saldo)
      .query('UPDATE investApp.konto SET saldo = @saldo WHERE kontoID = @kontoID');

    //Logg transaksjonen i tabellen "indsettelse"
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

//--------------------------------------------------------------------------------------------------------
//viser visningen for en enkelt portefølje i applikasjonen
app.get('/enkeltPortefolje', async (req, res) => {
  res.render('enkeltPortefolje');
});

//API endepunkt fo å kunne hente navnet å en spesefikk portefølje basert på ID
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

    //Returnerer navnet på porteføljen som JSON
    res.json(result.recordset[0]);

  } catch (error) {
    console.error('Feil i GET /api/portefolje/:id:', error);
    res.status(500).json({ message: 'Intern feil' });
  }
});

//API endepunkt for å søke opp oh hente sanntidsdata + historikk om en aksje
app.get('/api/aksje/:navn', async (req, res) => {
  const søk = req.params.navn;

  try {
    //søk etter aksje med Yahoo finance sitt søke-API
  const result = await yahooFinance.search(søk); // Søk etter aksje
  const førsteTreff = result.quotes?.[0]

  if (!førsteTreff) {
    return res.status(404).json({ message: 'Ingen treff funnet for søket' });
  }

  //hent aksjens nåværende markedsdata
  const aksjeData = await yahooFinance.quote(førsteTreff.symbol);

  //hent ukentlig historikk for siste år
  const iDag = new Date();
  const ettÅrSiden = new Date();
  ettÅrSiden.setFullYear(iDag.getFullYear() - 1);
  const historikk = await yahooFinance.historical(førsteTreff.symbol, {
    period1: ettÅrSiden,
    period2: iDag,
    interval: '1wk'//intervall på en uke
    });

    //kombinerer nåværende aksjedata med historikk for så å returnere det
  res.json({...aksjeData, historikk});

} catch (error) {
  console.error('Feil i aksjesøk:', error);
  res.status(500).json({ message: 'Klarte ikke hente aksjeinformasjon' });
  }
});

//API endepunkt for å hente status for en konto tilknytttet en spesefikk portefølje
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
    //Returnerer kontoens ID og eventuell lukkedato (dette for å vite om konto er aktiv eller ikke)
    res.json(result.recordset[0]);
   
  } catch(err){
    console.error(err);
    res.status(500).json({ message:'intern feil ved henting av kontostatus'})
  }
});

//rute som viser kjøpsskjemaet i applikasjonen
app.get('/kjop', (req, res) => {
  res.render('kjop');
});

//----------------------------------------------------------------------------------------------------
//kjøp av aksjer, registrerer en ny transaksjon og trekker penger fra kontoen
app.post('/kjop', async (req, res) => {
  const { 
    portefoljeID, ISIN, verditype, opprettelsedatoT, verdiPapirPris, mengde, totalSum, totalGebyr,
    type 
  } = req.body;

  try{
    const database = await getDatabase();

    //hent kontoID som er knyttet til portefølje
    const kontoResultat = await database.poolconnection.request()

      .input('portefoljeID', sql.Int, portefoljeID)
      .query('SELECT kontoID FROM investApp.portefolje WHERE portefoljeID = @portefoljeID');

      if (kontoResultat.recordset.length === 0) {
        return res.status(404).json({ message: 'Portefølje ikke funnet' });
      }
      const hentetKontoID = kontoResultat.recordset[0].kontoID;

      //Hent saldo for kontoen
      const saldoResultat = await database.poolconnection.request()
      .input('kontoID', sql.Int, hentetKontoID)
      .query('SELECT saldo FROM investApp.konto WHERE kontoID = @kontoID');

      let saldo = saldoResultat.recordset[0].saldo;

      //Sjekker om det er nok penger på kontoen
        if (saldo < totalSum + totalGebyr) {
          return res.status(400).json({ message: 'Ikke nok penger på konto' });
        }
        saldo -= (totalSum + totalGebyr); // trekker fra totale summen og gebyr fra saldoen
     
      //Oppdater saldoen i databasen
      await database.poolconnection.request()
        .input('kontoID', sql.Int, hentetKontoID)
        .input('saldo', sql.Decimal(18, 2), saldo)
        .query('UPDATE investApp.konto SET saldo = @saldo WHERE kontoID = @kontoID');

      //Registrer kjøpstransaksjonen i transasksjonsmodellen
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
        res.status(200).json({ message: 'Kjøp registrert'});

    } catch (error) {
      console.error('Feil i transaksjon');
      res.status(500).json({ message: 'Intern feil' });
    }
});

//Viser salgsskjema
app.get('/salg', async (req, res) => {
  res.render('salg');
})

//Registrerer salgstransaksjonen
app.post('/salg', async (req, res) => {
  const {
    portefoljeID, ISIN, verditype, opprettelsedatoT, verdiPapirPris, mengde,
  } = req.body

  try{
    const database = await getDatabase();

    //Hent konto tilhørende portefølje
    const kontoResultat = await database.poolconnection.request()

      .input('portefoljeID', sql.Int, portefoljeID)
      .query('SELECT kontoID FROM investApp.portefolje WHERE portefoljeID = @portefoljeID');

    const kontoID = kontoResultat.recordset[0].kontoID;

    //Beregn beholdning og snittpris for aksjen som skal selges
    const beholdningsResultat = await database.poolconnection.request()
    .input('portefoljeID', sql.Int, portefoljeID)
    .input('ISIN', sql.VarChar(255), ISIN)
    .query(`
      select sum(mengde) as totalMengde,
      sum(mengde *verdiPapirPris)/ nullif(sum(mengde), 0) as snittpris
      from investApp.transaksjon
      where portefoljeID = @portefoljeID and ISIN = @ISIN
      `)

      const beholdning = beholdningsResultat.recordset[0].totalMengde || 0;
      const snittpris = beholdningsResultat.recordset[0].snittpris
    
      //Ikke tillat salg av flere aksjer enn man eier
      if(beholdning < mengde){
        return res.status(400).json({ message: `du prøver å selge ${mengde}, men du har bare ${beholdning} aksjer av ${ISIN}`});
      }

      //Beregner verdi og gevinst
      const totalSalgsveri = verdiPapirPris * mengde
      const gebyr = parseFloat((totalSalgsveri*0.0005).toFixed(2))
      const realisertGevinst = (verdiPapirPris - snittpris) * mengde;

      const saldoResultat = await database.poolconnection.request() 
        .input('kontoID', sql.Int, kontoID)
        .query('SELECT saldo FROM investApp.konto WHERE kontoID = @kontoID');

        let saldo = saldoResultat.recordset[0].saldo;
        saldo += totalSalgsveri - gebyr;  // Legg til salgsbeløpet til saldoen

        //Legg tl salgsbeløpet til saldoen
        await database.poolconnection.request()
        .input('kontoID', sql.Int, kontoID)
        .input('saldo', sql.Decimal(18, 2), saldo)
        .query('UPDATE investApp.konto SET saldo = @saldo WHERE kontoID = @kontoID');

        //mengden lagres negativt hvis det er salg
        let faktiskeMengden;
        if (verditype === 'salg'){
          faktiskeMengden = -Math.abs(mengde);
        } else {
          faktiskeMengden = Math.abs(mengde);
          }
        
        //Registrer salget i transaksjonstabellen
        await database.poolconnection.request()
        .input('kontoID', sql.Int, kontoID)
        .input('portefoljeID', sql.Int, portefoljeID)
        .input('ISIN', sql.VarChar(255), ISIN) 
        .input('verditype', sql.VarChar(255), verditype)
        .input('opprettelsedatoT', sql.Date, opprettelsedatoT)
        .input('verdiPapirPris', sql.Decimal(18, 2), verdiPapirPris)
        .input('mengde', sql.Int, faktiskeMengden)
        .input('totalSum', sql.Decimal(18, 2), totalSalgsveri)
        .input('totalGebyr', sql.Decimal(18, 2), gebyr) 
        .query(`
          INSERT INTO investApp.transaksjon 
          (kontoID, portefoljeID, ISIN, verditype, opprettelsedatoT, verdiPapirPris, mengde, totalSum, totalGebyr)
          VALUES (@kontoID, @portefoljeID, @ISIN, @verditype, @opprettelsedatoT, @verdiPapirPris, @mengde, @totalSum, @totalGebyr)`
        );

      res.status(200).json({ message: 'Salg registrert'});

      }catch(error){
        console.error('feil i post /salg', error);
    }
});

//Linjediagram enkeltportefolje
/*--------------------------------------------------------------------- */
//Returnerer verdiutviklingen over tid en spesefikk portefølje
app.post('/api/portefolje/verdiutvikling', async (req, res) => {
  const { portefoljeID } = req.body;
  try {
    const database = await getDatabase();

    //Henter alle transaksjoner for porteføljen, sorterer de deretter etter dato
    const result = await database.poolconnection.request()
      .input('portefoljeID', sql.Int, portefoljeID)
      .query(`
        SELECT opprettelsedatoT, ISIN, mengde, verdiPapirPris
        FROM investApp.transaksjon 
        WHERE portefoljeID = @portefoljeID
        ORDER BY opprettelsedatoT DESC
        `);

        //Grupperer transaksjoner per dato og summerer total verdi for den dagen
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

      //Returnerer ferdig strukturert historikk til frontend
      const verdiHistorikk = Object.keys(dagligVerdiutvikling)
      .sort()
      .map(dato => ({ dato, verdi: dagligVerdiutvikling[dato],}));
    
    res.json(verdiHistorikk);
  }
    catch (error) {
    console.error('Feil i POST /api/portefolje/verdiutvikling:', error);
    res.status(500).json({ message: 'Intern feil' });
  }
});

//Linjediagram samlet
//--------------------------------------------------------------------- */
//Returnerer samlet verdiutvikling for alle transaksjoner i systemet (alle brukere)
app.get('/api/portefolje/samletverdiutvikling', async (req, res) => {
  try {
    const database = await getDatabase();
    const result = await database.poolconnection.request().query(`
        SELECT CAST(opprettelsedatoT AS DATE) AS dato,
        SUM(mengde * verdiPapirPris) AS verdi
        FROM investApp.transaksjon 
        GROUP BY CAST(opprettelsedatoT AS DATE)
        ORDER BY dato ASC
        `);

        //omstrukturerer resultatet til ønsket format for visning i linjediagrammet
        const verdiHistorikk = result.recordset.map(transaksjon => ({
          dato: transaksjon.dato,
          verdi: transaksjon.verdi
        }));

        res.json(verdiHistorikk);
      
  } catch (error) {
    console.error('Feil i GET samletverdiutvikling:', error);
    res.status(500).json({ message: 'Intern feil' });
  }
});

//----------------------------------------------------------------------
//Returner Nåværende samlet markedsverdi av alle aksjer i en spesefikk portefølje
app.post('/api/portefolje/verdi', async (req, res) => {
  const { portefoljeID } = req.body;
  try {
    const database = await getDatabase();

    //henter aksjene og total mengde i porteføljen
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

      //For hver aksje: hent sanntidskurs og regn ut verdi
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
  
//Viser frontend siden for brukerens handelshistorikk
app.get('/handelshistorikk', (req, res) => {
  res.render('handelshistorikk');
});

//Returnerer alle transaksjoner for en gitt portefølje, vises i tabellen
app.get('/api/handelshistorikk/:portefoljeID', async (req, res) => {
  try {
    const portefoljeID = req.params.portefoljeID;

    const database = await getDatabase();
    const result = await database.poolconnection.request()
      .input('portefoljeID', sql.Int, portefoljeID)
      .query(`
        SELECT t.*, k.kontoNavn 
        From investApp.transaksjon t
        JOIN investApp.portefolje p ON t.portefoljeID = p.portefoljeID
        JOIN investApp.konto k ON t.kontoID = k.kontoID
        WHERE t.portefoljeID = @portefoljeID
        ORDER by t.opprettelsedatoT DESC
      `);

    res.json(result.recordset);
  }
  catch (error) {
    console.error('Feil i POST /api/handelshistorikk:', error);
    res.status(500).json({ message: 'Intern feil' });
  }
});  

//Returnerer en gitt kontos innskudd/uttak
app.post('/innskuddshistorikk', async (req, res) => {
  const { kontoID } = req.body;
  const parsedKontoID = parseInt(kontoID, 10); //sikrer at ID er et tall

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

//Viser frontendvisningen av innskudsshistorikken
app.get('/innskuddshistorikk', (req, res) => {
  res.render('innskuddshistorikk');
});

//Returnerer aksjefordelingen for en portefølje som kan brukes til doughnut charten
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

//-------------------------------------------------------------------------------------
//Returnerer aksjer i en gitt portefølje med sanntidspris, verdi og urealisert gevinst
app.post('/aksjeienkeltportefolje', async (req, res) => {
  const {portefoljeID} = req.body;

  if (!portefoljeID) {
    return res.status(400).json({ message: 'PortefoljeID mangler' });
  }
  try {
    const database = await getDatabase();

    //Henter ISIN og beregner snittprisen per aksje i porteføljen
    const aksjeResultat = await database.poolconnection.request()
      .input('portefoljeID', sql.Int, portefoljeID)
      .query(`
        select ISIN, sum(mengde) AS totalMengde,
        CASE when sum(mengde *verdiPapirPris) = 0 then 0 
        else sum( mengde * verdiPapirPris) /sum(mengde)
        end as snittKjøpspris
        from investApp.transaksjon
        where portefoljeID = @portefoljeID
        Group by ISIN
      `);
      
        const aksjer = aksjeResultat.recordset;

        //Hente markedsdata og kalkulerer urealisert gevinst for hver aksje
        const aksjeData = await Promise.all(
          aksjer.map(async (aksje) => {;
            try {
              const markedsdata = await yahooFinance.quote(aksje.ISIN);
              const prisNå = markedsdata.regularMarketPrice
              const verdi = prisNå * aksje.totalMengde;
              const urealisert = verdi - (aksje.snittKjøpspris * aksje.totalMengde)
              return {
                navn: markedsdata.shortName || aksje.ISIN,
                pris: markedsdata.regularMarketPrice,
                endringProsent: markedsdata.regularMarketChangePercent,
                antall: aksje.totalMengde,
                totalVerdi: markedsdata.regularMarketPrice * aksje.totalMengde,
                urealisertGevinst: urealisert,
              };
            } catch (feil) {
              console.error('Feil ved henting av aksjeinformasjon:', feil);
              return null;
            }
          })
        );

        //Filtrer ut eventuelle nullverdier (feil i API)
        const aksjeDataFiltrert = aksjeData.filter(aksje => aksje !== null);
        res.json(aksjeDataFiltrert);
    
  }
  catch (error) {
    console.error('Feil i POST /aksjeienkeltportefolje:', error);
    res.status(500).json({ message: 'Intern feil' });
  }
});

//Returnerer samlet markedsverdi, per valuta for alle aksjer brukeren eier
app.get('/samlet-verdi/:brukernavn', async (req, res) => {
  const brukernavn = req.params.brukernavn;

  try{
    const database = await getDatabase();

    //Summerer total verdi av alle transaksjoner gruppert på valuta
    const result = await database.poolconnection.request()
    .input('brukernavn', sql.NVarChar, brukernavn)
    .query(`
      SELECT k.valuta, SUM(t.totalSum) AS samletVerdi
      FROM investApp.transaksjon t
      JOIN investApp.konto k ON t.kontoID = k.kontoID
      JOIN investApp.bruker b ON k.brukerID = b.brukerID
      WHERE b.brukernavn = @brukernavn
      GROUP BY k.valuta 
      `);

      res.json(result.recordset);

    } catch(error) {
      console.log(error);
      res.status(500).json({ message: 'intern feil ved henting av samlet verdi'})
  }
});

//Returnerer topp 5 aksjer med høyest urealisertgevinst og summerer total gevinst
app.post('/topp5AksjerGevinst', async (req, res) => {
  const brukernavn = req.headers['brukernavn'];

    try {
      const database = await getDatabase();

      //Hent brukerID fra brukernavn
      const brukerResultat = await database.poolconnection.request()
        .input('brukernavn', sql.VarChar(255), brukernavn)
        .query(`
          SELECT brukerID from investApp.bruker 
          WHERE brukernavn = @brukernavn
        `);
      const brukerID = brukerResultat.recordset[0].brukerID;

     //Beregner snittpris og beholdning per aksje for brukeren
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
      let totalUrealisertGevinst = 0;

      //For hver aksje skal den hente sanntidspris og beregne urealisert gevinst
      for (const rad of aksjeResultat.recordset) {
        try {
          const markedsdata = await yahooFinance.quote(rad.ISIN);
          const pris = markedsdata.regularMarketPrice;

          const gevinst = (pris - rad.snittKjøpspris) * rad.totalMengde;
          totalUrealisertGevinst += gevinst;
          
          //Håndterer endring i prosent (kan være null)
          let endring24h;
          if (markedsdata.regularMarketChangePercent !== undefined && markedsdata.regularMarketChangePercent !== null) {
            endring24h = markedsdata.regularMarketChangePercent.toFixed(2);
          }else {
            endring24h = 0;
          }

          aksjer.push({
            navn: markedsdata.shortName || rad.ISIN,
            portefolje: rad.portefoljeNavn,
            gevinst: gevinst.toFixed(2),
            endring24h: endring24h,
          });
        } catch (feil) {
          console.error('Feil ved henting av aksjeinformasjon:', feil);
        }
      }

      //hent realisert gevinst for brukeren
      const realisertGevinstResultat = await database.poolconnection.request()
        .input('brukerID', sql.Int, brukerID)
        .query(`
          select k.valuta,
          sum(case when t.mengde < 0then t.totalSum
          else 0 end) AS samletSalgsverdi,
          sum(case when t.mengde < 0 then t.totalSum -
          (abs(t.mengde)* t.verdiPapirPris) else 0 end) AS realisertGevinst
          from investApp.transaksjon t
          join investApp.portefolje p on t.portefoljeID = p.portefoljeID
          join investApp.konto k on p.kontoID = k.kontoID
          where k.brukerID = @brukerID
          group by k.valuta
          `
        );

      //Formaterer realisert gevinst til et nummer
      const realiserteGevinster = realisertGevinstResultat.recordset.map(r =>({
        valuta: r.valuta,
        gevinst: Number(r.realisertGevinst).toFixed(2)
      }))

      //sorterer aksjer etter urealisert gevinst og finner topp 5 
      const top5 = aksjer.sort((a, b) => b.gevinst - a.gevinst).slice(0, 5);
      
      res.json({
        top5, 
        totalUrealisertGevinst: totalUrealisertGevinst.toFixed(2),
        totalRealisertGevinst: realiserteGevinster
   })

  } catch (error) {
    console.error('Feil i POST /topp5AksjerGevinst:', error);
    res.status(500).json({ message: 'Intern feil' });
   }
});

//------------------------------------------------------------------------------------------------------
//Returnerer topp 5 aksjer målt etter høyest markedsverdi for en spesefikk bruker
app.post('/topp5AksjerVerdi', async (req, res) => {
  const brukernavn = req.headers['brukernavn'];
    try {
      const database = await getDatabase();

      //Hent brukerID for å koble opp mot riktige porteføljer
      const brukerResultat = await database.poolconnection.request()
        .input('brukernavn', sql.VarChar(255), brukernavn)
        .query(`
          SELECT brukerID from investApp.bruker 
          WHERE brukernavn = @brukernavn
        `);
      const brukerID = brukerResultat.recordset[0].brukerID;

      //henter aksjer til brukeren med total mengde per ISIN
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

      //For hver aksje blir hentes sanntidsverdi og beregner verdien
      for (const rad of aksjeResultat.recordset) {
        try {
          const markedsdata = await yahooFinance.quote(rad.ISIN);
          const pris = markedsdata.regularMarketPrice;
          let verdi = pris * rad.totalMengde;

          //Henter eventuelle endringer i prosent for siste 24 timene
          let endringProsent;
          if (markedsdata.regularMarketChangePercent !== undefined && markedsdata.regularMarketChangePercent !== null) {
            endringProsent = markedsdata.regularMarketChangePercent.toFixed(2);
          } else {
            endringProsent = 0;
          }

          aksjer.push({
            navn: markedsdata.shortName || rad.ISIN,
            portefolje: rad.portefoljeNavn,
            verdi: (pris * rad.totalMengde).toFixed(2),
            endring24h: endringProsent
          });
        } catch (feil) {
          console.error('Feil ved henting av aksjeinformasjon:', feil);
        }
      }

      //Returnerer de fem mest verdifulle aksjene
      const top5 = aksjer.sort((a, b) => b.verdi - a.verdi).slice(0, 5);
      res.json(top5); 
   } catch (error) {
    console.error('Feil i POST /topp5AksjerVerdi:', error);
    res.status(500).json({ message: 'Intern feil' });
   }
});

//Returnerer prosentvis endring i brukerensPorteføljeverdi  over 24 timer, 7 og 30 dager
app.post('/portefolje/endringerSisteDager', async (req, res) => {
  const brukernavn = req.headers['brukernavn'];

  const nå = new Date();
  const datoer = {
    iDag: new Date(nå.getFullYear(), nå.getMonth(), nå.getDate()),
    iGår: new Date(nå.getFullYear(), nå.getMonth(), nå.getDate() - 1),
    syvDagerSiden: new Date(nå.getFullYear(), nå.getMonth(), nå.getDate() - 7),
    trettiDagerSiden: new Date(nå.getFullYear(), nå.getMonth(), nå.getDate() - 30),
  }

  try {
    const database = await getDatabase();
    const verdier = {};

    //Henter total porteføljeverdifra og med en gitt dato
    async function henteDato(nøkkel, dato){
      const resultat = await database.poolconnection.request()
        .input('brukernavn', sql.VarChar(255), brukernavn)
        .input('dato', sql.Date, dato)
        .query(`
          SELECT SUM(t.mengde * t.verdiPapirPris) AS totalVerdi
          FROM investApp.transaksjon t
          JOIN investApp.portefolje p ON t.portefoljeID = p.portefoljeID
          JOIN investApp.konto k ON p.kontoID = k.kontoID
          JOIN investApp.bruker b ON k.brukerID = b.brukerID
          WHERE b.brukernavn = @brukernavn AND t.opprettelsedatoT >= @dato
        `);
        verdier[nøkkel] = resultat.recordset[0].totalVerdi || 0;
    }
    await henteDato('iDag', datoer.iDag);
    await henteDato('iGår', datoer.iGår);
    await henteDato('syvDagerSiden', datoer.syvDagerSiden);
    await henteDato('trettiDagerSiden', datoer.trettiDagerSiden);
   
    //beregner prosentvis endring emllom to datoer
    const regneUtEndringene = (starten, slutten) =>{
      if (slutten>0) {
        return (((starten - slutten) / slutten) * 100).toFixed(2);
      }else {
        return 0;
      }
    }

    //Returnerer endringer for de tre tidsperiodene
    const endringene ={
      sisteTjuefireTimene: regneUtEndringene(verdier.iDag, verdier.iGår),
      sisteSyvDager: regneUtEndringene(verdier.iDag, verdier.syvDagerSiden),
      sisteTrettiDager: regneUtEndringene(verdier.iDag, verdier.trettiDagerSiden),
    }
    res.json(endringene)
  } catch (error) {
    console.error('Feil i posten');
  }
});

//Returnerer prosentvis endring for en spesefikk protefølje siste 24t
app.get('/api/portefolje/:portefoljeID/endring24', async (req, res) => {
  const portefoljeID = req.params.portefoljeID;
  try{
    const database = await getDatabase();

    //Hent total mengde per aksje i porteføljen
    const aksjer = await database.poolconnection.request().input('portefoljeID', sql.Int, portefoljeID).query(`
      SELECT ISIN, SUM(mengde) AS totalMengde 
      FROM investApp.transaksjon
      WHERE portefoljeID = @portefoljeID
      GROUP BY ISIN
    `);

    let verdiNå = 0;
    let verdiTidligere = 0;

    //Beregn makedsverdi før og etter for hver aksje
    for (const aksje of aksjer.recordset) {
      const data = await yahooFinance.quote(aksje.ISIN);
      const prisNå = data.regularMarketPrice;
      const endringProsent = data.regularMarketChangePercent / 100;
      const tidligerePris = prisNå / (1 + endringProsent);

      verdiNå += prisNå * aksje.totalMengde;
      verdiTidligere += tidligerePris * aksje.totalMengde;

    }
    //regn ut total prosentvis endring
    const endring = ((verdiNå - verdiTidligere) / verdiTidligere) * 100;
    let label;
    if (endring > 0) {
      label = `+${endring.toFixed(2)}%`;
    } else if (endring < 0) {
      label = `${endring.toFixed(2)}%`;
    }

    res.json({ endring24h: label });
  } catch (error) {
    console.error('Feil ved henting av endring verdi:', error);
    res.status(500).json({ message: 'feil ved beregning' });
  }
});

//Returnerer samlet nåverdi av alle aksjene brukeren eier
app.get('/samlet-verdi/:brukernavn', async (req, res) => {
  const brukernavn = req.params.brukernavn;

  try {
    const database = await getDatabase();

    //Henter brukerID
    const brukerResultat = await database.poolconnection.request().input('brukernavn', sql.VarChar(255), brukernavn).query(`
      SELECT brukerID FROM investApp.bruker WHERE brukernavn = @brukernavn`);

    if (brukerResultat.recordset.length === 0) {
      return res.status(404).json({ message: 'Bruker ikke funnet' });
    }
    const brukerID = brukerResultat.recordset[0].brukerID;

    //Henter mengde per ISIN som brukeren eier
    const aksjeResultat = await database.poolconnection.request().input('brukerID', sql.Int, brukerID).query(`
      SELECT t.ISIN, SUM(t.mengde) AS totalMengde 
      FROM investApp.transaksjon t
      JOIN investApp.portefolje p ON t.portefoljeID = p.portefoljeID
      JOIN investApp.konto k ON p.kontoID = k.kontoID
      WHERE k.brukerID = @brukerID
      GROUP BY t.ISIN
    `);
    let totalVerdi = 0;

    //Kalkuler total verdi basert på sanntidskursen
    for (const aksje of aksjeResultat.recordset) {
      try {
        const markedsdata = await yahooFinance.quote(aksje.ISIN);
        const pris = markedsdata.regularMarketPrice;
        totalVerdi += pris * aksje.totalMengde;
      } catch (feil) {
        console.error(`Feil ved henting av aksjeinformasjon`, feil);
      }
    }
    res.json({ totalVerdi: totalVerdi.toFixed(2) });
  } catch (error) {
    console.error(`Feil ved henting av samlet verdi`, error);
    res.status(500).json({ message: `Intern feil` });
  }
});

//Starter serveren og etablere dataforbidnelsen
app.listen(port, async () => {
  try {
      await getDatabase();
      console.log('Database connection established on server startup.');
  } catch (error) {
      console.error('Database connection failed on server startup:', error);
  }
  console.log(`Server kjører på http://localhost:${port}`);
});

module.exports = app;