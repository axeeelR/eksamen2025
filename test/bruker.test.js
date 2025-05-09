const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;
const app = require('../server');
chai.use(chaiHttp);

describe('Brukeropprettelse', () => {
    it('skal opprette en ny bruker', async () => {
        const res = await chai.request(app)
        .post('/blikunde')
        .send({
            brukernavn: `testbruker123456`,
            passord: `testpassord`,
            email: `nymail@gmail.com`
        });
    
        expect(res.status).to.equal(201);
        expect(res.body.message).to.equal('Bruker registrert');
    });

    it('skal returnere 400 hvis brukernavn mangler', async () => {
        const res = await chai.request(app)
        .post('/blikunde')
        .send({
            username: 'Axel',
            password: 'testpassord'
        });
    
        expect(res.status).to.equal(400);
        expect(res.body.message).to.equal('Brukernavn, passord og email må oppgis');
    });
});