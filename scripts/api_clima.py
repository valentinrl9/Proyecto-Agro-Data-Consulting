from fastapi import FastAPI
import mysql.connector
from datetime import datetime

app = FastAPI()

def conectar():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="Valentin.09",
        database="clima",
        port=3307
    )

@app.get("/")
def home():
    return {"mensaje": "API de clima diario funcionando"}

@app.get("/clima_hoy")
def clima_hoy():
    conexion = conectar()
    cursor = conexion.cursor(dictionary=True)

    hoy = datetime.now().strftime("%Y-%m-%d")

    query = f"""
        SELECT *
        FROM clima_diario
        WHERE fecha = '{hoy}'
        LIMIT 1;
    """

    cursor.execute(query)
    resultado = cursor.fetchone()

    cursor.close()
    conexion.close()

    if resultado:
        return resultado
    else:
        return {"error": "No hay datos para hoy"}
