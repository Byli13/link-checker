// Extrait toutes les URLs http(s) depuis un texte quelconque
const urlRe = /\bhttps?:\/\/[^\s<>"'`(){}[\]]+/gi;

export function extractUrlsFromText(text) {
    if (!text || typeof text !== 'string') return [];
    const found = text.match(urlRe) || [];
    // Dédup par ordre d’apparition
    const seen = new Set();
    const out = [];
    for (const u of found) {
        if (!seen.has(u)) { seen.add(u); out.push(u); }
    }
    return out;
}

// Balaye un objet JSON arbitraire et extrait toutes les URLs trouvées dans les strings
export function extractUrlsFromJson(json) {
    const out = [];
    const walk = (val) => {
        if (typeof val === 'string') out.push(...extractUrlsFromText(val));
        else if (Array.isArray(val)) val.forEach(walk);
        else if (val && typeof val === 'object') Object.values(val).forEach(walk);
    };
    walk(json);
    // dédup globale
    return [...new Set(out)];
}
