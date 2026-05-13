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
        humedad: "💧"
    };

    card.innerHTML = `
        <div class="card-title">
            <span class="card-icon">${iconos[tipo]}</span>
            ${titulo}
        </div>
        <div class="card-value">${valor}</div>
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
    const data = await getRecomendaciones();

    console.log(data);
    console.log(data.diario);
    // ===============================
    // TARJETAS RESUMEN
    // ===============================
    const cards = document.getElementById("cards-container");
    cards.innerHTML = ""; // limpiamos

    cards.appendChild(crearTarjeta("ET0 actual", limpiarValor(data.diario[0].informacion[0]), "et0"));
    cards.appendChild(crearTarjeta("Estrés térmico", limpiarValor(data.diario[0].informacion[1]), "estres"));
    cards.appendChild(crearTarjeta("Humedad", limpiarValor(data.diario[0].informacion[2]) + "%", "humedad"));

    
    mostrarRecomendaciones(data.diario[0]);

    const alertasHoy = generarAlertas(data.diario[0]);
    mostrarAlertas(alertasHoy);

    mostrarRiesgo(data.diario);

    generarInformePDF(data);


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

        return { icono, cuerpo, color, prioridad };
    });

    // Ordenar por prioridad
    procesadas.sort((a, b) => a.prioridad - b.prioridad);

    // Pintar tarjetas
    procesadas.forEach(r => {
        const card = document.createElement("div");
        card.classList.add("recomendacion-card", `rec-${r.color}`);

        card.innerHTML = `
            <span class="recomendacion-icono">${r.icono}</span>
            <p class="recomendacion-texto">${r.cuerpo}</p>
        `;

        cont.appendChild(card);
    });
}



// ===============================
// RIESGO SEMANAL (NUEVO)
// ===============================

function calcularRiesgoSemanal(diario) {
    let acumulado = 0;

    diario.forEach(d => {
        const estres = extraerNumero(d.informacion[1]);
        const humedad = extraerNumero(d.informacion[2]);

        // Fórmula temporal (luego la afinamos con backend real)
        const riesgoDia = (estres / 120) * 0.7 + (humedad > 85 ? 0.3 : 0);
        acumulado += riesgoDia;
    });

    // Normalizamos a 0–100
    return Math.min(100, Math.round(acumulado * 10));
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
// ALAERTAS
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

function generarInformePDF(data) {
    const cont = document.getElementById("informe-contenido");
    cont.innerHTML = "";

    const resumen = calcularResumenMensual(data);
    const riesgo = calcularRiesgoSemanal(data.diario); // luego lo adaptamos a mensual

    cont.innerHTML = `
        <h1 class="informe-titulo">Informe Mensual Agronómico</h1>
        <p class="informe-subtitulo">Generado automáticamente por el Dashboard Agronómico Inteligente</p>

        <div class="informe-seccion">
            <h3>Resumen Ejecutivo</h3>
            <p>${resumen}</p>
        </div>

        <div class="informe-seccion">
            <h3>Riesgo Acumulado del Mes</h3>
            <p>El riesgo acumulado estimado es del <strong>${riesgo}%</strong>.</p>
        </div>

        <div class="informe-seccion">
            <h3>Recomendaciones del Mes</h3>
            <ul>
                ${data.diario.flatMap(d => d.recomendaciones).map(r => `<li>${r}</li>`).join("")}
            </ul>
        </div>

        <div class="informe-seccion">
            <h3>Alertas del Mes</h3>
            <ul>
                ${
                    [...new Set(
                        data.diario
                            .flatMap(d => generarAlertas(d))          // todas las alertas del mes
                            .sort((a, b) => a.prioridad - b.prioridad) // orden por prioridad
                            .map(a => alertaToTexto(a))                // convertir a texto
                    )]
                    .map(a => `<li>${a}</li>`)
                    .join("")
                }
            </ul>
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
