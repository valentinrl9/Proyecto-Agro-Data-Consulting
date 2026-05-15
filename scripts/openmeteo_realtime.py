import requests
import pandas as pd
import math

# -----------------------------
# Función para calcular ET0 FAO-56 por intervalo (15 min / 1 hora)
# -----------------------------
def calc_et0_interval(T, RH, Rs, u2, P):
    es = 0.6108 * math.exp((17.27 * T) / (T + 237.3))
    ea = es * (RH / 100)
    delta = (4098 * es) / ((T + 237.3)**2)
    gamma = 0.000665 * P

    # 🔥 CONVERSIÓN CORRECTA
    Rs_MJ = Rs * 0.0036   # W/m² → MJ/m²·hora
    Rn = Rs_MJ * 0.75

    G = 0

    et0 = (0.408 * delta * (Rn - G) +
           gamma * (900 / (T + 273)) * u2 * (es - ea)) / \
          (delta + gamma * (1 + 0.34 * u2))

    return max(et0, 0)


# Coordenadas de El Ejido
LAT = 36.77
LON = -2.81

url = (
    "https://api.open-meteo.com/v1/forecast"
    f"?latitude={LAT}"
    f"&longitude={LON}"
    "&current=temperature_2m,relative_humidity_2m,precipitation,"
    "wind_speed_10m,wind_direction_10m,shortwave_radiation,pressure_msl,"
    "et0_fao_evapotranspiration,cloud_cover"
    "&timezone=auto"
)

print("Obteniendo datos actuales de Open-Meteo...")
resp = requests.get(url)
data = resp.json()

current = data.get("current", {})

if not current:
    print("No se han recibido datos actuales.")
    exit()

df = pd.DataFrame([current])

# 🔥 LIMPIEZA AGRESIVA DE COLUMNAS VACÍAS
df = df.dropna(axis=1, how='all')
df = df.loc[:, ~(df.astype(str).apply(lambda col: col.str.strip()).eq("").all())]

# 🔥 Normalizar nombre de timestamp
df.rename(columns={"time": "timestamp"}, inplace=True)

# 🔥 Convertir timestamp a formato estándar (igual que el histórico)
df["timestamp"] = pd.to_datetime(df["timestamp"]).dt.strftime("%Y-%m-%d %H:%M:%S")

# -----------------------------
# 🔥 CALCULAR ET0 (sustituye el 0 de Open-Meteo)
# -----------------------------
df["et0_fao_evapotranspiration"] = df.apply(
    lambda row: calc_et0_interval(
        row["temperature_2m"],
        row["relative_humidity_2m"],
        row["shortwave_radiation"],
        row["wind_speed_10m"],
        row["pressure_msl"]
    ),
    axis=1
)

df["et0_fao_evapotranspiration"] = df["et0_fao_evapotranspiration"] / 100

# 🔥 Reordenar columnas para asegurar consistencia
columnas_correctas = [
    "timestamp",
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation",
    "wind_speed_10m",
    "wind_direction_10m",
    "shortwave_radiation",
    "pressure_msl",
    "et0_fao_evapotranspiration",
    "cloud_cover"
]

df = df[columnas_correctas]

# Guardar dataset limpio
df.to_csv("C:/ProyectoIA/datos/openmeteo_realtime.csv", index=False, encoding="utf-8")

print("Datos actuales limpios guardados en C:/ProyectoIA/datos/openmeteo_realtime.csv")
