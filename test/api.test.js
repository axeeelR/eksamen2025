const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;
const app = require('../server');
chai.use(chaiHttp);

describe('API som henter porteføljer', () => {
    it('skal rfeturnere 200 og en liste av porteføljer for gyldig brukernavn', async () => {
        const res = await chai.request(app)
            .get('/api/portefolje')
            .set('brukernavn', 'axel'); 

        expect(res.status).to.equal(200);
        expect(res.body).to.be.an('array');
    });

    it('skal returnere 404 hvis brukeren ikke finnes i databasen', async () => {
        const res = await chai.request(app)
            .get('/api/portefolje')
            .set('brukernavn', 'finnesIkke123');  

        expect(res.status).to.equal(404);
    });
});