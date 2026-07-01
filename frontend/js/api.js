window.API_BASE = window.location.protocol === "file:"
    ? "http://127.0.0.1:8000"
    : "";

async function getRecomendaciones() {
    const res = await fetch(`${window.API_BASE}/recomendaciones?dias=7`);
    return await res.json();
}

async function getAlertas() {
    const res = await fetch(`${window.API_BASE}/alertas`);
    return await res.json();
}

async function getInformeMensual() {
    const res = await fetch(`${window.API_BASE}/informe_mensual`);
    return await res.json();
}
