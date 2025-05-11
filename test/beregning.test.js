
const { expect } = require('chai'); //importerer expect-funksjonen fra chai for å kjøre testene
const { beregnUrealisertGevinst } = require('../utils/beregning'); //importerer funksjonen vi øsker å teste i utils mappen

//tester funksjonen for beregning av realisert gevinst
describe('beregnUrealisertGevinst()', () => {
    it('skal returnere riktig gevinst', () => {
        const resultat = beregnUrealisertGevinst(200, 300, 10);
        expect(resultat).to.equal(1000); //forventet gevinst
    });
});