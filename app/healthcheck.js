import fs from 'node:fs/promises';

const LAST_RUN = '/state/last-run';
const MAX_AGE_MS = 36 * 60 * 60 * 1000; // 36h

async function main() {
    try {
        const s = await fs.readFile(LAST_RUN, 'utf8');
        const t = parseInt(s, 10);
        if (!t || (Date.now() - t) > MAX_AGE_MS) {
            console.error('stale or missing last-run');
            process.exit(1);
        }
        process.exit(0);
    } catch {
        console.error('no last-run file');
        process.exit(1);
    }
}
main();
