// ===============================
// CONFIGURACIÓN GLOBAL DE CHART.JS
// ===============================
Chart.defaults.color = "#e5e7eb";
Chart.defaults.font.family = "Inter, Arial, sans-serif";
Chart.defaults.borderColor = "rgba(255,255,255,0.08)";
Chart.defaults.plugins.legend.labels.boxWidth = 12;

window.chartInstances = window.chartInstances || [];

function destruirGraficas() {
    window.chartInstances.forEach(c => c.destroy());
    window.chartInstances = [];
}

function extraerNumero(texto) {
    if (typeof texto === "number") return texto;
    texto = String(texto).replace(",", ".");
    const match = texto.match(/[-+]?\d*\.?\d+/);
    return match ? parseFloat(match[0]) : 0;
}

function escalaDinamica(valores, margen = 0.08) {
    const nums = valores.filter(v => Number.isFinite(v));
    if (!nums.length) return { min: 0, max: 1 };
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const rango = max - min || Math.max(max * 0.1, 1);
    return {
        min: Math.max(0, min - rango * margen),
        max: max + rango * margen,
    };
}

function crearGraficaLinea(ctx, labels, data, colorBase, opcionesExtra = {}) {
    const colorLinea = colorBase;
    const colorFondo = colorBase.replace(")", ", 0.25)").replace("rgb", "rgba");

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, colorFondo);
    gradient.addColorStop(1, "rgba(0,0,0,0)");

    const chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                data: data,
                borderColor: colorLinea,
                backgroundColor: gradient,
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: colorLinea,
                tension: 0.35,
                fill: true,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: opcionesExtra.titulo || "",
                    color: "#e5e7eb",
                    font: { size: 16, weight: "bold" },
                    padding: { top: 10, bottom: 10 }
                },
                subtitle: opcionesExtra.subtitulo ? {
                    display: true,
                    text: opcionesExtra.subtitulo,
                    color: "rgba(226,242,255,0.65)",
                    font: { size: 11 },
                    padding: { bottom: 8 }
                } : undefined,
            },
            scales: {
                x: {
                    grid: { color: "rgba(255,255,255,0.05)" }
                },
                y: {
                    grid: { color: "rgba(255,255,255,0.05)" },
                    ...opcionesExtra.y
                }
            }
        }
    });

    window.chartInstances.push(chart);
    return chart;
}

function cargarGraficas(data) {
    destruirGraficas();

    const diario = data.diario || [];
    const labels = diario.map(d => d.fecha);
    const et0 = diario.map(d => d.et0 ?? extraerNumero(d.informacion?.[0]));
    const estres = diario.map(d => d.estres ?? extraerNumero(d.informacion?.[1]));
    const humedad = diario.map(d => d.humedad ?? extraerNumero(d.informacion?.[2]));

    const ctx1 = document.getElementById("chart-et0").getContext("2d");
    const ctx2 = document.getElementById("chart-estres").getContext("2d");
    const ctx3 = document.getElementById("chart-humedad").getContext("2d");

    const esParcial = diario.some(d => d.es_parcial);
    const escalaEt0 = escalaDinamica(et0);
    crearGraficaLinea(ctx1, labels, et0, "rgb(74, 222, 128)", {
        titulo: "ET0",
        subtitulo: esParcial
            ? "mm/día · *Hoy parcial + predicción 7 días"
            : "mm/día · hoy + predicción 7 días",
        y: { min: escalaEt0.min, max: escalaEt0.max }
    });

    const escalaEstres = escalaDinamica(estres);
    crearGraficaLinea(ctx2, labels, estres, "rgb(249, 115, 22)", {
        titulo: "Estrés térmico",
        subtitulo: "Índice medio diario",
        y: { min: escalaEstres.min, max: escalaEstres.max }
    });

    const escalaHum = escalaDinamica(humedad, 0.05);
    crearGraficaLinea(ctx3, labels, humedad, "rgb(96, 165, 250)", {
        titulo: "Humedad",
        subtitulo: "% media diaria",
        y: {
            min: Math.max(0, escalaHum.min),
            max: Math.min(100, escalaHum.max)
        }
    });
}
