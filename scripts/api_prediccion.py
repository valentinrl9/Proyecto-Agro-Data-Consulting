from fastapi import FastAPI
import json
import pandas as pd
from datetime import datetime, timedelta
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
import numpy as np

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from config import DATASET_FINAL_CSV, ETL_INTERVAL_SECONDS, ETL_LAST_RUN_JSON, LAT, LON, REALTIME_CSV, ROOT
from db import conectar
from openmeteo_transform import calc_estres_termico


def _metricas_desde_mysql(fecha) -> dict | None:
    try:
        conn = conectar()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            """
            SELECT et0_diaria, estres_termico_medio, humedad_media
            FROM clima_diario
            WHERE fecha = %s
            """,
            (fecha,),
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
        if not row:
            return None
        return {
            "et0_dia": round(float(row["et0_diaria"]), 2),
            "estres_termico": round(float(row["estres_termico_medio"]), 2),
            "humedad_media": round(float(row["humedad_media"]), 1),
            "et0_parcial": False,
            "fuente": "mysql",
        }
    except Exception:
        return None


def _metricas_dia(ts) -> dict | None:
    """Agregados del día actual (misma escala que predicción/gráficas)."""
    hoy = pd.to_datetime(ts).date()

    if not DATASET_FINAL_CSV.exists():
        return _metricas_desde_mysql(hoy)

    df = pd.read_csv(DATASET_FINAL_CSV)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df[df["timestamp"].dt.date == hoy].sort_values("timestamp")
    if df.empty:
        return _metricas_desde_mysql(hoy)

    df = df.copy()
    df["hora"] = df["timestamp"].dt.floor("h")
    df = df.drop_duplicates(subset=["hora"], keep="last")
    df["estres"] = calc_estres_termico(df)

    et0_series = df["et0_fao_evapotranspiration"].astype(float)
    # Open-Meteo "current" devuelve ET0 acumulado del día, no mm/h.
    # Sumar varios snapshots del ETL inflaba valores (300+ mm).
    if et0_series.max() > 2.0:
        et0_dia = float(et0_series.iloc[-1])
        et0_parcial = True
    else:
        et0_dia = float(et0_series.sum())
        et0_parcial = len(df) < 20

    return {
        "et0_dia": round(et0_dia, 2),
        "estres_termico": round(float(df["estres"].mean()), 2),
        "humedad_media": round(float(df["relative_humidity_2m"].mean()), 1),
        "et0_parcial": et0_parcial,
        "fuente": "csv",
    }

FRONTEND = ROOT / "frontend"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permite Live Server, localhost, IPs, etc.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
#   HOME
# ---------------------------------------------------------
@app.get("/")
def home():
    return FileResponse(FRONTEND / "index.html")


@app.get("/health")
def health():
    """Estado del servicio para monitorización y despliegue."""
    result = {
        "status": "ok",
        "mysql": False,
        "realtime_csv": REALTIME_CSV.exists(),
        "ubicacion": {"lat": LAT, "lon": LON},
    }
    try:
        conn = conectar()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM clima_diario")
        result["mysql"] = True
        result["clima_diario_filas"] = cur.fetchone()[0]
        cur.close()
        conn.close()
    except Exception as exc:
        result["status"] = "degraded"
        result["mysql_error"] = str(exc)
    if not result["mysql"]:
        result["status"] = "degraded"
    return result


