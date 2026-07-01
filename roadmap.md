# Roadmap — Agro Data Consulting

> Seguimiento de la evolución del proyecto desde el TFC de IA hacia la plataforma B2B descrita en `Docs/`.
>
> **Última revisión:** 2026-07-01

---

## Leyenda de estado

| Símbolo | Significado |
|---------|-------------|
| ✅ | Hecho / operativo en el código actual |
| 🟡 | Parcialmente hecho o prototipo funcional |
| ⬜ | Pendiente según documentación estratégica |
| 🔴 | Bloqueante / deuda técnica crítica |

---

## 1. Resumen ejecutivo

El repositorio contiene un **Sistema Inteligente de Predicción Climática y Recomendaciones Agronómicas** desarrollado como **proyecto final de curso (Big Data, IA y 5G)**. Está orientado a un **agricultor individual** en El Ejido (36.77, -2.81) y cubre bien el **Módulo 3 parcial** del catálogo comercial (clima + alertas + predicción).

Para convertirlo en **Agro Data Consulting** (consultoría B2B para cooperativas/SATs) hay que ampliar el alcance hacia **ingesta de datos operativos**, **multi-tenant**, **mapas SIGPAC**, **trazabilidad fitosanitaria** y **dashboard ejecutivo corporativo**, según `Docs/propuesta_agro_data_consulting.html` y `Docs/portfolio_agro_data_consulting.html`.

---

## 2. Qué hay hecho (inventario técnico)

### 2.1 Ingesta y ETL climática — ✅

| Componente | Estado | Descripción |
|------------|--------|-------------|
| `scripts/etl_pipeline.py` | ✅ | Pipeline unificado Open-Meteo → MySQL (reemplaza Pentaho) |
| `scripts/openmeteo_client.py` | ✅ | Descarga histórico + realtime, limpieza, ET0 FAO-56 |
| `scripts/openmeteo_transform.py` | ✅ | Agregación diaria / semanal / mensual |
| `scripts/db.py` + `sql/schema.sql` | ✅ | Creación de tablas y carga MySQL |
| `run_etl.bat` + `loop_etl.bat` | ✅ | Ejecución manual o cada 15 min |
| `datos/*.csv` | ✅ | Cache local de respaldo |
| Pentaho (`data-integration/`, `.ktr`, `.kjb`) | ⬜ | **Eliminado del flujo** — carpeta legacy, se puede borrar del disco |

**Cómo funciona:** Python descarga Open-Meteo → limpia y unifica CSV → agrega → carga MySQL (`clima_diario`, `clima_semanal`, `clima_mensual`) en ~4 s.

### 2.2 Backend API — 🟡

| Componente | Estado | Descripción |
|------------|--------|-------------|
| `scripts/api_prediccion.py` | ✅ | FastAPI principal: predicción ML, recomendaciones, alertas, informe |
| Endpoints `/prediccion`, `/recomendaciones`, `/alertas`, `/actual`, `/apagar` | ✅ | Operativos contra MySQL + CSV realtime |
| `scripts/api_estres.py`, `api_riego.py` | 🟡 | APIs auxiliares con modelos `.pkl` (no integradas en dashboard principal) |
| `scripts/api_clima.py` | 🔴 | Archivo incompleto (solo fragmento `/clima_mes`) |
| RBAC / multi-tenant | ⬜ | No implementado |
| PostgreSQL + PostGIS | ⬜ | Usa MySQL local (puerto 3307) |

**Modelos ML:** LinearRegression + RandomForestRegressor sobre `clima_diario` (14 días históricos → predicción 7–30 días). Reglas heurísticas para recomendaciones (riego, ventilación, hongos, estrés térmico).

### 2.3 Frontend dashboard — 🟡

