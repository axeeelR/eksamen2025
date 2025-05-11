//Beregner prosentvis endring mellom to tall
function prosentvisEndring(ny, gammel) {
    if (gammel === 0) return 0; //unngår deling på null
    return parseFloat ((((ny - gammel) / gammel)* 100).toFixed(2)); //returnerer avrundet prosentvis endring
}

module.exports = { prosentvisEndring };