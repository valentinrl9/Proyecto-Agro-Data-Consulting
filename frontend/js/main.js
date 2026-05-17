// Buscamos el botón y le asignamos la descarga real
const miBoton = document.getElementById("btn-descargar-pdf");
if (miBoton) {
    miBoton.addEventListener("click", () => {

        const element = document.getElementById("informe-contenido");

        // 1. Verificación de seguridad
        if (!element || element.innerHTML.trim() === "") {
            console.warn("⚠️ El contenedor 'informe-contenido' está vacío.");
            alert("Primero debes generar el informe con datos en la pantalla para poder descargarlo.");
            return;
        }

        // 2. Configuración del PDF en milímetros
        const options = {
            margin: 10,
            filename: "informe_mensual.pdf",
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
        };

        console.log("🚀 Enviando datos a html2pdf...");

        // 3. Ejecución y descarga
        html2pdf().set(options).from(element).save()
            .then(() => {
                console.log("✅ ¡PDF descargado con éxito!");
            })
            .catch(err => {
                console.error("❌ Error interno de la librería html2pdf:", err);
            });
    });
}
// Forzamos un listener directo al botón nada más cargar
window.addEventListener("DOMContentLoaded", () => {
    const miBoton = document.getElementById("btn-descargar-pdf");
    if (miBoton) {
        console.log("🎯 Botón PDF encontrado en el DOM con éxito.");
        miBoton.addEventListener("click", () => {
            console.log("💥 ¡BOOM! Click directo interceptado en el botón.");
        });
    } else {
        console.error("❌ Ojo: El botón 'btn-descargar-pdf' no existe en el HTML en este momento.");
    }
});

// ===============================
// NAVEGACIÓN ENTRE SECCIONES
// ===============================
document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".section").forEach(sec => sec.classList.remove("visible"));
        document.getElementById(btn.dataset.section).classList.add("visible");

        document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
    });
});


// ===============================
// FUNCIÓN PARA CREAR TARJETAS MODERNAS
// ===============================

function limpiarValor(texto) {
    // Extrae solo el número (incluye decimales)
    const match = texto.match(/[-+]?\d*\.?\d+/);
    return match ? match[0] : texto;
}

function crearTarjeta(titulo, valor, tipo) {
    const card = document.createElement("div");
    card.classList.add("card", `card-${tipo}`);

    const iconos = {
        et0: "🌿",
        estres: "🔥",
        humedad: "💧",
        temp: "🌡️",
        rad: "☀️",
        viento: "💨",
        dir: "🧭",
        presion: "📈",
        nubes: "☁️",
        lluvia: "🌧️"
    };

    card.innerHTML = `
        <div class="card-title">
            <span class="card-icon">${iconos[tipo] || "📊"}</span>
            ${titulo}: <strong>${valor}</strong>
        </div>
    `;

    return card;
}



// ===============================
// NAVEGACIÓN ENTRE SECCIONES
// ===============================
function mostrarVista(id) {
    // Ocultar todas las secciones
    document.querySelectorAll(".section").forEach(sec => {
        sec.style.display = "none";
    });

    // Mostrar la sección seleccionada
    document.getElementById(id).style.display = "block";

    // Actualizar botón activo
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.classList.remove("active");
        if (btn.dataset.section === id) {
            btn.classList.add("active");
        }
    });
}


