//henter nødvendige moduler
const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;
const app = require('../server');
chai.use(chaiHttp);

// Test for å opprette en ny bruker
describe('Brukeropprettelse', () => {
    
    // Test for å opprette en ny bruker
    it('skal opprette en ny bruker', async () => {
        const res = await chai.request(app)
        .post('/blikunde') //sender POST forespørsel til /bruker
        .send({
            brukernavn: `testbruker1234567`,
            passord: `testpassord`,
            email: `nymail@gmail.com`
        });
    
        //Forventer 201 Created
        expect(res.status).to.equal(201);
        //Forventer at brukeren er opprettet
        expect(res.body.message).to.equal('Bruker registrert');
    });

    // Test for å opprette en bruker med manglende brukeren
    it('skal returnere 400 hvis brukernavn mangler', async () => {
        const res = await chai.request(app)
        .post('/blikunde')
        .send({
            passord: 'testpassord',
            email: `nybruker@gmail.com`
        });
    
        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal('Brukernavn, passord og email må oppgis');
    });
});


