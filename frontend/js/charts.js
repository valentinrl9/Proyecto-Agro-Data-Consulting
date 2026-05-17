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
    texto = texto.replace(",", "."); // ⭐ convertir coma → punto
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
                filler: { propagate: false },

                // ⭐ AÑADIDO: TÍTULO DE LA GRÁFICA
                title: {
                    display: true,
                    text: opcionesExtra.titulo || "",
                    color: "#e5e7eb",
                    font: { size: 16, weight: "bold" },
                    padding: { top: 10, bottom: 10 }
                }
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
function cargarGraficas(data) {
    //const data = await getRecomendaciones();

    const labels = data.diario.map(d => d.fecha);
    const et0 = data.diario.map(d => extraerNumero(d.informacion[0]));
        console.log("📌 ET0 recibido por la gráfica:", et0);
        console.log("📌 INFORMACION[0] bruto:", data.diario.map(d => d.informacion[0]));

    const estres = data.diario.map(d => extraerNumero(d.informacion[1]));
    const humedad = data.diario.map(d => extraerNumero(d.informacion[2]));

    const ctx1 = document.getElementById("chart-et0").getContext("2d");
    const ctx2 = document.getElementById("chart-estres").getContext("2d");
    const ctx3 = document.getElementById("chart-humedad").getContext("2d");

    // ET0 → escala fija 0–50
    crearGraficaLinea(ctx1, labels, et0, "rgb(74, 222, 128)", {
        titulo: "ET0",
        y: { min: 0, max: 50 }
    });

    // Estrés térmico → escala automática
    crearGraficaLinea(ctx2, labels, estres, "rgb(249, 115, 22)", {
        titulo: "Estrés térmico"
    });

    // 1. Convertimos los valores de humedad a números
    const valoresHumedad = humedad.map(v => parseFloat(v));

    // 2. Calculamos el mínimo y máximo real de la serie
    const minH = Math.min(...valoresHumedad);
    const maxH = Math.max(...valoresHumedad);

    // 3. Añadimos un pequeño margen visual
    const margen = 2;

    const minEscala = Math.max(0, minH - margen);
    const maxEscala = Math.min(100, maxH + margen);

    // 4. Creamos la gráfica con escala dinámica
    crearGraficaLinea(ctx3, labels, humedad, "rgb(96, 165, 250)", {
        titulo: "Humedad",
        y: { min: minEscala, max: maxEscala }
    });

}


