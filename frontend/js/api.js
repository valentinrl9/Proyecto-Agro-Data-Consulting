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

async function getRecomendaciones() {
    const res = await fetch(apiUrl("/recomendaciones?dias=7"));
    return await res.json();
}

async function getAlertas() {
    const res = await fetch(apiUrl("/alertas"));
    return await res.json();
}

async function getInformeMensual() {
    const res = await fetch(apiUrl("/informe_mensual"));
    return await res.json();
}
