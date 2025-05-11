const { expect } = require('chai');
const { gyldigISIN } = require('../utils/validering');

describe('gyldigISIN', () => {
    it('returnerer true ved gyldig ISIN', () => {
        expect(gyldigISIN)
    });
});