| Componente | Estado | Descripción |
|------------|--------|-------------|
| `frontend/index.html` + CSS/JS vanilla | ✅ | 5 secciones: Inicio, Recomendaciones, Alertas, Riesgo, Informe mensual |
| Chart.js (ET0, estrés, humedad) | ✅ | Gráficas semanales |
| Informe mensual + export PDF (html2pdf) | ✅ | Generación automática desde API |
| React + TypeScript | ⬜ | Docs prometen stack React |
| Leaflet / mapas SIGPAC | ⬜ | No existe |
| Branding Agro Data Consulting | ⬜ | Título actual: "Dashboard Agronómico Inteligente" |

### 2.4 Entrenamiento de modelos — 🟡

| Script | Estado | Salida esperada |
|--------|--------|-----------------|
| `scripts/entrenar_estres.py` | ✅ | `modelos/modelo_estres.pkl` |
| `scripts/entrenar_riego.py` | ✅ | `modelos/modelo_riego.pkl` |
| Carpeta `modelos/` en repo | 🔴 | Vacía (modelos no versionados o no generados) |

### 2.5 Operación y despliegue — 🟡

| Problema | Detalle |
|----------|---------|
| Rutas obsoletas | ✅ Corregidas con rutas relativas (`%~dp0`) |
| Credenciales hardcodeadas | ✅ Movidas a `.env` (ver `.env.example`) |
| Sin README | ⬜ Pendiente |
| Pentaho en repo | ⬜ Carpeta `data-integration/` se puede eliminar manualmente |
| Archivos basura | ⬜ `api_prediccion copy.py`, etc. |

---

## 3. Qué pide la documentación (`Docs/`) vs. realidad

### 3.1 Servicios comerciales (`portfolio_agro_data_consulting.html`)

| Servicio | Lo que pide el doc | Estado actual | Gap principal |
|----------|-------------------|---------------|---------------|
| **1. Auditoría e Integración de Datos** | ETL de Excels, partes de peritos, albaranes → DWH normalizado por SIGPAC/cultivo | Solo pipeline Open-Meteo | Falta ingesta de fuentes cooperativas, normalización SIGPAC, seguridad por rol |
| **2. Dashboard Ejecutivo a Medida** | Mapa SIGPAC, trazabilidad fitosanitaria, alertas de plazos de seguridad, informes GlobalGAP | Dashboard climático individual | Falta capa geoespacial, datos de tratamientos, multi-finca/multi-socio |
| **3. Alertas Comarcales e Inteligencia Microclimática** | Semáforo de riesgo comarcal, notificaciones por zona SIGPAC, históricos por campaña | Alertas climáticas + predicción 7 días | Falta zonificación, estaciones locales reales, canal de notificación (WhatsApp/SMS/email) |

### 3.2 Stack objetivo (`propuesta_agro_data_consulting.html`)

| Capa | Objetivo doc | Actual | Acción |
|------|--------------|--------|--------|
| ETL | Python + Pentaho | ✅ Igual | Mantener; añadir conectores Excel/ERP |
| Backend | FastAPI + RBAC | FastAPI sin auth | Implementar auth, tenants por cooperativa |
| BD | PostgreSQL + PostGIS | MySQL sin geo | Migración + esquema SIGPAC |
| Frontend | React + TS + Leaflet | HTML/JS vanilla | Migración progresiva o rewrite |
| Clima | Open-Meteo + estaciones | Solo Open-Meteo | Integrar estaciones locales/comarcales |

### 3.3 Modelo de negocio y fases (`propuesta_agro_data_consulting.html`)

| Fase | Plazo doc | Objetivo | Relación con código |
|------|-----------|----------|---------------------|
| **Fase 1** | Mes 1–6 | 2 cooperativas piloto, panel gratuito, históricos reales | Reutilizar dashboard actual como demo climática; construir ingesta coop |
| **Fase 2** | Mes 6–18 | Monetización (3–6 k€ implantación + 200 €/mes), 8 coops | Productizar multi-tenant + contratos mantenimiento |
| **Fase 3** | Mes 18+ | Estandarización, otras CCAA, APIs de riesgo | SaaS AgroPlaga AI + APIs anonimizadas |

### 3.4 Sinergia AgroPlaga AI

