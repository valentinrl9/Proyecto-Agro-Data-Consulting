"""Configuración central del proyecto (rutas, Open-Meteo, MySQL)."""

from pathlib import Path
import os

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env"

# override=False: respeta MYSQL_HOST=db inyectado por Docker Compose
if ENV_FILE.exists():
    load_dotenv(ENV_FILE, override=False)
else:
    load_dotenv(override=False)

DATOS_DIR = ROOT / "datos"
HISTORICO_CSV = DATOS_DIR / "openmeteo_historico.csv"
REALTIME_CSV = DATOS_DIR / "openmeteo_realtime.csv"
DATASET_FINAL_CSV = DATOS_DIR / "openmeteo_dataset_final.csv"

LAT = float(os.getenv("OPENMETEO_LAT", "36.77"))
LON = float(os.getenv("OPENMETEO_LON", "-2.81"))
HISTORICO_START = os.getenv("OPENMETEO_HISTORICO_START", "2020-01-01")

MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3307"))
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")

if not MYSQL_PASSWORD:
    raise RuntimeError(
        "MYSQL_PASSWORD no configurado. "
        "Definelo en .env (local) o en variables de entorno (Docker)."
    )
MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "clima")

DEFAULT_PRESSURE_HPA = float(os.getenv("DEFAULT_PRESSURE_HPA", "1013.25"))