// ===============================
// CARGAR DASHBOARD
// ===============================
async function cargarDashboard() {

    // 1. Cargar datos ACTUALES
    const data = await fetch("http://localhost:8000/actual")
        .then(r => r.json());

    console.log("DATOS ACTUALES:", data);

    // ===============================
    // TARJETAS RESUMEN (DATOS ACTUALES)
    // ===============================
    const cards = document.getElementById("cards-container");
    cards.innerHTML = ""; // limpiamos

    cards.appendChild(crearTarjeta("ET0 actual", data.et0_actual.toFixed(2), "et0"));
    cards.appendChild(crearTarjeta("Estrés térmico", data.estres_termico, "estres"));
    cards.appendChild(crearTarjeta("Humedad", data.humedad + "%", "humedad"));

    cards.appendChild(crearTarjeta("Temperatura", data.temperatura + "°C", "temp"));
    cards.appendChild(crearTarjeta("Radiación", data.radiacion + " W/m²", "rad"));
    cards.appendChild(crearTarjeta("Viento", data.viento + " km/h", "viento"));

    cards.appendChild(crearTarjeta("Dirección viento", data.direccion_viento + "°", "dir"));
    cards.appendChild(crearTarjeta("Presión", data.presion + " hPa", "presion"));
    cards.appendChild(crearTarjeta("Nubosidad", data.nubes + "%", "nubes"));
    cards.appendChild(crearTarjeta("Precipitación", data.precipitacion + " mm", "lluvia"));

    // 2. Cargar datos de IA (DIARIOS)
    window.pred = await getRecomendaciones();

    // ⭐ Crear riesgo diario ANTES de usar pred.diario
    pred.diario.forEach(d => {
        const estres = parseFloat(d.estres) || 0;
        const humedad = parseFloat(d.humedad) || 0;

        const estres_norm = Math.min(100, (estres / 120) * 100);
        const humedad_norm = Math.min(100, (humedad / 100) * 100);

        d.riesgo = Math.round(estres_norm * 0.6 + humedad_norm * 0.4);
    });

    // Guardar datos para gráficas
    window.DATA_GRAFICAS = pred.diario;

    // Cargar gráficas
    cargarGraficas(pred);



    function tendenciaRegresionHumedad(pred) {
    const valores = pred.diario.map((d, i) => ({
        x: i,
        y: parseFloat(d.humedad) // humedad predicha
    }));

    const n = valores.length;
    if (n < 2) return 0;

    const sumX = valores.reduce((a, v) => a + v.x, 0);
    const sumY = valores.reduce((a, v) => a + v.y, 0);
    const sumXY = valores.reduce((a, v) => a + v.x * v.y, 0);
    const sumX2 = valores.reduce((a, v) => a + v.x * v.x, 0);

    // Pendiente de la regresión
    const pendiente = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    return pendiente;
}
const pendiente = tendenciaRegresionHumedad(pred);

let mensaje = "";

if (pendiente > 0.2) {
    mensaje = "La humedad muestra una tendencia al alza.";
} else if (pendiente < -0.2) {
    mensaje = "La humedad está descendiendo según la IA.";
} else {
    mensaje = "La humedad se mantiene estable esta semana.";
}

document.getElementById("ia-tendencia").innerText = mensaje;

    
    // IA avanzada
    const estresHoy = parseFloat(pred.diario[0].informacion[1]);
    const estresManana = parseFloat(pred.diario[1].informacion[1]);

    document.getElementById("ia-prediccion").innerText =
        estresManana > estresHoy
            ? "La IA prevé un aumento del estrés térmico estos días."
            : "La IA anticipa un descenso del estrés térmico estos días.";

    const humedadHoy = parseFloat(pred.diario[0].informacion[2]);
    const humedadManana = parseFloat(pred.diario[1].informacion[2]);

    // document.getElementById("ia-tendencia").innerText =
    //     humedadManana > humedadHoy
    //         ? "La humedad muestra una tendencia al alza."
    //         : "La humedad está descendiendo según la IA.";

// 1. Riesgo acumulado (tu cálculo original)
const riesgoAcumulado = Math.round(
    pred.diario.reduce((acc, d) => acc + (parseFloat(d.riesgo) || 0), 0)
);

// 2. Tendencia por regresión del riesgo
function tendenciaRegresionRiesgo(pred) {
    const valores = pred.diario.map((d, i) => ({
        x: i,
        y: parseFloat(d.riesgo) || 0
    }));

    const n = valores.length;
    if (n < 2) return 0;

    const sumX = valores.reduce((a, v) => a + v.x, 0);
    const sumY = valores.reduce((a, v) => a + v.y, 0);
    const sumXY = valores.reduce((a, v) => a + v.x * v.y, 0);
    const sumX2 = valores.reduce((a, v) => a + v.x * v.x, 0);

    const pendiente = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    return pendiente;
}

// 3. Interpretación de la tendencia
const pendienteRiesgo = tendenciaRegresionRiesgo(pred);

let mensajeRiesgo = "";

if (pendienteRiesgo > 0.3) {
    mensajeRiesgo = "El riesgo acumulado muestra una tendencia al alza.";
} else if (pendienteRiesgo < -0.3) {
    mensajeRiesgo = "El riesgo acumulado está descendiendo según la IA.";
} else {
    mensajeRiesgo = "El riesgo acumulado se mantiene estable.";
}

// 4. Mostrar todo en el panel IA
document.getElementById("ia-analisis").innerText =
    "La IA detecta un riesgo acumulado de " +
    riesgoAcumulado +
    " puntos esta semana. " +
    mensajeRiesgo;

    // Resto del dashboard
    mostrarRecomendaciones(pred.diario[0]);
    const alertasHoy = generarAlertas(pred.diario[0]);
    mostrarAlertas(alertasHoy);
    mostrarRiesgo(pred.diario);
    cargarInformeMensual();
}