Los docs posicionan Agro Data Consulting como **caballo de Troya B2B** y AgroPlaga AI como **app móvil para agricultores**. Hoy no hay integración entre repos/proyectos. El cuestionario de validación (`cuestionario_validacion_agrodata.pdf`) confirma necesidades que el código actual **no cubre** (plazos de carencia, rechazo de camiones, comunicación perito→agricultor).

---

## 4. Roadmap por fases

### Fase 0 — Reencender el proyecto (Semanas 1–2)

- [x] **0.1** Corregir rutas `C:\ProyectoIA\` → ruta relativa o variable de entorno
- [x] **0.2** Externalizar credenciales a `.env`
- [ ] **0.3** Crear `README.md` con requisitos y arranque
- [ ] **0.4** Limpiar archivos basura y duplicados
- [x] **0.5** Verificar pipeline completo: ETL Python → MySQL → API → dashboard
- [ ] **0.6** Regenerar modelos `.pkl`
- [ ] **0.7** Actualizar branding mínimo
- [x] **0.8** Eliminar Pentaho del flujo ETL (migrado a `scripts/etl_pipeline.py`)

**Criterio de done:** `iniciar_sistema.bat` arranca API + dashboard desde este directorio sin editar rutas a mano.

---

### Fase 1 — Validación y piloto (Mes 1–6) — Alineado con doc comercial

#### 1A. Consolidar demo climática (aprovechar lo existente)

- [ ] **1.1** Estabilizar módulo microclimático: semáforo de riesgo visual unificado (hongos / estrés / humedad)
- [ ] **1.2** Mejorar informe mensual exportable como pieza de venta ("Informes para Consejo Rector")
- [ ] **1.3** Documentar limitaciones actuales vs. promesa comercial (transparencia en demos)

#### 1B. Primera ingesta cooperativa (MVP Servicio 1)

- [ ] **1.4** Diseñar esquema de datos mínimo: fincas SIGPAC, socios, visitas perito, tratamientos
- [ ] **1.5** ETL piloto: importar 1–2 Excels reales de cooperativa piloto (Python o Pentaho)
- [ ] **1.6** Validar con guión de `cuestionario_validacion_agrodata.pdf` (entrevistas campo)

#### 1C. Infraestructura base multi-cliente

- [ ] **1.7** Decidir: migrar a PostgreSQL+PostGIS ya, o mantener MySQL en piloto con plan de migración
- [ ] **1.8** Esqueleto FastAPI: auth básica + separación por `cooperativa_id`
- [ ] **1.9** Configuración por cliente (coordenadas, zonas, umbrales de alerta)

#### 1D. Captación piloto (negocio)

- [ ] **1.10** Identificar 2 cooperativas/almacenes El Ejido / Dalías
- [ ] **1.11** Demo adaptada + acuerdo piloto gratuito a cambio de históricos
- [ ] **1.12** Conectar primera estación meteorológica local (si disponible en piloto)

**Criterio de done Fase 1:** 1 cooperativa piloto con datos operativos ingestados + dashboard climático + primer mapa/listado de incidencias por finca (aunque sea MVP sin Leaflet completo).

---

### Fase 2 — Producto implantable (Mes 6–18)

#### 2A. Dashboard ejecutivo (Servicio 2)

- [ ] **2.1** Migrar frontend a React + TypeScript (o módulo nuevo conviviendo con legacy)
- [ ] **2.2** Mapa Leaflet con capas SIGPAC e incidencias fitosanitarias
- [ ] **2.3** Módulo plazos de seguridad / carencias con alertas visuales pre-recolección
- [ ] **2.4** Exportación informes auditoría (GlobalGAP, Bio Suisse) — plantillas PDF
- [ ] **2.5** RBAC completo: admin coop, técnico, consultor externo, solo lectura junta

#### 2B. Alertas comarcales (Servicio 3)

- [ ] **2.6** Modelo de riesgo por zona (agrupación SIGPAC / paraje)
- [ ] **2.7** Integración estaciones meteorológicas locales (además de Open-Meteo)
- [ ] **2.8** Canal de notificación: email mínimo → WhatsApp/SMS
- [ ] **2.9** Panel técnico para emitir avisos a grupos de agricultores

#### 2C. Integración AgroPlaga AI

- [ ] **2.10** API compartida o sincronización incidencias campo → dashboard coop
- [ ] **2.11** Flujo perito: app móvil alimenta DWH que ya vendiste en consultoría

#### 2D. Operaciones comerciales

- [ ] **2.12** Paquete implantación documentado (alcance, precio 3–6 k€, plazos)
- [ ] **2.13** Contrato mantenimiento 200 €/mes (monitoring, ETL, soporte)
- [ ] **2.14** Objetivo: 8 cooperativas medianas contratadas

**Criterio de done Fase 2:** Producto desplegable en <2 semanas por cliente con ingesta estándar + dashboard + alertas.

---

### Fase 3 — Escala y estandarización (Mes 18+)

- [ ] **3.1** Plantillas ETL por tipo de fuente (Hispatec export, Excel perito, CSV albaranes)
- [ ] **3.2** Multi-región: parametrización climática Murcia, Huelva, CV
- [ ] **3.3** API pública de riesgo microclimático anonimizado (B2B aseguradoras/comercializadoras)
- [ ] **3.4** Reducir dependencia de Pentaho embebido (considerar PDI solo en ETL server o reemplazo parcial por Python)
- [ ] **3.5** CI/CD, contenedores Docker, despliegue cloud (costes infra mínimos según doc)

---

## 5. Matriz rápida: TFC → Agro Data Consulting

| Dimensión | Proyecto TFC (actual) | Agro Data Consulting (objetivo) |
|-----------|----------------------|----------------------------------|
| Cliente | Agricultor / demo académica | Cooperativa, SAT, almacén |
| Datos | Solo clima Open-Meteo | Clima + operativa + SIGPAC + tratamientos |
| UI | Dashboard agronómico personal | Dashboard ejecutivo corporativo + mapas |
| Usuarios | 1 | Multi-rol, multi-tenant |
| BD | MySQL | PostgreSQL + PostGIS |
| Frontend | HTML/JS | React + TS + Leaflet |
| Negocio | Entrega académica | Consultoría B2B + sinergia AgroPlaga AI |

---

## 6. Riesgos y dependencias

| Riesgo | Mitigación |
|--------|------------|
| Rutas/credenciales rotas impiden retomar | Fase 0 obligatoria antes de cualquier demo comercial |
| Promesa comercial (SIGPAC, trazabilidad) >> código actual | Usar módulo clima como "demo hook"; ser explícitos en alcance piloto |
| Pentaho en repo (~GB) complica git/despliegue | Valorar PDI externo o ETL 100% Python a medio plazo |
| Sin datos reales de cooperativa | Priorizar entrevistas con guión de validación + 1 Excel piloto |
| MySQL vs PostgreSQL | Decidir en Fase 1B; no bloquear piloto por migración prematura |

---

## 7. Registro de progreso

| Fecha | Hito | Notas |
|-------|------|-------|
| 2026-07-01 | Auditoría inicial del repo | Roadmap creado. Proyecto identificado como TFC IA reutilizable parcialmente para módulo climático. |
| 2026-07-01 | ETL 100% Python | Pentaho eliminado del flujo. `etl_pipeline.py` carga 2333 días en MySQL en ~4 s. |

---

## 8. Referencias internas

- `Docs/propuesta_agro_data_consulting.html` — Brief estratégico, stack, fases de negocio
- `Docs/portfolio_agro_data_consulting.html` — Catálogo de 3 servicios
- `Docs/ProyectoIA.pptx` — Documentación del TFC original (flujo, tablas MySQL, dashboard)
- `Docs/cuestionario_validacion_agrodata.pdf` — Guion entrevistas piloto
- `Docs/analisis_profundo_agrodata.pdf` / `Competencia Agro Data Consulting.pdf` — Contexto competitivo

---

*Mantener este archivo actualizado marcando `[x]` las tareas completadas y añadiendo filas en la sección 7.*
