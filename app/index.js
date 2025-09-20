import { listJsonFiles, getJsonFile } from './github.js';
import { extractUrlsFromJson } from './extract.js';
import { checkUrls } from './checker.js';
import { sendReport } from './report.js';
import fs from 'node:fs/promises';

// TZ pour cron
process.env.TZ = process.env.TIMEZONE || 'Europe/Paris';

function getEnv(name, def='') {
    const v = process.env[name];
    return (v === undefined || v === null || v === '') ? def : v;
}

const OWNER = getEnv('GITHUB_OWNER');
const NAME  = getEnv('GITHUB_NAME');
const BRANCH = getEnv('GITHUB_BRANCH', 'main');
const INCLUDE = getEnv('INCLUDE_PATHS', 'data/');
const CRON = getEnv('CRON_SCHEDULE', '0 9,21 * * *');
const RUN_ON_START = getEnv('RUN_ON_START', '1') === '1';

async function doRun() {
    const started = Date.now();
    log('[run] start', { owner: OWNER, repo: NAME, branch: BRANCH, include: INCLUDE });

    try {
        const files = await listJsonFiles({
            owner: OWNER, repo: NAME, branch: BRANCH, includePaths: INCLUDE
        });

        log('[run] json files:', files.length);

        const fileFindings = [];
        for (const path of files) {
            const json = await getJsonFile({ owner: OWNER, repo: NAME, branch: BRANCH, path });
            if (!json) continue;
            const urls = extractUrlsFromJson(json);
            if (urls.length === 0) continue;

            const broken = await checkUrls(urls);
            const onlyBroken = broken.filter(x => x.ok === false);
            if (onlyBroken.length > 0) {
                fileFindings.push({ path, broken: onlyBroken });
            }
        }

        await sendReport({ fileFindings });

        // health marker
        await fs.mkdir('/state', { recursive: true });
        await fs.writeFile('/state/last-run', String(Date.now()));

        log('[run] done in', (Date.now() - started) + 'ms');
    } catch (e) {
        err('[run] failed', e.stack || e.message);
    }
}

// Cron minimaliste sans dépendance : setInterval + calcul simple (ou laisse CRON ici si tu veux vraiment cron-lib)
function nextDelayFromSpec() {
    // Pour garder simple, on exécute toutes les 12h par défaut (09:00/21:00).
    // Si tu veux du vrai parsing CRON, tu peux swap par une lib plus tard.
    return 12 * 60 * 60 * 1000;
}

async function scheduler() {
    if (RUN_ON_START) await doRun();
    const delay = nextDelayFromSpec(CRON);
    setInterval(doRun, delay);
}

scheduler();
