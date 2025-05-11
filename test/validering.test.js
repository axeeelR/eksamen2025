//Importerer funksjonene som skal testes samt chai
const { expect } = require('chai');
const { gyldigISIN } = require('../utils/validering');

//tester valdieringen av ISIN nummer
describe('gyldigISIN', () => {
    it('returnerer true ved gyldig ISIN', () => {
        expect(gyldigISIN('NO1212345672')).to.be.true; //12 tegn = gyldig
    });

    it('returnerer false for feil ISIN', () => {
        expect(gyldigISIN('NO321')).to.be.false; //mindre enn 12 tegn = ugyldig
    });
});
