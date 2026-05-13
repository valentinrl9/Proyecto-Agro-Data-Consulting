import pandas as pd

# Rutas de los archivos
HISTORICO = "C:/ProyectoIA/datos/openmeteo_historico.csv"
REALTIME = "C:/ProyectoIA/datos/openmeteo_realtime.csv"
SALIDA = "C:/ProyectoIA/datos/openmeteo_dataset_final.csv"

print("Cargando histórico acumulado...")
df_hist = pd.read_csv(HISTORICO)

print("Cargando datos actuales...")
df_rt = pd.read_csv(REALTIME)

# Unificar datasets (histórico + realtime)
df_final = pd.concat([df_hist, df_rt], ignore_index=True)

# Ordenar por fecha
df_final = df_final.sort_values("timestamp")

# 🔥 ELIMINAR DUPLICADOS POR TIMESTAMP
# Mantiene la última versión (la del realtime si coincide)
df_final = df_final.drop_duplicates(subset=["timestamp"], keep="last")

# Guardar histórico actualizado (acumulativo)
df_final.to_csv(HISTORICO, index=False, encoding="utf-8")

# Guardar dataset final para Pentaho
df_final.to_csv(SALIDA, index=False, encoding="utf-8")

print("Histórico actualizado y dataset final generados correctamente.")
print(f"Total de filas: {len(df_final)}")


