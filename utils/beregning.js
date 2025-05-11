//Returnerer urealisert gevinst eller tap basert på snittpris og markedspris
function beregnUrealisertGevinst(snittpris, markedspris, mengde) {
    return (markedspris - snittpris) * mengde;
}

module.exports = { beregnUrealisertGevinst };