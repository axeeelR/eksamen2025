//henter nødvendige moduler
const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;
const app = require('../server');
chai.use(chaiHttp);

//test for å hente porteføljer
describe('API som henter porteføljer', () => {
    //test om det returneres en liste av porteføljer
    it('skal rfeturnere 200 og en liste av porteføljer for gyldig brukernavn', async () => {
        const res = await chai.request(app)
            .get('/api/portefolje') //sender GET forespørsel til riktig API endepunkt
            .set('brukernavn', 'axel'); //setter brukernavn i headeren

        //Forventer 200 OK
        expect(res.status).to.equal(200);
        //Forventer at svaret inneholder en liste av porteføljer
        expect(res.body).to.be.an('array');
    });

    //tester hva som skjer hvis brukeren ikke finnes
    it('skal returnere 404 hvis brukeren ikke finnes i databasen', async () => {
        const res = await chai.request(app)
            .get('/api/portefolje')
            .set('brukernavn', 'finnesIkke123');  

        expect(res.status).to.equal(404);
    });
});


