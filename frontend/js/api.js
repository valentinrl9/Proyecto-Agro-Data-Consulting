(function () {
    const isLocal =
        window.location.protocol === "file:" ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";

    window.API_BASE = isLocal ? "http://127.0.0.1:8000" : "";
})();

function apiUrl(path) {
    return `${window.API_BASE}${path}`;
}

async function fetchJson(path) {
    const res = await fetch(apiUrl(path));
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.detail || data.error || `Error HTTP ${res.status}`);
    }
    return data;
}

async function getRecomendaciones() {
    return fetchJson("/recomendaciones?dias=7");
}

async function getAlertas() {
    return fetchJson("/alertas");
}

async function getEtlStatus() {
    const res = await fetch(apiUrl("/etl/status"));
    return await res.json();
}

async function getHealth() {
    return fetchJson("/health");
}
