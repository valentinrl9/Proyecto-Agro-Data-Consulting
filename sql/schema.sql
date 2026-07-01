CREATE DATABASE IF NOT EXISTS clima CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE clima;

CREATE TABLE IF NOT EXISTS clima_diario (
    fecha DATE NOT NULL PRIMARY KEY,
    et0_diaria DOUBLE,
    radiacion_diaria DOUBLE,
    temperatura_media DOUBLE,
    humedad_media DOUBLE,
    viento_medio DOUBLE,
    precipitacion_diaria DOUBLE,
    estres_termico_medio DOUBLE
);

CREATE TABLE IF NOT EXISTS clima_semanal (
    semana_id VARCHAR(10) NOT NULL PRIMARY KEY,
    et0_semanal DOUBLE,
    radiacion_semanal DOUBLE,
    temperatura_media_semanal DOUBLE,
    humedad_media_semanal DOUBLE,
    viento_medio_semanal DOUBLE,
    precipitacion_semanal DOUBLE,
    estres_termico_semanal DOUBLE
);

CREATE TABLE IF NOT EXISTS clima_mensual (
    mes VARCHAR(7) NOT NULL PRIMARY KEY,
    et0_mensual DOUBLE,
    radiacion_mensual DOUBLE,
    temperatura_media_mes DOUBLE,
    humedad_media_mes DOUBLE,
    viento_medio_mes DOUBLE,
    precipitacion_mensual DOUBLE,
    estres_termico_mes DOUBLE
);
