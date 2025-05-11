const express = require('express');
const router = express.Router();
const { getDatabase } = require('../backend/database/instance.js');
const { VarChar } = require('mssql');

//Logger inn brukeren ved å verifisere brukernavn og passord i databasen
router.post('/login', async(req, res) => {
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
        console.log('Innlogging vellykket', bruker.brukernavn);

        res.status(200).json({ message: 'Innlogging vellykket' });

    } catch (error) {
        console.error('Error i POST login', error);
        res.status(500).json('Error i serveren');
    }
});

router.get('/logout', (req, res) => {  
    res.redirect('/logout');
});

//viser skjema for ny bruker
router.get('/blikunde', (req, res) => {
    res.render('blikunde');
});

//Oppretter ny bruker i databasen
router.post('/blikunde', async (req, res) => {
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
            console.log('Brukernavn er allerede i bruk', bruker.brukernavn);
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
            console.log('Kontoen din ble ikke lagt til')
            return res.status(500).json({ message: 'Kunne ikke opprette bruker' });
        }
        console.log(req.body);
        console.log('Ny bruker registrert', bruker.brukernavn);
        res.status(201).json({ message: 'Bruker registrert' });

    } catch (error) {
        console.error('Error i POST blikunde', error);
        res.status(500).send('server error');
    }
}); 

//Enepunkt for å bytte passord for en bruker
router.post('/byttepassord', async (req, res) => {
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
        return res.status(400).json({ message: 'gammelt passord er feil' });
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
        return res.status(500).json({ message: 'klarte ikke oppdatere passord' });
      }
  
      res.status(200).json({ message: 'passord oppdatert' });
    } catch (error) {
      console.error('Error i POST /byttepassord', error);
      res.status(500).send('error');
    }
  });
  
//Viser passordbytte siden
router.get('/byttepassord', (req, res) => {
  res.render('byttepassord');
});

module.exports = router;