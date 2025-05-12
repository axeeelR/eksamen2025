//Konfigurasjon og de ulike avhengighetene
const express = require('express');
const path = require('path');
const { getDatabase } = require('./backend/database/instance.js');
const sql = require('mssql'); // Importer hele mssql-biblioteket
const app = express();
const port = 3000;

//Middelware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

//import av ruter
const autoriseringRouter = require('./routes/autorisering.js')
const kontoRouter = require('./routes/konto.js')
const portefoljeRouter = require('./routes/portefolje.js')
const transaksjonRouter = require('./routes/transaksjon.js')

//Ruter
app.get('/', (req, res) => res.render('index'));

app.get('/login', (req, res) => {res.render('login');});
app.get('/konto', (req, res) => {res.render('konto');});
app.get('/dashboard', (req, res) => {res.render('dashboard');});
app.get('/kjop', (req, res) => {res.render('kjop');});

app.use('/', autoriseringRouter);
app.use('/', kontoRouter);
app.use('/', portefoljeRouter);
app.use('/', transaksjonRouter);

//Starter serveren og etablere dataforbidnelsen
app.listen(port, async () => {
    try {
        await getDatabase();
        console.log('Database connection opprettet');
    } catch (error) {
        console.error('Database connection feilet', error);
    }
    console.log(`Server kjører på http://localhost:${port}`);
  });