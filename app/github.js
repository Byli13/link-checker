

const GH_API = 'https://api.github.com';

function getToken() {
    // Portainer Secrets montés à /run/secrets/<name>
    // On lit en priorité le secret, sinon la var d'env (fallback)
    return (awaitRead('/run/secrets/github_token')) || process.env.GITHUB_TOKEN || '';
}

async function awaitRead(path) {
    try {
        const fs = await import('node:fs/promises');
        return await fs.readFile(path, 'utf8');
    } catch { return ''; }
}

function ghHeaders(token) {
    const h = { 'Accept': 'application/vnd.github+json' };
    if (token) h['Authorization'] = `Bearer ${token.trim()}`;
    return h;
}

export async function listJsonFiles({ owner, repo, branch, includePaths }) {
    const token = await getToken();
    // Liste récursive de l’arbre (rapide & fiable)
    const url = `${GH_API}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
    const res = await fetch(url, { headers: ghHeaders(token) });
    if (!res.ok) throw new Error(`GitHub list tree failed: ${res.status}`);
    const data = await res.json();
    const inc = includePaths
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

    return (data.tree || [])
        .filter(n => n.type === 'blob' && n.path.endsWith('.json'))
        .filter(n => inc.length === 0 || inc.some(p => n.path.startsWith(p)))
        .map(n => n.path);
}

export async function getJsonFile({ owner, repo, branch, path }) {
    const token = await getToken();
    const url = `${GH_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
    const res = await fetch(url, { headers: ghHeaders(token) });
    if (!res.ok) throw new Error(`GitHub get contents failed: ${res.status} (${path})`);
    const data = await res.json();
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    try { return JSON.parse(content); }
    catch (e) {
        err('JSON parse error on', path, e.message);
        return null;
    }
}
