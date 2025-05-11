function prosentvisEndring(ny, gammel) {
    if (gammel === 0) return 0;
    return parseFloat ((((ny - gammel) / gammel)* 100).toFixed(2));
}

module.exports = { prosentvisEndring };