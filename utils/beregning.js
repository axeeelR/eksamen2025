function bergnUrealisertGevinst(snittpris, markedspris, mengde) {
    return (markedspris - snittpris) * mengde;
}

module.exports = { bergnUrealisertGevinst };