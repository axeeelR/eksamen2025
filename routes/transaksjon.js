const express = require('express');
const router = express.Router();
const { getDatabase } = require('../backend/database/instance.js');
const { VarChar } = require('mssql');

//viser oversikten over porteføljene
router.get('/', (req, res) => {
  res.render('transaksjon');
});
  //kjøp av aksjer, registrerer en ny transaksjon og trekker penger fra kontoen
  router.post('/kjop', async (req, res) => {
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
  router.get('/salg', async (req, res) => {
    res.render('salg');
  })
  
  //Registrerer salgstransaksjonen
  router.post('/salg', async (req, res) => {
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
          console.error('feil i POST /salg', error);
      }
  });

//viser innskuddsiden
router.get('/indsettelse', async (req, res) => {
    res.render('indsettelse');
  });
  
  //Registrerer innskudd eller uttsak og oppdaterer saldoen til brukern
  router.post('/indsettelse', async (req, res) => {
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
      console.error('Feil i POST /indsettelse', error);
      res.status(500).json({ message: 'Intern feil' });
    }
  });

//Viser frontend siden for brukerens handelshistorikk
router.get('/handelshistorikk', (req, res) => {
    res.render('handelshistorikk');
  });
  
  //Returnerer alle transaksjoner for en gitt portefølje, vises i tabellen
  router.get('/api/handelshistorikk/:portefoljeID', async (req, res) => {
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
      console.error('Feil i POST /api/handelshistorikk', error);
      res.status(500).json({ message: 'Intern feil' });
    }
  });  
  
  //Returnerer en gitt kontos innskudd/uttak
  router.post('/innskuddshistorikk', async (req, res) => {
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
  router.get('/innskuddshistorikk', (req, res) => {
    res.render('innskuddshistorikk');
  });
  
  //Returnerer aksjefordelingen for en portefølje som kan brukes til doughnut charten
  router.get('/api/portefolje/:portefoljeID/fordeling', async (req, res) => {
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
      console.error('Feil i GET /api/portefolje/:portefoljeID/fordeling', error);
    }
  });

//API endepunkt for å hente status for en konto tilknytttet en spesefikk portefølje
router.get('/api/konto-status/:portefoljeID', async (req, res) => {
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

//API endepunkt for å søke opp oh hente sanntidsdata + historikk om en aksje
router.get('/api/aksje/:navn', async (req, res) => {
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

module.exports = router;