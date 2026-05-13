from fastapi import FastAPI
import joblib
import numpy as np

# Cargar el modelo entrenado
modelo = joblib.load("modelos/modelo_riego.pkl")

app = FastAPI()

@app.get("/")
def home():
    return {"mensaje": "API de riego funcionando"}

@app.post("/predecir_riego")
def predecir_riego(
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
        "riego_recomendado": float(prediccion)
    }
