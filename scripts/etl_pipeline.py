"""
Pipeline ETL Open-Meteo → MySQL (sin Pentaho).

Uso:
  python etl_pipeline.py              # ciclo completo
  python etl_pipeline.py --force-historic   # re-descargar histórico
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime

from config import ETL_LAST_RUN_JSON
from db import load_aggregates
from openmeteo_client import fetch_historico, fetch_realtime, merge_datasets
from openmeteo_transform import aggregate_clima


def _guardar_estado_etl(started: datetime, elapsed: float, success: bool, error: str | None = None) -> None:
    ETL_LAST_RUN_JSON.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "started_at": started.isoformat(timespec="seconds"),
        "finished_at": datetime.now().isoformat(timespec="seconds"),
        "success": success,
        "elapsed_s": round(elapsed, 1),
        "error": error,
    }
    ETL_LAST_RUN_JSON.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def run(force_historic: bool = False) -> None:
    started = datetime.now()
    print("=" * 50)
    print(f"ETL Open-Meteo  |  {started.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)

    historico = fetch_historico(force=force_historic)
    realtime = fetch_realtime()
    merged = merge_datasets(historico, realtime)

    print("Agregando diario / semanal / mensual...")
    diario, semanal, mensual = aggregate_clima(merged)

    print("Cargando en MySQL...")
    load_aggregates(diario, semanal, mensual)

    elapsed = (datetime.now() - started).total_seconds()
    _guardar_estado_etl(started, elapsed, success=True)
    print(f"ETL completado en {elapsed:.1f}s")


def main():
    parser = argparse.ArgumentParser(description="ETL Open-Meteo → MySQL")
    parser.add_argument(
        "--force-historic",
        action="store_true",
        help="Forzar re-descarga del histórico completo",
    )
    args = parser.parse_args()
    started = datetime.now()
    try:
        run(force_historic=args.force_historic)
    except Exception as exc:
        elapsed = (datetime.now() - started).total_seconds()
        _guardar_estado_etl(started, elapsed, success=False, error=str(exc))
        print(f"ERROR ETL: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
