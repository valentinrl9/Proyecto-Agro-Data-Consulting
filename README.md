# Agro Data Consulting — Clima

Dashboard de microclima, predicción agronómica y alertas para invernaderos.  
Datos de **Open-Meteo** → ETL Python → **MySQL** → **FastAPI** → dashboard web.

**Producción:** https://clima.agroplaga-ai.farm  
**Ubicación por defecto:** El Ejido, Almería (36.77, -2.81)

---

## Requisitos

- Python 3.12+
- MySQL 8 (local o Docker)
- `.env` en la raíz (copiar desde `.env.example`)

---

## Arranque rápido (Windows)

```bat
copy .env.example .env
REM Editar MYSQL_PASSWORD en .env

pip install -r requirements.txt
.\run_etl.bat
.\iniciar_sistema.bat
```

Dashboard: http://127.0.0.1:8000

---

## ETL manual

```bat
.\run_etl.bat              REM un ciclo
.\loop_etl.bat             REM cada 15 minutos
```

O directamente:

```bash
cd scripts
python etl_pipeline.py
```

---

## Despliegue VPS (Docker)

```bash
cp deploy/env.production.example .env
# Editar .env con contraseña MySQL

cd deploy
docker compose --env-file ../.env up -d --build
```

Guía completa: `deploy/GUIA-MIGRACION-VPS.md`

**Actualizar producción:**

```bash
git pull
cd deploy
docker compose --env-file ../.env up -d --build
```

---

## API principal

| Endpoint | Descripción |
|----------|-------------|
| `GET /` | Dashboard |
| `GET /health` | Estado MySQL + CSV realtime |
| `GET /etl/status` | Última ejecución ETL (sync dashboard) |
| `GET /actual` | Datos en tiempo real |
| `GET /prediccion?dias=7` | Predicción ML |
| `GET /recomendaciones?dias=7` | Recomendaciones agronómicas |
| `GET /alertas` | Alertas reales + predicción + riesgo |

---

## Estructura

```
scripts/          API, ETL, transformación Open-Meteo
frontend/         Dashboard HTML/JS/CSS
sql/schema.sql    Tablas MySQL
deploy/           Docker Compose + Dockerfile
datos/            Cache CSV (generado por ETL)
Docs/             Material comercial
roadmap.md        Evolución hacia consultoría B2B
```

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| Dashboard vacío | Comprobar ETL: `docker compose logs etl --tail 30` |
| Error MySQL | Verificar `.env` y `GET /health` |
| Sin datos históricos | Ejecutar ETL manual (primera vez tarda varios min) |
| VPS tras `git pull` | `docker compose up -d --build` |

---

## Roadmap

Ver `roadmap.md` para la evolución hacia plataforma B2B (cooperativas, SIGPAC, multi-tenant).
