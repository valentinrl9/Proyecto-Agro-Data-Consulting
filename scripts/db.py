"""Conexión MySQL y carga de agregados climáticos."""

import mysql.connector
import numpy as np
import pandas as pd

from config import (
    MYSQL_DATABASE,
    MYSQL_HOST,
    MYSQL_PASSWORD,
    MYSQL_PORT,
    MYSQL_USER,
    ROOT,
)

TABLE_COLUMNS = {
    "clima_diario": [
        "fecha",
        "et0_diaria",
        "radiacion_diaria",
        "temperatura_media",
        "humedad_media",
        "viento_medio",
        "precipitacion_diaria",
        "estres_termico_medio",
    ],
    "clima_semanal": [
        "semana_id",
        "et0_semanal",
        "radiacion_semanal",
        "temperatura_media_semanal",
        "humedad_media_semanal",
        "viento_medio_semanal",
        "precipitacion_semanal",
        "estres_termico_semanal",
    ],
    "clima_mensual": [
        "mes",
        "et0_mensual",
        "radiacion_mensual",
        "temperatura_media_mes",
        "humedad_media_mes",
        "viento_medio_mes",
        "precipitacion_mensual",
        "estres_termico_mes",
    ],
}


def conectar():
    return mysql.connector.connect(
        host=MYSQL_HOST,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DATABASE,
        port=MYSQL_PORT,
    )


def init_schema(conn=None):
    """Crea base de datos y tablas si no existen."""
    close = conn is None
    if conn is None:
        conn = mysql.connector.connect(
            host=MYSQL_HOST,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            port=MYSQL_PORT,
        )

    schema_path = ROOT / "sql" / "schema.sql"
    sql = schema_path.read_text(encoding="utf-8")

    cur = conn.cursor()
    for statement in sql.split(";"):
        stmt = statement.strip()
        if stmt:
            cur.execute(stmt)
    conn.commit()
    cur.close()

    if close:
        conn.close()


def _prepare_df(table: str, df: pd.DataFrame) -> pd.DataFrame:
    expected = TABLE_COLUMNS[table]
    extra = [c for c in df.columns if c not in expected]
    if extra:
        print(f"  [{table}] ignorando columnas extra: {extra}")

    missing = [c for c in expected if c not in df.columns]
    if missing:
        raise ValueError(f"[{table}] faltan columnas: {missing}")

    out = df[expected].copy()

    if "fecha" in out.columns:
        out["fecha"] = pd.to_datetime(out["fecha"], errors="coerce").dt.strftime("%Y-%m-%d")

    def _cell(value):
        if value is None:
            return None
        if isinstance(value, float) and (np.isnan(value) or np.isinf(value)):
            return None
        if pd.isna(value):
            return None
        return value

    rows = []
    for row in out.itertuples(index=False, name=None):
        rows.append(tuple(_cell(v) for v in row))

    return out, rows


def _replace_table(conn, table: str, df: pd.DataFrame):
    if df.empty:
        print(f"  [{table}] sin filas, se omite carga.")
        return

    prepared, rows = _prepare_df(table, df)
    cols = ", ".join(f"`{c}`" for c in TABLE_COLUMNS[table])
    placeholders = ", ".join(["%s"] * len(TABLE_COLUMNS[table]))
    insert_sql = f"INSERT INTO `{table}` ({cols}) VALUES ({placeholders})"

    cur = conn.cursor()
    cur.execute(f"TRUNCATE TABLE `{table}`")
    cur.executemany(insert_sql, rows)
    conn.commit()
    cur.close()
    print(f"  [{table}] {len(prepared)} filas cargadas.")


def load_aggregates(diario: pd.DataFrame, semanal: pd.DataFrame, mensual: pd.DataFrame):
    conn = conectar()
    try:
        init_schema(conn)
        _replace_table(conn, "clima_diario", diario)
        _replace_table(conn, "clima_semanal", semanal)
        _replace_table(conn, "clima_mensual", mensual)
    finally:
        conn.close()
