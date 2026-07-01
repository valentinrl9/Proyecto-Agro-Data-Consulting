import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
import joblib

from config import ROOT
from db import conectar

# 2. Consulta SQL
query = """
SELECT
    fecha,
    et0_diaria,
    radiacion_diaria,
    temperatura_media,
    humedad_media,
    viento_medio,
    precipitacion_diaria,
    estres_termico_medio
FROM clima_diario
ORDER BY fecha;
"""

df = pd.read_sql(query, conectar())
print("Filas cargadas:", len(df))

# 3. Crear variable objetivo: Índice de Estrés Hídrico (ISH)
df["ISH"] = (
    0.6 * df["et0_diaria"] +
    0.3 * (df["temperatura_media"] / 10) -
    0.5 * (df["humedad_media"] / 100) +
    0.2 * (df["viento_medio"] / 5) -
    0.4 * (df["precipitacion_diaria"] / 10)
)

# 4. Preparar dataset
df = df.dropna()

X = df[[
    "et0_diaria",
    "radiacion_diaria",
    "temperatura_media",
    "humedad_media",
    "viento_medio",
    "precipitacion_diaria",
    "estres_termico_medio"
]]

y = df["ISH"]

# 5. Entrenar modelo
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

modelo = RandomForestRegressor(
    n_estimators=300,
    max_depth=12,
    random_state=42
)

modelo.fit(X_train, y_train)

pred = modelo.predict(X_test)
mae = mean_absolute_error(y_test, pred)

print("Error MAE:", mae)

# 6. Guardar modelo
joblib.dump(modelo, ROOT / "modelos" / "modelo_estres.pkl")
print("Modelo guardado en modelos/modelo_estres.pkl")
