from fastapi import FastAPI
import pandas as pd
import mysql.connector
from datetime import datetime, timedelta
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
import numpy as np
import requests  # Lo dejo por si lo usas en otro sitio

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permite Live Server, localhost, IPs, etc.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
#   CONEXIÓN A BASE DE DATOS
# ---------------------------------------------------------
def conectar():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="Valentin.09",
        database="clima",
        port=3307
    )


# ---------------------------------------------------------
#   HOME
# ---------------------------------------------------------
@app.get("/")
def home():
    return {"mensaje": "API de predicción futura funcionando"}


# ---------------------------------------------------------
#   PREDICCIÓN FUTURA
# ---------------------------------------------------------
@app.get("/prediccion")
def prediccion(dias: int = 7):

    conn = conectar()
    cur = conn.cursor(dictionary=True)

    query = """
        SELECT t1.*
        FROM clima_diario t1
        INNER JOIN (
            SELECT fecha
            FROM clima_diario
            GROUP BY fecha
            ORDER BY fecha DESC
            LIMIT 14
        ) t2 ON t1.fecha = t2.fecha
        ORDER BY t1.fecha ASC;
    """

    cur.execute(query)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    if not rows:
        return {"error": "No hay datos en clima_diario"}

    df = pd.DataFrame(rows)
    df["fecha"] = pd.to_datetime(df["fecha"])
    df = df.sort_values("fecha")

    df["t"] = (df["fecha"] - df["fecha"].min()).dt.days

    variables = [
        "et0_diaria",
        "radiacion_diaria",
        "temperatura_media",
        "humedad_media",
        "viento_medio",
        "precipitacion_diaria",
        "estres_termico_medio"
    ]

    modelos = {}

    for var in variables:
        y = df[var].values
        X = df["t"].values.reshape(-1, 1)

        modelo_lr = LinearRegression()
        modelo_lr.fit(X, y)

        modelo_rf = RandomForestRegressor(n_estimators=200, random_state=42)
        modelo_rf.fit(X, y)

        modelos[var] = {
            "lr": modelo_lr,
            "rf": modelo_rf
        }

    hoy = df["fecha"].max().date()
    ultimo_t = df["t"].max()

    predicciones = []

    for i in range(1, dias + 1):
        t_futuro = ultimo_t + i
        fecha_futura = hoy + timedelta(days=i)

        pred = {"fecha": fecha_futura.isoformat()}

        for var in variables:

            pred_lr = modelos[var]["lr"].predict(np.array([[t_futuro]]))[0]
            pred_rf = modelos[var]["rf"].predict(np.array([[t_futuro]]))[0]
            valor = (pred_lr + pred_rf) / 2

            if var in ["et0_diaria", "radiacion_diaria", "precipitacion_diaria"]:
                valor = max(valor, 0)

            if predicciones:
                valor = 0.7 * valor + 0.3 * predicciones[-1][var]

            pred[var] = float(round(valor, 3))

        predicciones.append(pred)

    return predicciones


