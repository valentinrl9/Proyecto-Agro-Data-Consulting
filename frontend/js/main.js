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
    const pred = await getRecomendaciones();
    window.DATA_GRAFICAS = pred.diario;
    cargarGraficas(pred);

    
    // IA avanzada
    const estresHoy = parseFloat(pred.diario[0].informacion[1]);
    const estresManana = parseFloat(pred.diario[1].informacion[1]);

    document.getElementById("ia-prediccion").innerText =
        estresManana > estresHoy
            ? "La IA prevé un aumento del estrés térmico mañana."
            : "La IA anticipa un descenso del estrés térmico mañana.";

    const humedadHoy = parseFloat(pred.diario[0].informacion[2]);
    const humedadManana = parseFloat(pred.diario[1].informacion[2]);

    document.getElementById("ia-tendencia").innerText =
        humedadManana > humedadHoy
            ? "La humedad muestra una tendencia al alza."
            : "La humedad está descendiendo según la IA.";

    const riesgoAcumulado = Math.round(
        pred.diario.reduce((acc, d) => acc + (parseFloat(d.riesgo) || 0), 0)
    );

    document.getElementById("ia-analisis").innerText =
        "La IA detecta un riesgo acumulado de " +
        riesgoAcumulado +
        " puntos esta semana.";

    // Resto del dashboard
    mostrarRecomendaciones(pred.diario[0]);
    const alertasHoy = generarAlertas(pred.diario[0]);
    mostrarAlertas(alertasHoy);
    mostrarRiesgo(pred.diario);
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


// console.log(data);
// console.log(data.diario);


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


    // INFORME PROFESIONAL
    cont.innerHTML = `
        <div class="informe-logo">
            <img src="assets/logos/LogoV.png" alt="Logo" />
        </div>

        <div class="informe-titulo">Informe Mensual Agronómico</div>
        <div class="informe-subtitulo">Generado automáticamente por el Dashboard Agronómico Inteligente</div>

        <!-- ===========================
             RESUMEN EJECUTIVO
        ============================ -->
        <div class="informe-seccion">
            <h3>Resumen Ejecutivo</h3>
            <p>${resumen}</p>
        </div>

        <!-- ===========================
             ANÁLISIS DEL MES (solo datos reales)
        ============================ -->
        <div class="informe-seccion">
            <h3>Análisis del Mes</h3>
            <p>
                <strong>ET0:</strong> mínima ${et0_min}, máxima ${et0_max}.<br>
                <strong>Estrés térmico:</strong> mínimo ${estres_min}, máximo ${estres_max}.<br>
                <strong>Humedad:</strong> mínima ${hum_min}%, máxima ${hum_max}%.
            </p>
        </div>

        <!-- ===========================
             ANÁLISIS CLIMÁTICO DERIVADO
        ============================ -->
        <div class="informe-seccion">
            <h3>Tendencias Climáticas</h3>
            <p>
                <strong>Temperatura:</strong> ${analisis.temperatura}<br>
                <strong>Humedad:</strong> ${analisis.humedad}<br>
                <strong>Radiación:</strong> ${analisis.radiacion}<br>
                <strong>Viento:</strong> ${analisis.viento}
            </p>
        </div>

        <!-- ===========================
             RIESGO AGRONÓMICO
        ============================ -->
        <div class="informe-seccion">
            <h3>Riesgo Agronómico Acumulado</h3>
            <p>
                El índice mensual de riesgo se estima en:
                <br><br>
                <strong style="font-size: 20px; color: #22c55e;">${riesgo}%</strong>
            </p>
        </div>

        <!-- ===========================
             RESUMEN MENSUAL REAL (BACKEND)
        ============================ -->
        ${data.resumen_mensual ? `
        <div class="informe-seccion">
            <h3>Resumen Mensual Real</h3>
            <p>
                ${data.resumen_mensual.informacion.map(l => `${l}<br>`).join("")}
                <br>
                <strong>Riesgo mensual:</strong> ${data.resumen_mensual.nivel_riesgo}<br>
                <strong>Recomendación general:</strong> ${data.resumen_mensual.recomendacion_general}
            </p>
        </div>
        ` : ""}

        
        <!-- ===========================
             RECOMENDACIONES
        ============================ -->
        <div class="informe-seccion">
            <h3>Recomendaciones Estratégicas del Mes</h3>
            <p>
                <strong>Estrés térmico:</strong> ${recs.estres}<br>
                <strong>Riego:</strong> ${recs.riego}<br>
                <strong>Ventilación:</strong> ${recs.ventilacion}<br>
                <strong>Manejo general:</strong> ${recs.manejo}
            </p>
        </div>

        <!-- ===========================
             ALERTAS
        ============================ -->
        <div class="informe-seccion">
            <h3>Alertas Relevantes del Mes</h3>
            <p>
                ${alertasMes.map(a => `• ${a}<br>`).join("")}
            </p>
        </div>
    `;
}


document.getElementById("btn-descargar-pdf").addEventListener("click", () => {
    const element = document.getElementById("informe-contenido");

    const options = {
        margin: 0.5,
        filename: "informe_mensual.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" }
    };

    html2pdf().set(options).from(element).save();
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
    const temps = [];
    const rads = [];
    const vientos = [];

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