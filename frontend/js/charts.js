// ===============================
// CONFIGURACIÓN GLOBAL DE CHART.JS
// ===============================
Chart.defaults.color = "#e5e7eb";
Chart.defaults.font.family = "Inter, Arial, sans-serif";
Chart.defaults.borderColor = "rgba(255,255,255,0.08)";
Chart.defaults.plugins.legend.labels.boxWidth = 12;


// ===============================
// FUNCIÓN PARA EXTRAER NÚMEROS DE TEXTOS CON EMOJIS
// ===============================
function extraerNumero(texto) {
    const match = texto.match(/[-+]?\d*\.?\d+/);
    return match ? parseFloat(match[0]) : 0;
}


// ===============================
// FUNCIÓN PARA CREAR GRÁFICAS MODERNAS
// ===============================
function crearGraficaLinea(ctx, labels, data, colorBase, opcionesExtra = {}) {

    const colorLinea = colorBase;
    const colorFondo = colorBase.replace(")", ", 0.25)").replace("rgb", "rgba");

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, colorFondo);
    gradient.addColorStop(1, "rgba(0,0,0,0)");

    return new Chart(ctx, {
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
                order: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                filler: { propagate: false }
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
}


// ===============================
// CARGAR GRÁFICAS
// ===============================
async function cargarGraficas() {
    const data = await getRecomendaciones();

    const labels = data.diario.map(d => d.fecha);
    const et0 = data.diario.map(d => extraerNumero(d.informacion[0]));
    const estres = data.diario.map(d => extraerNumero(d.informacion[1]));
    const humedad = data.diario.map(d => extraerNumero(d.informacion[2]));

    const ctx1 = document.getElementById("chart-et0").getContext("2d");
    const ctx2 = document.getElementById("chart-estres").getContext("2d");
    const ctx3 = document.getElementById("chart-humedad").getContext("2d");

    // ET0 → escala fija 0–1
    crearGraficaLinea(ctx1, labels, et0, "rgb(74, 222, 128)", {
        y: { min: 0, max: 1 }
    });

    // Estrés térmico → escala automática
    crearGraficaLinea(ctx2, labels, estres, "rgb(249, 115, 22)");

    // Humedad → escala 0–100
    crearGraficaLinea(ctx3, labels, humedad, "rgb(96, 165, 250)", {
        y: { min: 0, max: 100 }
    });
}

cargarGraficas();
