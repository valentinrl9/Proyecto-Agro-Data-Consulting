import requests
import pandas as pd

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

