from fastapi import FastAPI
import joblib
import numpy as np

# Cargar modelo
modelo = joblib.load("modelos/modelo_estres.pkl")

app = FastAPI()

@app.get("/")
def home():
    return {"mensaje": "API de estrés hídrico funcionando"}

@app.post("/predecir_estres")
def predecir_estres(
    et0_diaria: float,
    radiacion_diaria: float,
    temperatura_media: float,
    humedad_media: float,
    viento_medio: float,
    precipitacion_diaria: float,
    estres_termico_medio: float
):
    datos = np.array([[et0_diaria, radiacion_diaria, temperatura_media,
                       humedad_media, viento_medio, precipitacion_diaria,
                       estres_termico_medio]])

    prediccion = modelo.predict(datos)[0]

    return {
        "estres_hidrico_estimado": float(prediccion)
    }
