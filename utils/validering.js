//sjekker om ISIN kode er gyldig, må være en streng og 12 tegn
function gyldigISIN(isin){
    return typeof isin ==='string' && isin.length === 12;
}

module.exports = { gyldigISIN };