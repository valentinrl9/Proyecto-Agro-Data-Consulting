import pandas as pd
import numpy as np

# Rutas de los archivos
HISTORICO = "C:/ProyectoIA/datos/openmeteo_historico.csv"
REALTIME = "C:/ProyectoIA/datos/openmeteo_realtime.csv"
SALIDA = "C:/ProyectoIA/datos/openmeteo_dataset_final.csv"

print("Cargando histórico acumulado...")
df_hist = pd.read_csv(HISTORICO)

print("Cargando datos actuales...")
df_rt = pd.read_csv(REALTIME)

# -----------------------------
# 🔥 PROTECCIÓN: si ET0 del realtime viene a 0, convertirlo en NaN
# (solo si tú no lo calculas correctamente)
# -----------------------------
df_rt.loc[df_rt["et0_fao_evapotranspiration"] == 0, "et0_fao_evapotranspiration"] = np.nan

# -----------------------------
# 🔥 UNIFICAR (histórico + realtime)
# -----------------------------
df_final = pd.concat([df_hist, df_rt], ignore_index=True)

# Ordenar por fecha
df_final["timestamp"] = pd.to_datetime(df_final["timestamp"])
df_final = df_final.sort_values("timestamp")

# -----------------------------
# 🔥 ELIMINAR DUPLICADOS POR TIMESTAMP
# Mantiene la última versión (la del realtime si coincide)
# -----------------------------
df_final = df_final.drop_duplicates(subset=["timestamp"], keep="last")

# -----------------------------
# 🔥 RELLENAR ET0 FALTANTE (si Pentaho lo recalcula)
# -----------------------------
# Si Pentaho calcula ET0 diario, no rellenamos nada aquí.
# Si quisieras rellenar ET0 horario, aquí se haría.
# -----------------------------

# Guardar histórico actualizado (acumulativo)
df_final.to_csv(HISTORICO, index=False, encoding="utf-8")

# Guardar dataset final para Pentaho
df_final.to_csv(SALIDA, index=False, encoding="utf-8")

print("Histórico actualizado y dataset final generados correctamente.")
print(f"Total de filas: {len(df_final)}")
