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

        if(result.recordset.length <= 0){
            console.log("Bruker finnes ikke")
            return res.status(500).json({ message: 'Bruker finnes ikke' });
        }

        console.log(req.body);
        console.log("Bruker finnes")
        res.status(200).json({ message: 'Bruker finnes' });
    } catch (error) {
        console.error('Error in POST /login:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/blikunde', (req, res) => {
    res.render('blikunde');
});

app.get('/portefolje', (req, res) => {
    res.render('portefolje');
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
