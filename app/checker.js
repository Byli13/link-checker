
const TIMEOUT = parseInt(process.env.HTTP_TIMEOUT_MS || '10000', 10);
const RETRIES = parseInt(process.env.HTTP_RETRIES || '1', 10);
const CONC   = parseInt(process.env.HTTP_CONCURRENCY || '12', 10);
const ALLOWED = (process.env.ALLOWED_MIME_PREFIXES || 'image/,video/').split(',').map(s => s.trim());

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function headOrGet(u, signal) {
    // HEAD d’abord (rapide). Si non supporté → GET.
    let r = await fetch(u, { method: 'HEAD', redirect: 'follow', signal });
    if (r.status === 405 || r.status === 501) {
        r = await fetch(u, { method: 'GET', redirect: 'follow', signal });
    }
    return r;
}

async function fetchWithTimeout(u, attempt = 0) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT);
    try {
        const res = await headOrGet(u, controller.signal);
        clearTimeout(id);
        return res;
    } catch (e) {
        clearTimeout(id);
        if (attempt < RETRIES) {
            await sleep(300 * (attempt + 1));
            return fetchWithTimeout(u, attempt + 1);
        }
        throw e;
    }
}

export async function checkUrls(urls) {
    const results = [];
    let i = 0;

    async function worker() {
        while (i < urls.length) {
            const u = urls[i++];

            try {
                const res = await fetchWithTimeout(u);
                const status = res.status;
                const ct = (res.headers.get('content-type') || '').toLowerCase();
                const okMime = ALLOWED.some(p => ct.startsWith(p));

                let ok = status >= 200 && status < 300 && okMime;
                // Autoriser 3xx si redirige finalement sur un 200 mime ok (fetch follow s'en charge)
                if (status >= 300 && status < 400) ok = true; // déjà suivi

                if (!ok) {
                    results.push({
                        url: u,
                        ok: false,
                        status,
                        contentType: ct || '(none)',
                        reason: !okMime ? 'Bad MIME' : `HTTP ${status}`
                    });
                }
            } catch (e) {
                results.push({ url: u, ok: false, status: 0, contentType: '', reason: e.name === 'AbortError' ? 'Timeout' : (e.message || 'Network error') });
            }
        }
    }

    const workers = Array.from({ length: Math.min(CONC, Math.max(1, urls.length)) }, worker);
    await Promise.all(workers);
    return results;
}