# ---------------------------------------------------------
#   FUNCIÓN INTERNA: RESUMEN MENSUAL REAL
#   (MISMA LÓGICA QUE TENÍAS, SOLO EXTRAÍDA)
# ---------------------------------------------------------
def calcular_resumen_mensual():
    conn = conectar()
    cur = conn.cursor(dictionary=True)

    cur.execute("SELECT MAX(fecha) AS max_fecha FROM clima_diario;")
    row = cur.fetchone()
    if row and row["max_fecha"]:
        fecha_max = row["max_fecha"]
        fecha_inicio = fecha_max - timedelta(days=30)

        query_mes = """
            SELECT fecha, et0_diaria, estres_termico_medio, humedad_media, precipitacion_diaria
            FROM clima_diario
            WHERE fecha BETWEEN %s AND %s
            ORDER BY fecha ASC;
        """
        cur.execute(query_mes, (fecha_inicio, fecha_max))
        datos_mes = cur.fetchall()
    else:
        datos_mes = []
        fecha_max = None
        fecha_inicio = None

    cur.close()
    conn.close()

    if datos_mes:
        et0_m = [d["et0_diaria"] for d in datos_mes]
        estres_m = [d["estres_termico_medio"] for d in datos_mes]
        humedad_m = [d["humedad_media"] for d in datos_mes]
        lluvia_m = [d["precipitacion_diaria"] for d in datos_mes]

        tendencia_et0_m = "sube" if et0_m[-1] > et0_m[0] else "baja"
        tendencia_estres_m = "sube" if estres_m[-1] > estres_m[0] else "baja"
        tendencia_humedad_m = "sube" if humedad_m[-1] > humedad_m[0] else "baja"

        lluvia_total = round(sum(lluvia_m), 2)

        diagnostico_mensual = [
            f"📅 Periodo mensual: {fecha_inicio.isoformat()} → {fecha_max.isoformat()}",
            f"📉 ET0 mensual: {tendencia_et0_m}",
            f"📈 Estrés térmico mensual: {tendencia_estres_m}",
            f"💧 Humedad mensual: {tendencia_humedad_m}",
            f"🌧️ Lluvia acumulada: {lluvia_total} mm"
        ]

        if lluvia_total > 40:
            riesgo_mensual = "🔴 Riesgo alto por exceso de humedad."
            accion_mensual = "Prioridad: control de hongos y ventilación."
        elif estres_m[-1] > 110:
            riesgo_mensual = "🔴 Riesgo alto por estrés térmico."
            accion_mensual = "Prioridad: sombreo y ventilación."
        elif tendencia_et0_m == "baja":
            riesgo_mensual = "🟢 Riesgo bajo por ET0 descendente."
            accion_mensual = "Prioridad: ahorro de agua."
        elif tendencia_humedad_m == "sube":
            riesgo_mensual = "🟠 Riesgo moderado por humedad creciente."
            accion_mensual = "Prioridad: mejorar ventilación."
        else:
            riesgo_mensual = "🟡 Mes estable sin riesgos críticos."
            accion_mensual = "Mantener estrategia general."

        resumen_mensual = {
            "informacion": diagnostico_mensual,
            "nivel_riesgo": riesgo_mensual,
            "recomendacion_general": accion_mensual
        }

    else:
        resumen_mensual = {
            "informacion": ["📅 No hay datos suficientes para el último mes."],
            "nivel_riesgo": "ℹ️ Sin datos.",
            "recomendacion_general": "Pendiente de acumular datos mensuales."
        }

    return resumen_mensual


