import pandas as pd
import mysql.connector
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
import joblib

# 1. Conexión a MySQL
conexion = mysql.connector.connect(
    host="localhost",
    user="root",
    password="Valentin.09",
    database="clima",
    port=3307
)

# 2. Consulta SQL completa (sin límite)
query = """
SELECT
    fecha,
    et0_diaria,
    radiacion_diaria,
    temperatura_media,
    humedad_media,
    viento_medio,
    precipitacion_diaria,
    estres_termico_medio,
    (et0_diaria * 1.0) AS riego_base
FROM clima_diario
ORDER BY fecha;
"""

# 3. Cargar dataset completo
df = pd.read_sql(query, conexion)

# 4. Mostrar tamaño real del dataset
print("Filas cargadas:", len(df))
df.head()

# ============================
# 5. Preparación del dataset
# ============================

df['fecha'] = pd.to_datetime(df['fecha'])
df = df.sort_values('fecha')
df = df.dropna()

X = df[['et0_diaria', 'radiacion_diaria', 'temperatura_media',
        'humedad_media', 'viento_medio', 'precipitacion_diaria',
        'estres_termico_medio']]

y = df['riego_base']

# ============================
# 6. Entrenamiento del modelo
# ============================

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

modelo = RandomForestRegressor(
    n_estimators=300,
    max_depth=12,
    random_state=42
)

modelo.fit(X_train, y_train)

predicciones = modelo.predict(X_test)
mae = mean_absolute_error(y_test, predicciones)

print("Error MAE:", mae)

# ============================
# 7. Guardar el modelo entrenado
# ============================

joblib.dump(modelo, "modelos/modelo_riego.pkl")
print("Modelo guardado en modelos/modelo_riego.pkl")