// ===============================
// BOTÓN APAGAR SISTEMA
// ===============================
document.getElementById("btn-apagar").addEventListener("click", () => {
    const confirmar = confirm("⚠️ ¿Seguro que deseas apagar el sistema?\nSe detendrán las tareas automáticas de actualización 24h.");
    if (confirmar) {
        fetch("http://127.0.0.1:8000/apagar", { method: "POST" })
            .then(() => window.close());
    }
});



// ===============================
// INICIAR DASHBOARD
// ===============================
cargarDashboard();


// ===============================
// RECOMENDACIONES
// ===============================
function mostrarRecomendaciones(dia) {
    const cont = document.getElementById("recs-container");
    cont.innerHTML = "";

    const recs = dia.recomendaciones || [];

    if (recs.length === 0) {
        cont.innerHTML = "<p class='sin-alertas'>No hay recomendaciones para hoy.</p>";
        return;
    }

    // Convertimos cada recomendación en objeto con prioridad, color e icono
    const procesadas = recs.map(texto => {
        let icono = "💡";
        let cuerpo = texto;
        let color = "verde";
        let prioridad = 4;

        // Extraer emoji inicial
        const match = texto.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*(.*)$/u);
        if (match) {
            icono = match[1];
            cuerpo = match[2];
        }

        // Asignar prioridad según contenido
        if (texto.includes("crítico") || texto.includes("urgente")) {
            prioridad = 1; color = "rojo";
        } else if (texto.includes("alto")) {
            prioridad = 2; color = "naranja";
        } else if (texto.includes("baja") || texto.includes("ligero")) {
            prioridad = 4; color = "verde";
        } else if (texto.includes("hongos")) {
            prioridad = 3; color = "morado";
        }

        // NUEVO: explicaciones IA basadas SOLO en el texto
        const explicacion = generarExplicacionIA_Texto(cuerpo);

        return { icono, cuerpo, color, prioridad, ...explicacion };
    });

    // Ordenar por prioridad
    procesadas.sort((a, b) => a.prioridad - b.prioridad);

    // Pintar tarjetas
    procesadas.forEach(r => {
        const card = document.createElement("div");
        card.classList.add("recomendacion-card", `rec-${r.color}`);

        card.innerHTML = `
            <span class="recomendacion-icono">${r.icono}</span>
            <div class="recomendacion-texto">
                <strong>${r.cuerpo}</strong>

                <p class="recomendacion-base">
                    <em>Basado en:</em> ${r.basedOn}
                </p>

                <p class="recomendacion-razon">
                    <em>Por qué:</em> ${r.reason}
                </p>
            </div>
        `;

        cont.appendChild(card);
    });
}



function generarExplicacionIA_Texto(texto) {

    if (texto.includes("Estrés térmico alto")) {
        return {
            basedOn: "niveles elevados de temperatura y baja humedad relativa",
            reason: "la IA detecta riesgo de sobrecalentamiento y recomienda mejorar la ventilación."
        };
    }

    if (texto.includes("ET0 baja") && texto.includes("Estrés")) {
        return {
            basedOn: "una combinación de baja demanda hídrica y alta carga térmica",
            reason: "la IA prioriza la ventilación porque el riego no es necesario en estas condiciones."
        };
    }

    if (texto.includes("ET0 baja")) {
        return {
            basedOn: "una evapotranspiración reducida y humedad suficiente en el ambiente",
            reason: "regar de más podría saturar el suelo y reducir el oxígeno radicular."
        };
    }

    return {
        basedOn: "las condiciones actuales del cultivo",
        reason: "la IA considera que esta acción optimiza el estado general del cultivo."
    };
}




