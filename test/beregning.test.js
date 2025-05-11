const { expect } = require('chai');
const { bergenUrealisertGevinst } = require('../utils/beregning');

describe('beregnUrealisertGevinst()', () => {
    it('skal returnere riktig gevinst', () => {
        const resultat = bergenUrealisertGevinst(200, 300, 10);
        expect(resultat).to.equal(1000)
    });
});