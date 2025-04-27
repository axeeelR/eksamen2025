const { log } = require('console');
const express = require('express');
const path = require('path');
const usersRouter = require('./backend/routes/users.js');

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
    res.render('login');
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

// Start server
const { getDatabase } = require('./backend/database/instance.js');

app.listen(port, async () => {
    try {
        await getDatabase();
        console.log('Database connection established on server startup.');
    } catch (error) {
        console.error('Database connection failed on server startup:', error);
    }
    console.log(`Server kjører på http://localhost:${port}`);
});