# ---------------------------------------------------------
#   API DE RECOMENDACIONES
# ---------------------------------------------------------
@app.get("/recomendaciones")
def recomendaciones(dias: int = 7):

    # Antes llamabas por HTTP a tu propia API.
    # Ahora llamamos directamente a la función prediccion(dias),
    # manteniendo EXACTAMENTE el mismo resultado.
    try:
        pred = prediccion(dias)
    except Exception as e:
        return {"error": f"Error interno al obtener predicciones: {str(e)}"}

    if not isinstance(pred, list):
        return {"error": "No se pudieron obtener predicciones válidas."}

    salida = []

    # ---------- CAPA DIARIA (igual que ahora, con iconos) ----------
    for i, dia in enumerate(pred):
        fecha = dia["fecha"]

        info = []
        recs = []

        et0 = dia["et0_diaria"]
        estres = dia["estres_termico_medio"]
        humedad = dia["humedad_media"]
        viento = dia["viento_medio"]
        radiacion = dia["radiacion_diaria"]
        lluvia = dia["precipitacion_diaria"]

        prev = pred[i - 1] if i > 0 else None

        # INFORMACIÓN
        info.append(f"🟢 ET0 actual: {round(et0, 2)}")
        info.append(f"🟠 Estrés térmico: {round(estres, 2)}")
        info.append(f"💧 Humedad: {round(humedad, 2)}%")

        if prev:
            if et0 > prev["et0_diaria"] * 1.10:
                info.append("⬆️ ET0 subiendo respecto a ayer.")
            elif et0 < prev["et0_diaria"] * 0.90:
                info.append("⬇️ ET0 bajando respecto a ayer.")

            if humedad > prev["humedad_media"] * 1.10:
                info.append("⬆️ Humedad en aumento.")
            elif humedad < prev["humedad_media"] * 0.90:
                info.append("⬇️ Humedad en descenso.")

        info = info[:3]

        # RECOMENDACIONES
        if et0 > 4:
            recs.append("🔴 ET0 muy alta → aumentar riego.")
        elif et0 > 2:
            recs.append("🟠 ET0 moderada → riego medio.")
        else:
            recs.append("🟢 ET0 baja → riego ligero o nulo.")

        if estres > 110:
            recs.append("🔴 Estrés térmico crítico → sombreo + ventilación obligatoria.")
        elif estres > 95:
            recs.append("🟠 Estrés térmico alto → aumentar ventilación.")

        if estres > 95 and et0 < 2:
            recs.append("🟣 Estrés térmico alto + ET0 baja → priorizar ventilación sobre riego.")

        if humedad > 90:
            recs.append("🔴 Humedad extrema → riesgo alto de hongos.")
        elif humedad > 85:
            recs.append("🟠 Humedad elevada → vigilar botrytis.")

        if lluvia > 3:
            recs.append("🔵 Lluvia prevista → reducir riego.")
        elif lluvia > 0.5:
            recs.append("🔵 Lluvia ligera → ajustar riego.")

        recs = recs[:3]

        salida.append({
            "fecha": fecha,
            "informacion": info,
            "recomendaciones": recs
        })

    # ---------- RESUMEN SEMANAL (igual que tenías) ----------
    et0_vals = [d["et0_diaria"] for d in pred]
    estres_vals = [d["estres_termico_medio"] for d in pred]
    humedad_vals = [d["humedad_media"] for d in pred]

    tendencia_et0 = "sube" if et0_vals[-1] > et0_vals[0] else "baja"
    tendencia_estres = "sube" if estres_vals[-1] > estres_vals[0] else "baja"
    tendencia_humedad = "sube" if humedad_vals[-1] > humedad_vals[0] else "baja"

    diagnostico = [
        f"📉 ET0 semanal: {tendencia_et0}",
        f"📈 Estrés térmico semanal: {tendencia_estres}",
        f"💧 Humedad semanal: {tendencia_humedad}"
    ]

    if tendencia_estres == "sube" and estres_vals[-1] > 95:
        riesgo = "🔴 Riesgo alto por estrés térmico creciente."
        accion = "Revisar ventilación estructural y sombreo."
    elif tendencia_et0 == "baja":
        riesgo = "🟢 Riesgo bajo por ET0 descendente."
        accion = "Posible ahorro de agua esta semana."
    elif tendencia_humedad == "sube" and humedad_vals[-1] > 85:
        riesgo = "🟠 Riesgo moderado por humedad elevada."
        accion = "Vigilar hongos y mejorar ventilación."
    else:
        riesgo = "🟡 Semana estable sin riesgos significativos."
        accion = "Mantener estrategia actual."

    resumen_semanal = {
        "informacion": diagnostico,
        "nivel_riesgo": riesgo,
        "recomendacion_general": accion
    }

    # ---------- RESUMEN MENSUAL REAL (misma lógica, función interna) ----------
    resumen_mensual = calcular_resumen_mensual()

    return {
        "diario": salida,
        "resumen_semanal": resumen_semanal,
        "resumen_mensual": resumen_mensual
    }


