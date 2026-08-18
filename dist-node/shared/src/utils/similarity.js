"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripZeroWidth = stripZeroWidth;
exports.normalizeForMatching = normalizeForMatching;
exports.tokenize = tokenize;
exports.jaccardSimilarity = jaccardSimilarity;
exports.charNgramSimilarity = charNgramSimilarity;
exports.combinedSimilarity = combinedSimilarity;
const LEET_MAP = {
    '0': 'o',
    '1': 'i',
    '3': 'e',
    '4': 'a',
    '5': 's',
    '7': 't',
    '@': 'a',
    '$': 's',
    '+': 't',
    '!': 'i',
    '<': 'l',
    '>': 'l',
    '(': 'c',
    '[': 'l',
    '{': 'l',
};
const CONFUSABLE_MAP = {
    á: 'a', à: 'a', â: 'a', ä: 'a', ã: 'a', å: 'a', ā: 'a',
    é: 'e', è: 'e', ê: 'e', ë: 'e', ē: 'e',
    í: 'i', ì: 'i', î: 'i', ï: 'i', ī: 'i',
    ó: 'o', ò: 'o', ô: 'o', ö: 'o', õ: 'o', ø: 'o',
    ú: 'u', ù: 'u', û: 'u', ü: 'u', ū: 'u',
    ç: 'c', ñ: 'n', ß: 'ss',
};
function stripZeroWidth(input) {
    return input.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u180E\u202A-\u202E]/g, '');
}
function normalizeForMatching(input) {
    let out = stripZeroWidth(input).toLowerCase();
    out = out.split('').map((ch) => LEET_MAP[ch] ?? CONFUSABLE_MAP[ch] ?? ch).join('');
    out = out.replace(/[^a-z0-9\s]/g, ' ');
    out = out.replace(/\s+/g, ' ').trim();
    return out;
}
function tokenize(input) {
    return normalizeForMatching(input).split(' ').filter(Boolean);
}
function jaccardSimilarity(a, b) {
    const ta = new Set(tokenize(a));
    const tb = new Set(tokenize(b));
    if (ta.size === 0 && tb.size === 0)
        return 1;
    let inter = 0;
    for (const t of ta)
        if (tb.has(t))
            inter++;
    const union = ta.size + tb.size - inter;
    return union === 0 ? 0 : inter / union;
}
function charNgramSimilarity(a, b, n = 3) {
    const na = normalizeForMatching(a);
    const nb = normalizeForMatching(b);
    if (na.length < n || nb.length < n) {
        return na === nb ? 1 : 0;
    }
    const grams = (s) => {
        const set = new Set();
        for (let i = 0; i <= s.length - n; i++)
            set.add(s.slice(i, i + n));
        return set;
    };
    const ga = grams(na);
    const gb = grams(nb);
    let inter = 0;
    for (const g of ga)
        if (gb.has(g))
            inter++;
    const union = ga.size + gb.size - inter;
    return union === 0 ? 0 : inter / union;
}
function combinedSimilarity(a, b) {
    return Math.max(jaccardSimilarity(a, b), charNgramSimilarity(a, b));
}
//# sourceMappingURL=similarity.js.map