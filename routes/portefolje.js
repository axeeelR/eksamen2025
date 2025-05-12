const express = require('express');
const router = express.Router();
const { getDatabase } = require('../backend/database/instance.js');
const { VarChar } = require('mssql');
const yahooFinance = require('yahoo-finance2').default;
const sql = require('mssql'); // Importer hele mssql-biblioteket

//viser oversikten over porteføljene
router.get('/', (req, res) => {
    res.render('portefolje');
});

//API endepunkt som alle porteføljer tilhørende en bruker
router.get('/api/portefolje', async (req, res) => {
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
    console.error('FEIL i GET /portefolje', error);
    res.status(500).json({message:'Kunne ikke hente porteføljer'});
  }
});

//Viser skejma for å opprette en ny portefølje
router.get('/opprettPortefolje', (req, res) => {
  res.render('opprettPortefolje')
})

//oppretter en ny portefølje i databasen
router.post('/opprettPortefolje', async (req, res) => {
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
          return res.status(404).json({ message: 'denne kontoen hører ikke til brukeren'})
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
    console.error('Feil i POST /opprettPortefolje', error);
    res.status(500).send(error.message);
  }
});
    //viser visningen for en enkelt portefølje i applikasjonen
router.get('/enkeltPortefolje', async (req, res) => {
    res.render('enkeltPortefolje');
  });

//API endepunkt fo å kunne hente navnet å en spesefikk portefølje basert på ID
router.get('/api/portefolje/:portefoljeID/info', async (req, res) => {
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
      console.error('Feil i GET /api/portefolje/:id', error);
      res.status(500).json({ message: 'Intern feil' });
    }
  });

  //Returnerer verdiutviklingen over tid en spesefikk portefølje
router.post('/api/portefolje/verdiutvikling', async (req, res) => {
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
      console.error('Feil i POST /api/portefolje/verdiutvikling', error);
      res.status(500).json({ message: 'Intern feil' });
    }
  });

//Returnerer samlet verdiutvikling for alle transaksjoner i systemet (alle brukere)
router.get('/api/portefolje/samletverdiutvikling', async (req, res) => {
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

//Returner Nåværende samlet markedsverdi av alle aksjer i en spesefikk portefølje
router.post('/api/portefolje/verdi', async (req, res) => {
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
      console.error('Feil i POST /api/portefolje/verdi', error);
      res.status(500).json({ message: 'Intern feil' });
    }
  });

//Returnerer samlet markedsverdi, per valuta for alle aksjer brukeren eier
router.get('/samlet-verdi/:brukernavn', async (req, res) => {
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
router.post('/topp5AksjerGevinst', async (req, res) => {
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
          } catch (error) {
            console.error('Feil ved henting av aksjeinformasjon:', error);
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
      console.error('Feil i POST /topp5AksjerGevinst', error);
      res.status(500).json({ message: 'Intern feil' });
     }
  });
  
//Returnerer topp 5 aksjer målt etter høyest markedsverdi for en spesefikk bruker
router.post('/topp5AksjerVerdi', async (req, res) => {
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
            console.error('Feil ved henting av aksjeinformasjon', feil);
          }
        }
  
        //Returnerer de fem mest verdifulle aksjene
        const top5 = aksjer.sort((a, b) => b.verdi - a.verdi).slice(0, 5);
        res.json(top5); 
     } catch (error) {
      console.error('Feil i POST /topp5AksjerVerdi', error);
      res.status(500).json({ message: 'Intern feil' });
     }
  });
  
  //Returnerer prosentvis endring i brukerensPorteføljeverdi  over 24 timer, 7 og 30 dager
  router.post('/portefolje/endringerSisteDager', async (req, res) => {
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
  router.get('/api/portefolje/:portefoljeID/endring24', async (req, res) => {
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

  router.get('/api/samletverdi', async (req, res) => {
    const brukernavn = req.headers['brukernavn'];
    try {
      const { poolconnection } = await getDatabase();
      const result = await poolconnection.request()
        .input('brukernavn', sql.VarChar(255), brukernavn)
        .query(`
          SELECT SUM(t.mengde * t.verdiPapirPris) AS samletVerdi
          FROM investApp.transaksjon t
          JOIN investApp.portefolje p ON t.portefoljeID = p.portefoljeID
          JOIN investApp.konto k ON p.kontoID = k.kontoID
          JOIN investApp.bruker b ON k.brukerID = b.brukerID
          WHERE b.brukernavn = @brukernavn
        `);
      res.json({ samletVerdi: result.recordset[0].samletVerdi || 0 });
    } catch (err) {
      console.error("Feil ved henting av samlet verdi:", err);
      res.status(500).json({ error: "Kunne ikke hente samlet verdi" });
    }
  });
  
  
module.exports = router;