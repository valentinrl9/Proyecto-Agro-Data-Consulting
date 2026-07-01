"""
Pipeline ETL Open-Meteo → MySQL (sin Pentaho).

Uso:
  python etl_pipeline.py              # ciclo completo
  python etl_pipeline.py --force-historic   # re-descargar histórico
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime

from db import load_aggregates
from openmeteo_client import fetch_historico, fetch_realtime, merge_datasets
from openmeteo_transform import aggregate_clima


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
    print(f"ETL completado en {elapsed:.1f}s")


def main():
    parser = argparse.ArgumentParser(description="ETL Open-Meteo → MySQL")
    parser.add_argument(
        "--force-historic",
        action="store_true",
        help="Forzar re-descarga del histórico completo",
    )
    args = parser.parse_args()
    try:
        run(force_historic=args.force_historic)
    except Exception as exc:
        print(f"ERROR ETL: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
