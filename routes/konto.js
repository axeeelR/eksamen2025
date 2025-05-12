const express = require('express');
const router = express.Router();
const { getDatabase } = require('../backend/database/instance.js');
const { VarChar } = require('mssql');
const sql = require('mssql'); // Importer hele mssql-biblioteket

//viser oversikten over konto
router.get('/', (req, res) => {
  res.render('konto');
});
//API endepunkt som returnerer alle kontoer tilknyttet den innloggete brukeren
router.get('/api/konto', async (req, res) => {
    const brukernavn = req.headers['brukernavn']; //Hent brukernavn fra header
    console.log('Brukernavn mottatt fra headers', brukernavn); // Logg brukernavn
    if (!brukernavn) {
      console.error('Ingen brukernavn mottatt i headers');
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
      console.error('Error i GET /api/konto', error);
      res.status(500).json({ message: 'error api konto' });
    }
  });

//Oppretter en ny konto og knytter den til en eksisterende konto
router.post('/opprettKonto', async (req, res) => {
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
            console.log('Kontoen din ble ikke opprettet')
            return res.status(500).json({ message: 'Kunne ikke opprette konto' });
        }
        console.log(req.body);
        console.log('Ny konto registrert', kontoNavn);
        res.status(201).json({ message: 'Konto opprettet' });

    } catch (error) {
        console.error('Error i POST /opprettKonto:', error);
        res.status(500).json({message:'error'});
    }
});

//------------------------------------------------------------------------------------------------------------
//viser siden for å opprette en ny konto
router.get('/opprettKonto', (req, res) => {
    res.render('opprettKonto');
});

//setter lukkedato for en konto (brukes altså til å stenge kontoen)
router.put('/lukk-konto', async (req, res) => {
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
    router.put('/gjenopne-konto', async (req, res) => {
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

module.exports = router;