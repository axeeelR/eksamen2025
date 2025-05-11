function gyldigISIN(isin){
    return typeof isin ==='string' && isin.length === 12;
}

module.exports = { gyldigISIN };