// ===============================
// RIESGO SEMANAL (NUEVO)
// ===============================

function calcularRiesgoSemanalPred(predDiario) {
    if (!predDiario.length) return 0;

    let riesgos = [];

    predDiario.forEach(d => {
        const estres = d.estres_termico;  // ya viene como número
        const humedad = d.humedad;        // ya viene como número

        // Normalización suave
        const estres_norm = Math.min(100, (estres / 120) * 100);
        const humedad_norm = Math.min(100, (humedad / 100) * 100);

        // Peso realista
        const riesgoDia = estres_norm * 0.6 + humedad_norm * 0.4;

        riesgos.push(riesgoDia);
    });

    const promedio = riesgos.reduce((a, b) => a + b, 0) / riesgos.length;

    return Math.round(promedio);
}
function mostrarRiesgoPred(pred) {
    const riesgo = calcularRiesgoSemanalPred(pred.diario);

    // Barra
    const fill = document.getElementById("riesgo-bar-fill");
    fill.style.width = riesgo + "%";

    const texto = document.getElementById("riesgo-bar-text");
    texto.textContent = `Riesgo acumulado semanal: ${riesgo}%`;

    // Detalles
    const cont = document.getElementById("riesgo-detalles");
    cont.innerHTML = "";

    pred.diario.forEach(d => {
        const card = document.createElement("div");
        card.classList.add("riesgo-card");

        card.innerHTML = `
            <h3>${d.fecha}</h3>
            <p><strong>Estrés térmico:</strong> ${d.estres_termico}</p>
            <p><strong>Humedad:</strong> ${d.humedad}%</p>
        `;

        cont.appendChild(card);
    });
}
mostrarRiesgoPred(pred);


function calcularRiesgoSemanal(diario) {
    if (!diario.length) return 0;

    let riesgos = [];

    diario.forEach(d => {
        const estres = extraerNumero(d.informacion[1]);   // 60–120
        const humedad = extraerNumero(d.informacion[2]);  // 40–90

        // Normalización suave
        const estres_norm = Math.min(100, (estres / 120) * 100);
        const humedad_norm = Math.min(100, (humedad / 100) * 100);

        // Peso realista
        const riesgoDia = estres_norm * 0.6 + humedad_norm * 0.4;

        riesgos.push(riesgoDia);
    });

    // Promedio mensual
    const promedio = riesgos.reduce((a,b) => a+b, 0) / riesgos.length;

    return Math.round(promedio);
}


function mostrarRiesgo(diario) {
    const riesgo = calcularRiesgoSemanal(diario);

    // Barra
    const fill = document.getElementById("riesgo-bar-fill");
    fill.style.width = riesgo + "%";

    const texto = document.getElementById("riesgo-bar-text");
    texto.textContent = `Riesgo acumulado semanal: ${riesgo}%`;

    // Detalles
    const cont = document.getElementById("riesgo-detalles");
    cont.innerHTML = "";

    diario.forEach(d => {
        const estres = extraerNumero(d.informacion[1]);
        const humedad = extraerNumero(d.informacion[2]);

        const card = document.createElement("div");
        card.classList.add("riesgo-card");

        card.innerHTML = `
            <h3>${d.fecha}</h3>
            <p><strong>Estrés térmico:</strong> ${estres}</p>
            <p><strong>Humedad:</strong> ${humedad}%</p>
        `;

        cont.appendChild(card);
    });
}


// ===============================
// ALERTAS
// ===============================