# ---------------------------------------------------------
#   ALERTAS REALES + PREDICCIÓN FUTURA + COMBINADAS
# ---------------------------------------------------------
@app.get("/alertas")
def alertas():

    alertas_reales = []
    alertas_pred = []
    alertas_combinadas = []

    # -----------------------------
    # 1) DATOS REALES (últimos 7 días)
    # -----------------------------
    conn = conectar()
    cur = conn.cursor(dictionary=True)

    cur.execute("""
        SELECT fecha, et0_diaria, estres_termico_medio, humedad_media,
               radiacion_diaria, viento_medio, precipitacion_diaria
        FROM clima_diario
        ORDER BY fecha DESC
        LIMIT 7;
    """)
    reales = cur.fetchall()

    cur.close()
    conn.close()

    reales = reales[::-1]  # Orden ascendente

    for d in reales:
        fecha = d["fecha"]
        et0 = d["et0_diaria"]
        estres = d["estres_termico_medio"]
        humedad = d["humedad_media"]
        viento = d["viento_medio"]
        radiacion = d["radiacion_diaria"]
        lluvia = d["precipitacion_diaria"]

        if estres > 110:
            alertas_reales.append(f"🔴 [{fecha}] Estrés térmico crítico.")
        elif estres > 95:
            alertas_reales.append(f"🟠 [{fecha}] Estrés térmico alto.")

        if humedad > 90:
            alertas_reales.append(f"🔴 [{fecha}] Humedad extrema → riesgo de hongos.")
        elif humedad > 85:
            alertas_reales.append(f"🟠 [{fecha}] Humedad elevada.")

        if radiacion > 7500:
            alertas_reales.append(f"🔴 [{fecha}] Radiación muy alta.")

        if viento > 30:
            alertas_reales.append(f"🔴 [{fecha}] Viento muy fuerte.")

        if lluvia > 3:
            alertas_reales.append(f"🟠 [{fecha}] Lluvia intensa.")

    estres_vals = [d["estres_termico_medio"] for d in reales]
    if sum(1 for x in estres_vals if x > 95) >= 3:
        alertas_reales.append("🔴 Riesgo acumulado: 3 días seguidos con estrés térmico alto.")

    # -----------------------------
    # 2) ALERTAS DE PREDICCIÓN (futuro)
    # -----------------------------
    try:
        pred = prediccion(7)  # Antes: petición HTTP; ahora: llamada directa
    except Exception:
        pred = []

    for d in pred:
        fecha = d["fecha"]
        et0 = d["et0_diaria"]
        estres = d["estres_termico_medio"]
        humedad = d["humedad_media"]
        radiacion = d["radiacion_diaria"]
        lluvia = d["precipitacion_diaria"]

        if estres > 110:
            alertas_pred.append(f"🔮🔴 [{fecha}] Estrés térmico crítico previsto.")
        elif estres > 95:
            alertas_pred.append(f"🔮🟠 [{fecha}] Estrés térmico alto previsto.")

        if et0 > 4:
            alertas_pred.append(f"🔮🟠 [{fecha}] ET0 alta prevista.")

        if humedad > 90:
            alertas_pred.append(f"🔮🟠 [{fecha}] Humedad muy alta prevista.")

        if radiacion > 7500:
            alertas_pred.append(f"🔮🟡 [{fecha}] Radiación muy alta prevista.")

        if lluvia > 3:
            alertas_pred.append(f"🔮🟡 [{fecha}] Lluvia intensa prevista.")

    # -----------------------------
    # 3) ALERTAS COMBINADAS
    # -----------------------------
    if reales and pred:
        if reales[-1]["estres_termico_medio"] > 95 and pred[0]["estres_termico_medio"] > reales[-1]["estres_termico_medio"]:
            alertas_combinadas.append("🔴🔮 Estrés térmico alto ahora + tendencia futura al alza.")

        if reales[-1]["humedad_media"] > 85 and reales[-1]["radiacion_diaria"] < 2500:
            alertas_combinadas.append("🟣 Riesgo de botrytis: humedad alta + baja radiación.")

        if reales[-1]["viento_medio"] > 20 and reales[-1]["radiacion_diaria"] > 6500:
            alertas_combinadas.append("🟣 Riesgo de quemaduras: viento + radiación alta.")

    # -----------------------------
    # 4) RIESGO ACUMULADO AVANZADO
    # -----------------------------
    riesgo_acumulado_real = []
    riesgo_acumulado_pred = []
    riesgo_acumulado_comb = []

    if sum(1 for d in reales if d["estres_termico_medio"] > 95) >= 4:
        riesgo_acumulado_real.append("🔥 Estrés térmico alto repetido en varios días → riesgo severo.")

    if sum(1 for d in reales if d["humedad_media"] > 85 and d["radiacion_diaria"] < 2500) >= 3:
        riesgo_acumulado_real.append("🔥 Riesgo de botrytis: humedad alta + baja radiación repetida.")

    lluvia_real_total = sum(d["precipitacion_diaria"] for d in reales)
    if lluvia_real_total > 40:
        riesgo_acumulado_real.append(f"🔥 Lluvia acumulada alta ({round(lluvia_real_total, 1)} mm) → riesgo de hongos.")

    if sum(1 for d in pred if d["estres_termico_medio"] > 95) >= 4:
        riesgo_acumulado_pred.append("🔮🔥 Estrés térmico alto previsto varios días seguidos.")

    if sum(1 for d in pred if d["precipitacion_diaria"] > 2) >= 3:
        riesgo_acumulado_pred.append("🔮🔥 Lluvia prevista varios días → riesgo de hongos.")

    if sum(1 for d in pred if d["et0_diaria"] > 4) >= 3:
        riesgo_acumulado_pred.append("🔮🔥 ET0 alta prevista varios días → riesgo de estrés hídrico.")

    if reales and pred:
        if reales[-1]["estres_termico_medio"] > 95 and pred[0]["estres_termico_medio"] > reales[-1]["estres_termico_medio"]:
            riesgo_acumulado_comb.append("🟣🔥 Estrés térmico alto ahora + seguirá subiendo → riesgo severo.")

        if reales[-1]["humedad_media"] > 85 and sum(1 for d in pred if d["precipitacion_diaria"] > 2) >= 2:
            riesgo_acumulado_comb.append("🟣🔥 Humedad alta ahora + lluvia futura → riesgo de hongos.")

        if reales[-1]["radiacion_diaria"] > 6500 and sum(1 for d in pred if d["viento_medio"] > 20) >= 2:
            riesgo_acumulado_comb.append("🟣🔥 Radiación alta ahora + viento futuro → riesgo de quemaduras.")

    return {
        "alertas_reales": alertas_reales,
        "alertas_prediccion": alertas_pred,
        "alertas_combinadas": alertas_combinadas,
        "riesgo_acumulado": {
            "real": riesgo_acumulado_real,
            "prediccion": riesgo_acumulado_pred,
            "combinado": riesgo_acumulado_comb
        }
    }

import os
import signal

@app.post("/apagar")
def apagar():
    os.kill(os.getpid(), signal.SIGTERM)
    return {"mensaje": "API apagada"}


@app.get("/actual")
def actual():

    try:
        df = pd.read_csv("C:/ProyectoIA/datos/openmeteo_realtime.csv")
    except Exception as e:
        return {"error": f"No se pudo leer el realtime: {str(e)}"}

    if df.empty:
        return {"error": "El archivo realtime está vacío"}

    row = df.iloc[-1]

    salida = {
        "timestamp": str(row["timestamp"]),
        "et0_actual": float(row["et0_fao_evapotranspiration"]),
        "temperatura": float(row["temperature_2m"]),
        "humedad": float(row["relative_humidity_2m"]),
        "radiacion": float(row["shortwave_radiation"]),
        "viento": float(row["wind_speed_10m"]),
        "direccion_viento": float(row["wind_direction_10m"]),
        "presion": float(row["pressure_msl"]),
        "nubes": float(row["cloud_cover"]),
        "precipitacion": float(row["precipitation"])
    }

    salida["estres_termico"] = round(
        row["temperature_2m"] * (1 - row["relative_humidity_2m"] / 100), 2
    )

    return salida
