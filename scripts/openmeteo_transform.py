"""Agregación diaria, semanal y mensual (reemplaza transformación Pentaho)."""

import pandas as pd


def calc_estres_termico(df: pd.DataFrame) -> pd.Series:
    """Misma fórmula que el paso Pentaho 'estres termico'."""
    return (
        df["temperature_2m"] * 0.6
        + df["shortwave_radiation"].fillna(0) * 0.3
        - df["wind_speed_10m"] * 0.1
    )


def aggregate_clima(hourly: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    df = hourly.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df["estres_termico"] = calc_estres_termico(df)
    df["fecha"] = df["timestamp"].dt.date

    diario = (
        df.groupby("fecha", as_index=False)
        .agg(
            et0_diaria=("et0_fao_evapotranspiration", "sum"),
            radiacion_diaria=("shortwave_radiation", "sum"),
            temperatura_media=("temperature_2m", "mean"),
            humedad_media=("relative_humidity_2m", "mean"),
            viento_medio=("wind_speed_10m", "mean"),
            precipitacion_diaria=("precipitation", "sum"),
            estres_termico_medio=("estres_termico", "mean"),
        )
    )
    diario["fecha"] = pd.to_datetime(diario["fecha"]).dt.date

    diario_ts = diario.copy()
    diario_ts["fecha"] = pd.to_datetime(diario_ts["fecha"])
    diario_ts["semana_id"] = (
        diario_ts["fecha"].dt.strftime("%G") + "-W" + diario_ts["fecha"].dt.strftime("%V")
    )
    diario_ts["mes"] = diario_ts["fecha"].dt.strftime("%Y-%m")

    semanal = (
        diario_ts.groupby("semana_id", as_index=False)
        .agg(
            et0_semanal=("et0_diaria", "sum"),
            radiacion_semanal=("radiacion_diaria", "sum"),
            temperatura_media_semanal=("temperatura_media", "mean"),
            humedad_media_semanal=("humedad_media", "mean"),
            viento_medio_semanal=("viento_medio", "mean"),
            precipitacion_semanal=("precipitacion_diaria", "sum"),
            estres_termico_semanal=("estres_termico_medio", "mean"),
        )
    )

    mensual = (
        diario_ts.groupby("mes", as_index=False)
        .agg(
            et0_mensual=("et0_diaria", "sum"),
            radiacion_mensual=("radiacion_diaria", "sum"),
            temperatura_media_mes=("temperatura_media", "mean"),
            humedad_media_mes=("humedad_media", "mean"),
            viento_medio_mes=("viento_medio", "mean"),
            precipitacion_mensual=("precipitacion_diaria", "sum"),
            estres_termico_mes=("estres_termico_medio", "mean"),
        )
    )

    for frame in (diario, semanal, mensual):
        for col in frame.columns:
            if col not in ("fecha", "semana_id", "mes"):
                frame[col] = frame[col].round(3)

    return diario, semanal, mensual
