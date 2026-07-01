# Migración al VPS Hetzner — Agro Data Consulting (Clima)

Guía paso a paso para desplegar el dashboard climático en el mismo VPS de AgroPlaga (o en uno nuevo).

---

## Resumen de lo que vas a montar

```
Internet → nginx (HTTPS) → API Docker :8000
                              ↑
                         MySQL Docker
                              ↑
                    ETL Docker (cada 15 min)
```

---

## FASE 0 — Antes de empezar (en tu PC)

### 0.1 Sube el código a GitHub (si aún no está)

```powershell
cd "C:\Proyecto Agro Data Consulting"
git add deploy/ scripts/ frontend/ sql/ requirements.txt .env.example .dockerignore
git commit -m "Añadir despliegue Docker para VPS"
git push
```

### 0.2 (Opcional) Copia el histórico climático para no re-descargarlo

El primer ETL en el VPS puede tardar varios minutos descargando desde 2020. Si ya lo tienes local:

```powershell
scp "C:\Proyecto Agro Data Consulting\datos\openmeteo_historico.csv" root@TU_IP:/tmp/
```

---

## FASE 1 — Conectar al VPS

```bash
ssh root@TU_IP_HETZNER
```

(Sustituye por tu usuario si no usas root, p. ej. `ssh deploy@...`)

---

## FASE 2 — Preparar el servidor

### 2.1 Actualizar sistema

```bash
apt update && apt upgrade -y
```

### 2.2 Instalar Docker (si no lo tienes ya por AgroPlaga)

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
```

Comprueba:

```bash
docker --version
docker compose version
```

### 2.3 Crear carpeta del proyecto

```bash
mkdir -p /opt/agro-data-consulting
cd /opt/agro-data-consulting
```

---

## FASE 3 — Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/TU_REPO.git .
```

O, si aún no está en Git, desde tu PC:

```powershell
scp -r "C:\Proyecto Agro Data Consulting\*" root@TU_IP:/opt/agro-data-consulting/
```

**No copies** la carpeta `data-integration/` (Pentaho, muy pesada).

---

## FASE 4 — Configurar variables de entorno

```bash
cd /opt/agro-data-consulting
cp deploy/env.production.example .env
nano .env
```

Cambia obligatoriamente:

```env
MYSQL_PASSWORD=una_contraseña_larga_y_segura
```

Guarda (`Ctrl+O`, Enter, `Ctrl+X`).

---

## FASE 5 — (Opcional) Subir histórico CSV

Si copiaste el archivo en Fase 0:

```bash
mkdir -p /opt/agro-data-consulting/datos
mv /tmp/openmeteo_historico.csv /opt/agro-data-consulting/datos/
```

> Si no lo subes, el ETL lo descargará solo la primera vez (más lento).

---

## FASE 6 — Levantar Docker

```bash
cd /opt/agro-data-consulting/deploy
docker compose --env-file ../.env up -d --build
```

Espera 1–2 minutos. Comprueba:

```bash
docker compose ps
docker compose logs -f etl
```

Deberías ver algo como:

```
[clima_diario] 2333 filas cargadas.
ETL completado en Xs
```

Comprueba la API desde el propio VPS:

```bash
curl -s http://127.0.0.1:8000/actual | head -c 200
```

---

## FASE 7 — nginx + HTTPS (acceso desde fuera)

Si **ya tienes nginx** para AgroPlaga, añade un nuevo sitio:

```bash
nano /etc/nginx/sites-available/clima
```

Pega el contenido de `deploy/nginx-clima.conf` cambiando `clima.tudominio.com` por tu subdominio real.

```bash
ln -s /etc/nginx/sites-available/clima /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

Certificado SSL:

```bash
certbot --nginx -d clima.tudominio.com
```

### DNS

En tu proveedor de dominio, crea un registro **A**:

```
clima.tudominio.com  →  IP_DEL_VPS
```

---

## FASE 8 — Verificar desde el navegador

Abre:

```
https://clima.tudominio.com
```

Deberías ver el dashboard con tarjetas, gráficas y recomendaciones.

---

## FASE 9 — Apagar el PC local (ya no hace falta)

En tu Windows local:

- Cierra `loop_etl.bat`
- Cierra uvicorn local
- El VPS se encarga del ETL cada 15 min y de servir el dashboard 24/7

---

## Comandos útiles en el VPS

| Acción | Comando |
|--------|---------|
| Ver logs API | `docker compose -f deploy/docker-compose.yml logs -f api` |
| Ver logs ETL | `docker compose -f deploy/docker-compose.yml logs -f etl` |
| Reiniciar todo | `cd /opt/agro-data-consulting/deploy && docker compose --env-file ../.env restart` |
| ETL manual | `docker compose --env-file ../.env exec etl python etl_pipeline.py` |
| Actualizar código | `git pull && docker compose --env-file ../.env up -d --build` |

(Ejecuta desde `/opt/agro-data-consulting/deploy` o usa `-f` con la ruta completa.)

---

## Mismo VPS que AgroPlaga — notas

- **Puerto 8000** queda solo en `127.0.0.1` (no expuesto a internet); nginx hace de puerta de entrada.
- **MySQL** de Agro Data va en contenedor Docker propio (`agrodata-mysql`), separado de la BD de AgroPlaga.
- Si AgroPlaga ya usa el puerto **8000**, cambia en `docker-compose.yml`:

  ```yaml
  ports:
    - "127.0.0.1:8001:8000"
  ```

  y en nginx: `proxy_pass http://127.0.0.1:8001;`

---

## Solución de problemas

### ETL falla: Access denied MySQL

```bash
docker compose logs db
# Revisa que MYSQL_PASSWORD en .env coincida
docker compose down
docker compose up -d --build
```

### Dashboard vacío

1. `curl http://127.0.0.1:8000/actual` en el VPS — debe devolver JSON con datos
2. Abre el dashboard por **HTTPS/nginx**, no por IP:puerto directo
3. `docker compose logs api`

### Histórico tarda mucho

Sube `openmeteo_historico.csv` desde tu PC (Fase 0.2) y reinicia el contenedor ETL:

```bash
docker compose restart etl
```

---

## Checklist final

- [ ] `.env` con contraseña segura
- [ ] `docker compose ps` — 3 contenedores `Up` (db, api, etl)
- [ ] ETL carga filas en MySQL
- [ ] nginx + SSL configurado
- [ ] Dashboard accesible por URL pública
- [ ] PC local ya no necesita `loop_etl.bat`
