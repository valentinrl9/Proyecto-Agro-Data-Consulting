"""Descarga y limpieza de datos Open-Meteo."""

from __future__ import annotations

import math
from datetime import date, datetime

import pandas as pd
import requests

from config import (
    DATASET_FINAL_CSV,
    DEFAULT_PRESSURE_HPA,
    HISTORICO_CSV,
    HISTORICO_START,
    LAT,
    LON,
    REALTIME_CSV,
)

COLUMNS = [
    "timestamp",
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation",
    "wind_speed_10m",
    "wind_direction_10m",
    "shortwave_radiation",
    "pressure_msl",
    "et0_fao_evapotranspiration",
    "cloud_cover",
]


def calc_et0_interval(t: float, rh: float, rs: float, u2: float, p: float) -> float:
    """ET0 horaria FAO-56 (mm/h)."""
    es = 0.6108 * math.exp((17.27 * t) / (t + 237.3))
    ea = es * (rh / 100)
    delta = (4098 * es) / ((t + 237.3) ** 2)
    gamma = 0.000665 * p
    rs_mj = rs * 0.0036
    rn = rs_mj * 0.75
    et0 = (
        0.408 * delta * rn
        + gamma * (900 / (t + 273)) * u2 * (es - ea)
    ) / (delta + gamma * (1 + 0.34 * u2))
    return max(et0, 0.0)


def _normalize_hourly_df(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    for col in COLUMNS[1:]:
        if col not in df.columns:
            df[col] = pd.NA
    df = df[COLUMNS]
    return df.sort_values("timestamp").reset_index(drop=True)


def _fill_et0(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    pressure = df["pressure_msl"].fillna(DEFAULT_PRESSURE_HPA)

    def row_et0(row):
        if pd.notna(row["et0_fao_evapotranspiration"]) and row["et0_fao_evapotranspiration"] > 0:
            return float(row["et0_fao_evapotranspiration"])
        return calc_et0_interval(
            float(row["temperature_2m"]),
            float(row["relative_humidity_2m"]),
            float(row["shortwave_radiation"] or 0),
            float(row["wind_speed_10m"]),
            float(pressure.loc[row.name]),
        )

    df["et0_fao_evapotranspiration"] = df.apply(row_et0, axis=1)
    return df


def fetch_historico(force: bool = False) -> pd.DataFrame:
    if HISTORICO_CSV.exists() and not force:
        print("Histórico ya existe, se reutiliza CSV local.")
        return _normalize_hourly_df(pd.read_csv(HISTORICO_CSV))

    end_date = date.today().isoformat()
    url = (
        "https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={LAT}&longitude={LON}"
        f"&start_date={HISTORICO_START}&end_date={end_date}"
        "&hourly=temperature_2m,relative_humidity_2m,precipitation,"
        "wind_speed_10m,wind_direction_10m,shortwave_radiation,"
        "et0_fao_evapotranspiration,pressure_msl,cloud_cover"
        "&timezone=auto"
    )

    print(f"Descargando historico Open-Meteo ({HISTORICO_START} a {end_date})...")
    resp = requests.get(url, timeout=120)
    resp.raise_for_status()
    hourly = resp.json().get("hourly", {})
    if not hourly.get("time"):
        raise RuntimeError("Open-Meteo no devolvió datos horarios históricos.")

    df = pd.DataFrame(hourly).rename(columns={"time": "timestamp"})
    df = _normalize_hourly_df(df)
    df = _fill_et0(df)
    HISTORICO_CSV.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(HISTORICO_CSV, index=False, encoding="utf-8")
    print(f"Histórico guardado: {HISTORICO_CSV} ({len(df)} filas)")
    return df


def fetch_realtime() -> pd.DataFrame:
    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={LAT}&longitude={LON}"
        "&current=temperature_2m,relative_humidity_2m,precipitation,"
        "wind_speed_10m,wind_direction_10m,shortwave_radiation,pressure_msl,"
        "et0_fao_evapotranspiration,cloud_cover"
        "&timezone=auto"
    )

    print("Descargando datos actuales Open-Meteo...")
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    current = resp.json().get("current")
    if not current:
        raise RuntimeError("Open-Meteo no devolvió datos actuales.")

    df = pd.DataFrame([current]).rename(columns={"time": "timestamp"})
    df = _normalize_hourly_df(df)
    df = _fill_et0(df)

    REALTIME_CSV.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(REALTIME_CSV, index=False, encoding="utf-8")
    print(f"Realtime guardado: {REALTIME_CSV}")
    return df


def merge_datasets(historico: pd.DataFrame, realtime: pd.DataFrame) -> pd.DataFrame:
    df = pd.concat([historico, realtime], ignore_index=True)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp")
    df = df.drop_duplicates(subset=["timestamp"], keep="last")
    df = _fill_et0(df)

    df.to_csv(HISTORICO_CSV, index=False, encoding="utf-8")
    df.to_csv(DATASET_FINAL_CSV, index=False, encoding="utf-8")
    print(f"Dataset unificado: {len(df)} filas -> {DATASET_FINAL_CSV}")
    return df.reset_index(drop=True)
