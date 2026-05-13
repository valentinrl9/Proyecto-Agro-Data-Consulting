import requests
import pandas as pd
import os

HISTORICO = "C:/ProyectoIA/datos/openmeteo_historico.csv"

if os.path.exists(HISTORICO):
    print("El histórico ya existe. No se descarga de nuevo.")
    exit()

LAT = 36.77
LON = -2.81

START_DATE = "2020-01-01"
END_DATE = "2026-05-04"

url = (
    "https://archive-api.open-meteo.com/v1/archive"
    f"?latitude={LAT}"
    f"&longitude={LON}"
    f"&start_date={START_DATE}"
    f"&end_date={END_DATE}"
    "&hourly=temperature_2m,relative_humidity_2m,precipitation,"
    "wind_speed_10m,wind_direction_10m,shortwave_radiation,et0_fao_evapotranspiration"
    "&timezone=auto"
)

print("Descargando histórico por primera vez...")
resp = requests.get(url)
data = resp.json()

hourly = data.get("hourly", {})
time = hourly.get("time", [])

if not time:
    print("No se han recibido datos horarios.")
    exit()

df = pd.DataFrame(hourly)

# 🔥 CONVERSIÓN REAL
df["time"] = pd.to_datetime(df["time"]).dt.strftime("%Y-%m-%d %H:%M:%S")
df.rename(columns={"time": "timestamp"}, inplace=True)

df.to_csv(HISTORICO, index=False, encoding="utf-8")

print("Histórico guardado en:", HISTORICO)
