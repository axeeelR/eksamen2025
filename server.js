const { log } = require('console');
const express = require('express');
const app = express();
const port = 3000;

// Start server
app.listen(port, () => {
  console.log(`Server kjører på http://localhost:${port}`); 
});

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

let db = [];

// Middleware for parsing JSON
app.use(express.json());

app.get('/', (req, res) => {
    res.render("index", {db});
}
);

app.get('/login', function (req, res) {
    res.render('login');
});

app.get('/blikunde', function (req, res) {
    res.render('blikunde');
});

app.get('/portefolje', function (req, res) {
    res.render('portefolje');
});

// Sample endpoint for posting data
app.post('/submit', (req, res) => {
    const { name, age } = req.body;
    res.json({ message: 'Data mottatt', name, age });
});