function generarAlertas(dia) {
    const alertas = [];

    const et0 = extraerNumero(dia.informacion[0]);
    const estres = extraerNumero(dia.informacion[1]);
    const humedad = extraerNumero(dia.informacion[2]);

    // ============================
    // ALERTAS INDIVIDUALES
    // ============================

    // ET0
    if (et0 < 0.2) {
        alertas.push({
            tipo: "et0",
            nivel: "bajo",
            prioridad: 4,
            color: "verde",
            icono: "🌿",
            mensaje: "ET0 muy baja → riego casi nulo."
        });
    } else if (et0 > 0.8) {
        alertas.push({
            tipo: "et0",
            nivel: "alto",
            prioridad: 2,
            color: "naranja",
            icono: "⚠️",
            mensaje: "ET0 alta → riesgo de deshidratación."
        });
    }

    // Estrés térmico
    if (estres > 110) {
        alertas.push({
            tipo: "estres",
            nivel: "critico",
            prioridad: 1,
            color: "rojo",
            icono: "🔥",
            mensaje: "Estrés térmico crítico → sombreo + ventilación urgente."
        });
    } else if (estres > 100) {
        alertas.push({
            tipo: "estres",
            nivel: "alto",
            prioridad: 2,
            color: "naranja",
            icono: "⚠️",
            mensaje: "Estrés térmico alto → aumentar ventilación."
        });
    }

    // Humedad
    if (humedad < 40) {
        alertas.push({
            tipo: "humedad",
            nivel: "medio",
            prioridad: 3,
            color: "amarillo",
            icono: "🌡️",
            mensaje: "Humedad baja → riesgo de deshidratación."
        });
    } else if (humedad > 90) {
        alertas.push({
            tipo: "humedad",
            nivel: "medio",
            prioridad: 3,
            color: "azul",
            icono: "💧",
            mensaje: "Humedad muy alta → riesgo de hongos."
        });
    }

    // ============================
    // ALERTAS COMBINADAS INTELIGENTES
    // ============================

    // ET0 baja + estrés alto
    if (et0 < 0.2 && estres > 100) {
        alertas.push({
            tipo: "combinada",
            nivel: "alto",
            prioridad: 1,
            color: "naranja",
            icono: "⚠️",
            mensaje: "ET0 baja + estrés térmico alto → ventilar antes de regar."
        });
    }

    // Humedad alta + estrés bajo
    if (humedad > 85 && estres < 90) {
        alertas.push({
            tipo: "combinada",
            nivel: "medio",
            prioridad: 3,
            color: "azul",
            icono: "💧",
            mensaje: "Humedad alta + poco estrés → riesgo de hongos."
        });
    }

    // ============================
    // ORDENAR POR PRIORIDAD
    // ============================
    alertas.sort((a, b) => a.prioridad - b.prioridad);

    return alertas;
}

function mostrarAlertas(alertas) {
    const cont = document.getElementById("alertas-container");
    cont.innerHTML = "";

    if (alertas.length === 0) {
        cont.innerHTML = "<p class='sin-alertas'>No hay alertas para hoy.</p>";
        return;
    }

    alertas.forEach(a => {
        const div = document.createElement("div");
        div.classList.add("alerta", `alerta-${a.color}`);

        div.innerHTML = `
            <span class="alerta-icono">${a.icono}</span>
            <strong>${a.mensaje}</strong>
        `;

        cont.appendChild(div);
    });
}


// ============================
// INFORME PDF MENSUAL (NUEVO)
// ============================

function alertaToTexto(alerta) {
    return `${alerta.icono} ${alerta.mensaje}`;
}

function normalizarDiario(diario) {
    if (!Array.isArray(diario)) {
        console.warn("normalizarDiario: diario no es un array", diario);
        return [];
    }

    return diario.map(d => {
        const obj = { ...d };

        // Si no existe d.informacion, evitar errores
        const info = Array.isArray(d.informacion) ? d.informacion : [];

        const et0 = info.find(x => x.includes("ET0"));
        const estres = info.find(x => x.includes("Estrés"));
        const humedad = info.find(x => x.includes("Humedad"));

        obj.et0 = et0 ? parseFloat(et0.split(":")[1]) : (d.et0 || 0);
        obj.estres_termico = estres ? parseFloat(estres.split(":")[1]) : (d.estres_termico || 0);
        obj.humedad = humedad ? parseFloat(humedad.split(":")[1]) : (d.humedad || 0);

        return obj;
    });
}




