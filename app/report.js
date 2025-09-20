import { err, log } from './logger.js';
import fs from 'node:fs/promises';

async function readSecret(name) {
    try { return (await fs.readFile(`/run/secrets/${name}`, 'utf8')).trim(); }
    catch { return (process.env[name] || '').trim(); }
}

function chunk(arr, n) {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
}

// Petit cache dans /state pour dédup (ne pas re-rapporter le même lien tous les jours)
const STATE_FILE = '/state/seen.json';
async function readState() {
    try { return JSON.parse(await fs.readFile(STATE_FILE, 'utf8')); }
    catch { return { bad: {} }; }
}
async function writeState(s) { await fs.mkdir('/state', { recursive: true }); await fs.writeFile(STATE_FILE, JSON.stringify(s)); }

export async function sendReport({ fileFindings }) {
    const webhook = await readSecret('discord_webhook');
    const DRY = (process.env.DRY_RUN || '0') === '1';
    const mode = (process.env.REPORT_MODE || 'only-errors').toLowerCase();
    const batch = parseInt(process.env.REPORT_BATCH_SIZE || '20', 10);

    const totalBroken = fileFindings.reduce((a, f) => a + f.broken.length, 0);

    if (mode === 'only-errors' && totalBroken === 0) {
        log('[report] RAS (aucun lien cassé)');
        return;
    }

    const state = await readState();

    for (const f of fileFindings) {
        // Filtrer ceux déjà vus
        const fresh = f.broken.filter(b => !state.bad[b.url]);
        if (fresh.length === 0 && mode === 'only-errors') continue;

        const groups = chunk(fresh.length ? fresh : f.broken, batch);
        for (const g of groups) {
            const embeds = [{
                title: fresh.length ? `Liens cassés détectés (${f.path})` : `Rapport (${f.path})`,
                description: fresh.length ? `Nouveaux liens cassés: ${g.length}` : `Total liens cassés: ${g.length}`,
                fields: g.map(x => ({
                    name: x.url,
                    value: `\`${x.reason}\` · ${x.contentType || '(no-ct)'}`
                })).slice(0, 25) // Discord max fields/embeds
            }];

            if (DRY) {
                log('[DRY] webhook payload', { embedsCount: embeds.length, file: f.path, items: g.length });
            } else {
                const res = await fetch(webhook, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ embeds })
                });
                if (!res.ok) err('[report] webhook failed', res.status);
            }
        }

        // Marquer vus
        for (const b of fresh) state.bad[b.url] = { firstSeen: Date.now(), path: f.path };
    }

    await writeState(state);
}
