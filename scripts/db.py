"""Conexión MySQL y carga de agregados climáticos."""

from pathlib import Path

import mysql.connector
import pandas as pd

from config import (
    MYSQL_DATABASE,
    MYSQL_HOST,
    MYSQL_PASSWORD,
    MYSQL_PORT,
    MYSQL_USER,
    ROOT,
)


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


def _replace_table(conn, table: str, df: pd.DataFrame):
    if df.empty:
        print(f"  [{table}] sin filas, se omite carga.")
        return

    cur = conn.cursor()
    cur.execute(f"TRUNCATE TABLE {table}")

    cols = ", ".join(df.columns)
    placeholders = ", ".join(["%s"] * len(df.columns))
    insert_sql = f"INSERT INTO {table} ({cols}) VALUES ({placeholders})"

    rows = [tuple(row) for row in df.itertuples(index=False, name=None)]
    cur.executemany(insert_sql, rows)
    conn.commit()
    cur.close()
    print(f"  [{table}] {len(df)} filas cargadas.")


def load_aggregates(diario: pd.DataFrame, semanal: pd.DataFrame, mensual: pd.DataFrame):
    conn = conectar()
    try:
        init_schema(conn)
        _replace_table(conn, "clima_diario", diario)
        _replace_table(conn, "clima_semanal", semanal)
        _replace_table(conn, "clima_mensual", mensual)
    finally:
        conn.close()
