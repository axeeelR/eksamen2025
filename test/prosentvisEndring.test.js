const { prosentvisEndring } = require('../utils/prosentvisEndring');
const { expect } = require('chai');

//Tester funksjonen, beregner prosentvis endring
describe('prosentEndring()', () => {
    //skal gi positiv endring hvis ny verdi er større enn gammel verdi
    it('returnerer positiv endring', () => {
        const resultat = prosentvisEndring(150, 100)
        expect(resultat).to.equal(50.00);
    });

    //skal gi negativ verdi hvis ny verdi er mindre enn gammel verdi
    it('returnerer negativ endring', () => {
        const resultat = prosentvisEndring(80, 100);
        expect(resultat).to.equal(-20.00)
    });
});