function generarInformePDF(data) {
    console.log("➡ generarInformePDF() llamada con data.diario:", data.diario);
    console.log("DATA.DIARIO REAL:", JSON.stringify(data.diario, null, 2));
    const cont = document.getElementById("informe-contenido");
    cont.innerHTML = "";
    const diarioNormalizado = normalizarDiario(JSON.parse(JSON.stringify(data.diario)));

    // Datos derivados reales
    const resumen = generarResumenEjecutivo({ ...data, diario: diarioNormalizado });
    const analisis = generarAnalisisClimatico({ ...data, diario: diarioNormalizado });
    const recs = generarRecomendacionesEstrategicas({ ...data, diario: diarioNormalizado });
    const riesgo = calcularRiesgoSemanal(diarioNormalizado);
    // Tendencias reales (mín, máx)
    const et0_vals = diarioNormalizado.map(d => d.et0 || 0);
    const estres_vals = diarioNormalizado.map(d => d.estres_termico || 0);
    const hum_vals = diarioNormalizado.map(d => d.humedad || 0);

    const safeMax = arr => arr.length ? Math.max(...arr) : 0;
    const safeMin = arr => arr.length ? Math.min(...arr) : 0;

    const et0_max = safeMax(et0_vals).toFixed(2);
    const et0_min = safeMin(et0_vals).toFixed(2);

    const estres_max = safeMax(estres_vals).toFixed(2);
    const estres_min = safeMin(estres_vals).toFixed(2);

    const hum_max = safeMax(hum_vals).toFixed(1);
    const hum_min = safeMin(hum_vals).toFixed(1);


    // Alertas únicas del mes
    const alertasMes = [...new Set(
        diarioNormalizado
            .flatMap(d => generarAlertas(d))
            .sort((a, b) => a.prioridad - b.prioridad)
            .map(a => alertaToTexto(a))
    )];


    cont.innerHTML = `
        <div class="informe-header">
            <div class="informe-titulo">📊 Informe Mensual Agronómico</div>
            <div class="informe-subtitulo">Generado automáticamente por el Dashboard Agronómico Inteligente</div>
        </div>

        <div class="informe-seccion">
            <h3>📝 Resumen Ejecutivo</h3>
            <p>${resumen}</p>
        </div>

        <div class="informe-grid">
            
            <div class="informe-columna">
                <div class="informe-seccion">
                    <h3>🌡️ Análisis del Mes</h3>
                    <p>
                        <strong>ET0:</strong> mín ${et0_min}, máx ${et0_max}.<br>
                        <strong>Estrés térmico:</strong> mín ${estres_min}, máx ${estres_max}.<br>
                        <strong>Humedad:</strong> mín ${hum_min}%, máx ${hum_max}%.
                    </p>
                </div>

                <div class="informe-seccion">
                    <h3>📈 Tendencias Climáticas</h3>
                    <p>
                        <strong>Humedad:</strong> ${analisis.humedad}<br>
                        <strong>Radiación:</strong> ${analisis.radiacion}<br>
                        <strong>Viento:</strong> ${analisis.viento}
                    </p>
                </div>

                <div class="informe-seccion indicador-riesgo-box">
                    <h3>🛡️ Riesgo Agronómico Acumulado</h3>
                    <p>El índice mensual de riesgo se estima en:</p>
                    <div class="valor-riesgo">${riesgo}%</div>
                </div>
            </div>

            <div class="informe-columna">
                ${data.resumen_mensual ? `
                <div class="informe-seccion">
                    <h3>📋 Resumen Mensual Real</h3>
                    <p>
                        ${data.resumen_mensual.informacion.map(l => `• ${l}<br>`).join("")}
                        <br>
                        <strong>Riesgo:</strong> ${data.resumen_mensual.nivel_riesgo}<br>
                        <strong>Recomendación:</strong> ${data.resumen_mensual.recomendacion_general}
                    </p>
                </div>
                ` : ""}

                <div class="informe-seccion">
                    <h3>💡 Recomendaciones Estratégicas</h3>
                    <p>
                        <strong>Estrés:</strong> ${recs.estres}<br>
                        <strong>Riego:</strong> ${recs.riego}<br>
                        <strong>Ventilación:</strong> ${recs.ventilacion}<br>
                        <strong>Manejo:</strong> ${recs.manejo}
                    </p>
                </div>
            </div>

        </div>

        <div class="informe-seccion alertas-caja">
            <h3>⚠️ Alertas Relevantes del Mes</h3>
            <p style="margin: 0;">
                ${alertasMes.length ? alertasMes.map(a => `• ${a}<br>`).join("") : "No se registraron alertas críticas durante este período."}
            </p>
        </div>
    `;
}