@app.get("/etl/status")
def etl_status():
    """Última ejecución del ETL (para sincronizar auto-refresh del dashboard)."""
    if not ETL_LAST_RUN_JSON.exists():
        return {
            "success": None,
            "last_run": None,
            "last_success": None,
            "interval_seconds": ETL_INTERVAL_SECONDS,
            "interval_minutes": ETL_INTERVAL_SECONDS // 60,
        }

    try:
        data = json.loads(ETL_LAST_RUN_JSON.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {
            "success": False,
            "last_run": None,
            "last_success": None,
            "interval_seconds": ETL_INTERVAL_SECONDS,
            "interval_minutes": ETL_INTERVAL_SECONDS // 60,
            "error": "No se pudo leer etl_last_run.json",
        }

    finished = data.get("finished_at")
    return {
        **data,
        "last_run": finished,
        "last_success": finished if data.get("success") else None,
        "interval_seconds": ETL_INTERVAL_SECONDS,
        "interval_minutes": ETL_INTERVAL_SECONDS // 60,
    }


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

            if predicciones and var not in ["et0_diaria", "radiacion_diaria", "precipitacion_diaria"]:
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
        if isinstance(pred, dict) and pred.get("error"):
            return {"error": pred["error"]}
        return {"error": "No se pudieron obtener predicciones válidas."}

    salida = []

    # ---------- CAPA DIARIA (igual que ahora, con iconos) ----------
    for i, dia in enumerate(pred):
        fecha = dia["fecha"]

        info = []
        recs = []

       # ⭐ Usar SIEMPRE la predicción, no la tabla real
        et0 = pred[i]["et0_diaria"]
        estres = pred[i]["estres_termico_medio"]
        humedad = pred[i]["humedad_media"]

        viento = dia["viento_medio"]
        radiacion = dia["radiacion_diaria"]
        lluvia = dia["precipitacion_diaria"]

        prev = pred[i - 1] if i > 0 else None

        # INFORMACIÓN (etiquetas claras para UI y gráficas)
        info.append(f"🌿 ET0: {round(et0, 2)} mm/día")
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
            "et0": round(et0, 2),
            "estres": round(estres, 2),
            "humedad": round(humedad, 2),

            # ⭐ Añadimos los datos que el informe mensual necesita
            "viento": round(viento, 2),
            "radiacion": round(radiacion, 2),
            "lluvia": round(lluvia, 2),

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
#   ALERTAS — evaluación y consolidación por día
# ---------------------------------------------------------
def _ultimos_dias_clima(n: int = 7) -> list[dict]:
    conn = conectar()
    cur = conn.cursor(dictionary=True)
    cur.execute(
        """
        SELECT fecha, et0_diaria, estres_termico_medio, humedad_media,
               radiacion_diaria, viento_medio, precipitacion_diaria
        FROM clima_diario
        WHERE fecha IN (
            SELECT fecha FROM (
                SELECT DISTINCT fecha
                FROM clima_diario
                ORDER BY fecha DESC
                LIMIT %s
            ) AS ultimos
        )
        ORDER BY fecha ASC
        """,
        (n,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    # Por si hubiera filas duplicadas con la misma fecha, quedarse con la última
    por_fecha: dict = {}
    for row in rows:
        por_fecha[str(row["fecha"])] = row
    return [por_fecha[k] for k in sorted(por_fecha.keys())]


def _evaluar_dia(d: dict) -> tuple[int, list[str]]:
    """Devuelve (nivel 0-3, lista de condiciones) para un día."""
    estres = float(d.get("estres_termico_medio") or 0)
    humedad = float(d.get("humedad_media") or 0)
    radiacion = float(d.get("radiacion_diaria") or 0)
    viento = float(d.get("viento_medio") or 0)
    lluvia = float(d.get("precipitacion_diaria") or 0)
    et0 = float(d.get("et0_diaria") or 0)

    nivel = 0
    condiciones: list[str] = []

    if estres > 110:
        condiciones.append("estrés térmico crítico")
        nivel = max(nivel, 3)
    elif estres > 95:
        condiciones.append("estrés térmico alto")
        nivel = max(nivel, 2)

    if humedad > 90:
        condiciones.append("humedad extrema (riesgo hongos)")
        nivel = max(nivel, 3)
    elif humedad > 85:
        condiciones.append("humedad elevada")
        nivel = max(nivel, 2)

    if radiacion > 7500:
        condiciones.append("radiación muy alta")
        nivel = max(nivel, 3)

    if viento > 30:
        condiciones.append("viento muy fuerte")
        nivel = max(nivel, 3)
    elif viento > 20 and radiacion > 6500:
        condiciones.append("viento + radiación (quemaduras)")
        nivel = max(nivel, 2)

    if lluvia > 3:
        condiciones.append("lluvia intensa")
        nivel = max(nivel, 2)

    if et0 > 4:
        condiciones.append("ET0 muy alta")
        nivel = max(nivel, 2)

    return nivel, condiciones


def _emoji_nivel(nivel: int, futuro: bool = False) -> str:
    base = {3: "🔴", 2: "🟠", 1: "🟡"}.get(nivel, "🟢")
    return f"🔮{base}" if futuro else base


def _alerta_dia(fecha, nivel: int, condiciones: list[str], futuro: bool = False) -> str:
    prefijo = "Previsto: " if futuro else ""
    texto = " · ".join(condiciones)
    return f"{_emoji_nivel(nivel, futuro)} [{fecha}] {prefijo}{texto.capitalize()}."


def _consecutivos(estres_vals: list[float], umbral: float) -> int:
    max_racha = racha = 0
    for v in estres_vals:
        if v > umbral:
            racha += 1
            max_racha = max(max_racha, racha)
        else:
            racha = 0
    return max_racha


# ---------------------------------------------------------
#   ALERTAS REALES + PREDICCIÓN FUTURA + COMBINADAS
# ---------------------------------------------------------
@app.get("/alertas")
def alertas():

    alertas_prioritarias = []
    alertas_reales = []
    alertas_pred = []
    alertas_combinadas = []

    reales = _ultimos_dias_clima(7)

    dias_con_alerta = 0
    for d in reales:
        fecha = d["fecha"]
        nivel, condiciones = _evaluar_dia(d)
        if nivel < 2:
            continue
        dias_con_alerta += 1
        alertas_reales.append(_alerta_dia(fecha, nivel, condiciones))

    if reales:
        ultimo = reales[-1]
        nivel_hoy, cond_hoy = _evaluar_dia(ultimo)
        if nivel_hoy >= 2:
            alertas_prioritarias.append(_alerta_dia(ultimo["fecha"], nivel_hoy, cond_hoy))

    estres_vals = [float(d.get("estres_termico_medio") or 0) for d in reales]
    racha_estres = _consecutivos(estres_vals, 95)
    if racha_estres >= 3:
        alertas_combinadas.append(
            f"🔥 {racha_estres} días seguidos con estrés térmico alto."
        )

    if reales:
        ult = reales[-1]
        if float(ult.get("humedad_media") or 0) > 85 and float(ult.get("radiacion_diaria") or 0) < 2500:
            alertas_combinadas.append("🟣 Riesgo de botrytis: humedad alta + baja radiación hoy.")

        if float(ult.get("viento_medio") or 0) > 20 and float(ult.get("radiacion_diaria") or 0) > 6500:
            alertas_combinadas.append("🟣 Riesgo de quemaduras: viento + radiación alta hoy.")

    try:
        pred = prediccion(7)
    except Exception:
        pred = []

    dias_pred_alerta = 0
    for d in pred:
        fecha = d["fecha"]
        nivel, condiciones = _evaluar_dia(d)
        if nivel < 2:
            continue
        dias_pred_alerta += 1
        alertas_pred.append(_alerta_dia(fecha, nivel, condiciones, futuro=True))

    if pred and reales:
        estres_ahora = float(reales[-1].get("estres_termico_medio") or 0)
        estres_manana = float(pred[0].get("estres_termico_medio") or 0)
        if estres_ahora > 95 and estres_manana > estres_ahora:
            msg = "🔴🔮 Estrés alto hoy y subiendo mañana."
            if msg not in alertas_combinadas:
                alertas_combinadas.append(msg)
            if msg not in alertas_prioritarias:
                alertas_prioritarias.append(msg)

    if pred:
        d0 = pred[0]
        nivel_manana, cond_manana = _evaluar_dia(d0)
        if nivel_manana >= 3:
            alertas_prioritarias.append(_alerta_dia(d0["fecha"], nivel_manana, cond_manana, futuro=True))

    # Una sola entrada por mensaje (orden estable)
    def _unicos(items: list[str]) -> list[str]:
        vistos: set[str] = set()
        out: list[str] = []
        for item in items:
            if item not in vistos:
                vistos.add(item)
                out.append(item)
        return out

    alertas_prioritarias = _unicos(alertas_prioritarias)
    alertas_reales = _unicos(alertas_reales)
    alertas_pred = _unicos(alertas_pred)
    alertas_combinadas = _unicos(alertas_combinadas)

    partes_resumen = []
    if dias_con_alerta:
        partes_resumen.append(f"{dias_con_alerta} día(s) con alertas en la última semana")
    if dias_pred_alerta:
        partes_resumen.append(f"{dias_pred_alerta} día(s) con riesgo previsto")
    if not partes_resumen:
        resumen = "Sin condiciones críticas en los últimos 7 días."
    else:
        resumen = " · ".join(partes_resumen) + "."

    riesgo_acumulado_real = []
    riesgo_acumulado_pred = []
    riesgo_acumulado_comb = []

    if sum(1 for v in estres_vals if v > 95) >= 4:
        riesgo_acumulado_real.append("🔥 Estrés térmico alto en 4+ días esta semana.")

    if sum(1 for d in reales if float(d.get("humedad_media") or 0) > 85 and float(d.get("radiacion_diaria") or 0) < 2500) >= 3:
        riesgo_acumulado_real.append("🔥 Patrón botrytis: humedad alta + poca radiación repetido.")

    lluvia_real_total = sum(float(d.get("precipitacion_diaria") or 0) for d in reales)
    if lluvia_real_total > 40:
        riesgo_acumulado_real.append(f"🔥 Lluvia acumulada alta ({round(lluvia_real_total, 1)} mm).")

    if sum(1 for d in pred if float(d.get("estres_termico_medio") or 0) > 95) >= 4:
        riesgo_acumulado_pred.append("🔮🔥 Estrés térmico alto previsto varios días.")

    if sum(1 for d in pred if float(d.get("precipitacion_diaria") or 0) > 2) >= 3:
        riesgo_acumulado_pred.append("🔮🔥 Lluvia prevista varios días → riesgo hongos.")

    if sum(1 for d in pred if float(d.get("et0_diaria") or 0) > 4) >= 3:
        riesgo_acumulado_pred.append("🔮🔥 ET0 alta prevista → posible estrés hídrico.")

    if reales and pred:
        if float(reales[-1].get("humedad_media") or 0) > 85 and sum(1 for d in pred if float(d.get("precipitacion_diaria") or 0) > 2) >= 2:
            riesgo_acumulado_comb.append("🟣🔥 Humedad alta ahora + lluvia prevista → hongos.")

    return {
        "resumen": resumen,
        "alertas_prioritarias": alertas_prioritarias,
        "alertas_reales": alertas_reales,
        "alertas_prediccion": alertas_pred,
        "alertas_combinadas": alertas_combinadas,
        "riesgo_acumulado": {
            "real": _unicos(riesgo_acumulado_real),
            "prediccion": _unicos(riesgo_acumulado_pred),
            "combinado": _unicos(riesgo_acumulado_comb),
        },
    }


@app.get("/actual")
def actual():
    try:
        df = pd.read_csv(REALTIME_CSV)
    except Exception as e:
        return {"error": f"No se pudo leer el realtime: {str(e)}"}

    if df.empty:
        return {"error": "El archivo realtime está vacío"}

    row = df.iloc[-1]
    ts = row["timestamp"]

    salida = {
        "timestamp": str(ts),
        "et0_hora": round(float(row["et0_fao_evapotranspiration"]), 2),
        "temperatura": float(row["temperature_2m"]),
        "humedad": float(row["relative_humidity_2m"]),
        "radiacion": float(row["shortwave_radiation"]),
        "viento": float(row["wind_speed_10m"]),
        "direccion_viento": float(row["wind_direction_10m"]),
        "presion": float(row["pressure_msl"]),
        "nubes": float(row["cloud_cover"]),
        "precipitacion": float(row["precipitation"]),
    }

    # Estrés instantáneo (solo referencia; escala distinta al promedio diario)
    salida["estres_instantaneo"] = round(
        float(
            calc_estres_termico(
                pd.DataFrame(
                    [
                        {
                            "temperature_2m": row["temperature_2m"],
                            "shortwave_radiation": row["shortwave_radiation"],
                            "wind_speed_10m": row["wind_speed_10m"],
                        }
                    ]
                )
            ).iloc[0]
        ),
        2,
    )

    # Métricas diarias (misma escala que gráficas y predicción)
    metricas = _metricas_dia(ts)
    if metricas:
        salida["et0_dia"] = metricas["et0_dia"]
        salida["estres_termico"] = metricas["estres_termico"]
        salida["humedad_dia"] = metricas["humedad_media"]
        salida["et0_parcial"] = metricas.get("et0_parcial", False)
    else:
        salida["et0_dia"] = salida["et0_hora"]
        salida["estres_termico"] = salida["estres_instantaneo"]
        salida["humedad_dia"] = salida["humedad"]
        salida["et0_parcial"] = True

    # Compatibilidad con frontend previo
    salida["et0_actual"] = salida["et0_dia"]

    return salida


if FRONTEND.joinpath("css").is_dir():
    app.mount("/css", StaticFiles(directory=FRONTEND / "css"), name="css")
if FRONTEND.joinpath("js").is_dir():
    app.mount("/js", StaticFiles(directory=FRONTEND / "js"), name="js")
if FRONTEND.joinpath("assets").is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND / "assets"), name="assets")
if FRONTEND.joinpath("informes").is_dir():
    app.mount("/informes", StaticFiles(directory=FRONTEND / "informes"), name="informes")
