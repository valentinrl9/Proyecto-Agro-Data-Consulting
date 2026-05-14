@app.get("/clima_mes")
def clima_mes():
    conexion = conectar()
    cursor = conexion.cursor(dictionary=True)

    # Obtener el mes actual
    hoy = datetime.now()
    mes = hoy.strftime("%Y-%m")
    
    query = f"""
        SELECT 
            fecha,
            eto_diaria AS et0,
            radiacion_diaria AS radiacion,
            temperatura_media AS temperatura,
            humedad_media AS humedad,
            viento_medio AS viento,
            precipitacion_diaria AS precipitacion,
            estres_termico_medio AS estres_termico
        FROM clima_diario
        WHERE fecha LIKE '{mes}%'
        ORDER BY fecha ASC;
    """

    cursor.execute(query)
    resultado = cursor.fetchall()

    cursor.close()
    conexion.close()

    return resultado