document.addEventListener("click", e => {
    // Log 1: Ver si el navegador detecta CUALQUIER click en la pantalla
    console.log("🖱️ Click detectado en un elemento con ID:", e.target.id);

    if (e.target.id === "btn-descargar-pdf") {
        console.log("✅ ¡Confirmado! Has pulsado el botón del PDF.");

        const element = document.getElementById("informe-contenido");
        
        // Log 2: Comprobar si el contenedor del informe existe
        console.log("📦 Elemento contenedor obtenido:", element);

        if (!element) {
            console.error("❌ ERROR: No se encuentra ningún elemento con el ID 'informe-contenido' en el HTML.");
            return;
        }

        // Log 3: Ver qué texto o HTML tiene dentro el informe
        console.log("📝 Contenido actual del informe (HTML):", element.innerHTML.trim());

        if (element.innerHTML.trim() === "") {
            console.warn("⚠️ ADVERTENCIA: El informe está vacío.html2pdf no se ejecutará porque no hay nada que pintar.");
            alert("Primero debes generar el informe antes de descargarlo.");
            return;
        }

        // Log 4: Comprobar si la librería externa html2pdf está cargada en memoria
        console.log("📚 ¿La librería html2pdf existe en la página?:", typeof html2pdf !== 'undefined' ? "SÍ, CARGADA" : "NO EXISTE (Mala importación)");

        if (typeof html2pdf === 'undefined') {
            console.error("❌ ERROR CRÍTICO: html2pdf no está definida. Revisa si pusiste la etiqueta <script> en tu HTML.");
            alert("Error del sistema: Falta la librería de PDF.");
            return;
        }

        const options = {
            margin: 8, // Reducimos ligeramente el margen (de 10mm a 8mm) para ganar espacio
            filename: "informe_mensual.pdf",
            image: { type: "jpeg", quality: 0.98 },
            
            // 1. html2canvas: Bajamos la escala a 1.5 o 1.2 si tu contenido es muy largo.
            // Esto hace que el texto "encoja" de tamaño de forma uniforme.
            html2canvas: { 
                scale: 1.5, 
                useCORS: true,
                scrollX: 0,
                scrollY: 0
            },
            
            // 2. jsPDF: Mantenemos el formato A4 estándar
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
            
            // 3. Modificamos el pagebreak para que sea ultra estricto
            pagebreak: { mode: 'avoid-all' }
        };

        console.log("🚀 Lanzando html2pdf().set().from().save()...");
        
        try {
            html2pdf().set(options).from(element).save();
            console.log("🏁 Comando de guardado ejecutado sin crasear.");
        } catch (err) {
            console.error("❌ ERROR en la ejecución interna de html2pdf:", err);
        }
    }
});


function calcularResumenMensual(data) {
    const dias = data.diario.length;

    const mediaET0 = (
        data.diario.reduce((acc, d) => acc + extraerNumero(d.informacion[0]), 0) / dias
    ).toFixed(2);

    const mediaEstres = (
        data.diario.reduce((acc, d) => acc + extraerNumero(d.informacion[1]), 0) / dias
    ).toFixed(2);

    const mediaHumedad = (
        data.diario.reduce((acc, d) => acc + extraerNumero(d.informacion[2]), 0) / dias
    ).toFixed(2);

    return `
        Durante este mes se registró una ET0 media de ${mediaET0}, un estrés térmico medio de ${mediaEstres} y una humedad promedio del ${mediaHumedad}%. 
        Las condiciones generales indican ${mediaEstres > 100 ? "altos niveles de estrés térmico" : "condiciones moderadas"}.
    `;
}


