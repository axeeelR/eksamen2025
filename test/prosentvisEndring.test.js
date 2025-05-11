const { prosentvisEndring } = require('../utils/prosentvisEndring');
const { expect } = require('chai');

describe('prosentEndring()', () => {
    it('returnerer positiv endring', () => {
        expect(prosentvisEndring(150, 100).toFixed.equal(50.00))
    });

    it('returnerer negativ endring', () => {
        expect(prosentvisEndring(80, 100).toFixed.equal(-20.00))
    });
});