function generarAnalisisClimatico(data) {
    const diario = data.diario;

    const hums = diario.map(d => d.humedad).filter(v => v !== undefined);
    const temps = diario.map(d => d.temperatura).filter(v => v !== undefined);
    const rads = diario.map(d => d.radiacion).filter(v => v !== undefined);
    const vientos = diario.map(d => d.viento).filter(v => v !== undefined);

    function analizar(lista, nombre) {
        if (!lista.length) return `No hay datos suficientes de ${nombre}.`;

        const media = (lista.reduce((a,b) => a+b, 0) / lista.length).toFixed(1);
        const min = Math.min(...lista);
        const max = Math.max(...lista);

        let tendencia = "";
        if (lista[0] < lista[lista.length-1]) tendencia = "tendencia ascendente";
        else if (lista[0] > lista[lista.length-1]) tendencia = "tendencia descendente";
        else tendencia = "sin cambios significativos";

        return `Media: ${media}. Mín: ${min}. Máx: ${max}. Presenta ${tendencia}.`;
    }

    return {
        temperatura: analizar(temps, "temperatura"),
        humedad: analizar(hums, "humedad"),
        radiacion: analizar(rads, "radiación"),
        viento: analizar(vientos, "viento")
    };
}


function generarRecomendacionesEstrategicas(data) {
    const diario = data.diario;

    const et0 = diario.map(d => d.et0 || 0);
    const estres = diario.map(d => d.estres_termico || 0);
    const humedad = diario.map(d => d.humedad || 0);

    const et0_media = (et0.reduce((a,b)=>a+b,0) / et0.length).toFixed(2);
    const estres_media = (estres.reduce((a,b)=>a+b,0) / estres.length).toFixed(2);
    const humedad_media = (humedad.reduce((a,b)=>a+b,0) / humedad.length).toFixed(1);

    // Estrés térmico
    let rec_estres = "";
    if (estres_media > 180) rec_estres = "Estrés térmico muy alto → sombreo + ventilación obligatoria.";
    else if (estres_media > 120) rec_estres = "Estrés térmico elevado → aumentar ventilación.";
    else rec_estres = "Estrés térmico moderado → vigilancia normal.";

    // Riego
    let rec_riego = "";
    if (et0_media < 0.5) rec_riego = "ET0 baja → riego ligero o nulo.";
    else if (et0_media < 1.5) rec_riego = "ET0 moderada → riego medio.";
    else rec_riego = "ET0 alta → riego intensivo.";

    // Ventilación
    let rec_vent = "";
    if (estres_media > 150) rec_vent = "Ventilación cruzada recomendada durante todo el día.";
    else rec_vent = "Ventilación moderada según condiciones.";

    // Manejo general
    let rec_manejo = "";
    if (humedad_media < 50) rec_manejo = "Ambiente seco → vigilar deshidratación foliar.";
    else rec_manejo = "Humedad adecuada → manejo estándar.";

    return {
        estres: rec_estres,
        riego: rec_riego,
        ventilacion: rec_vent,
        manejo: rec_manejo
    };
}


function generarResumenEjecutivo(data) {
    const diario = data.diario;

    const et0 = diario.map(d => d.et0 || 0);
    const estres = diario.map(d => d.estres_termico || 0);
    const humedad = diario.map(d => d.humedad || 0);

    const et0_media = (et0.reduce((a,b)=>a+b,0) / et0.length).toFixed(2);
    const estres_media = (estres.reduce((a,b)=>a+b,0) / estres.length).toFixed(2);
    const humedad_media = (humedad.reduce((a,b)=>a+b,0) / humedad.length).toFixed(1);

    let conclusion = "";
    if (estres_media > 180) conclusion = "altos niveles de estrés térmico.";
    else if (estres_media > 120) conclusion = "estrés térmico moderado.";
    else conclusion = "condiciones térmicas estables.";

    return `
        Durante este mes se registró una ET0 media de <strong>${et0_media}</strong>,
        un estrés térmico medio de <strong>${estres_media}</strong> y una humedad promedio del
        <strong>${humedad_media}%</strong>. En conjunto, el cultivo estuvo expuesto a
        <strong>${conclusion}</strong>
    `;
}


async function cargarInformeMensual() {
    const res = await fetch("http://localhost:8000/recomendaciones?dias=30");
    const json = await res.json();

    const data = {
        diario: json.diario,
        resumen_mensual: json.resumen_mensual
    };


    generarInformePDF(data);
}


document.querySelector('button[data-section="informe"]').addEventListener("click", async () => {
    mostrarVista("informe");

    // Esperar a que la vista sea visible
    await new Promise(r => setTimeout(r, 50));

    cargarInformeMensual();
});