# ============================================================
# 04_establecimientos_essalud.py
# Ubica en el mapa los establecimientos de salud de EsSalud.
#
# Uso:   python scripts/04_establecimientos_essalud.py
#        python scripts/04_establecimientos_essalud.py --renipress "<ruta del CSV>"
# Insumo: RENIPRESS de SUSALUD (datosabiertos.gob.pe, «Registro Nacional de Entidades
#         Prestadoras de Servicios de Salud - RENIPRESS», corte 30/10/2026; licencia ODC-BY)
#         + mapa distrital (para verificar que cada punto cae en su distrito)
#         + datos/mapa.json (parámetros de proyección del dibujo)
# Resultado: datos/essalud_establecimientos.json (para la web)
#            datos/essalud_establecimientos.csv  (todos los de EsSalud, con sus marcas, para revisar)
# ============================================================

# --- Paquetes (ya vienen con Anaconda; aquí solo se cargan) ---
import argparse                  # argparse: leer rutas desde la línea de comandos
import json                      # json: leer mapa.json y escribir el resultado para la web
from pathlib import Path         # pathlib: armar rutas
import geopandas as gpd          # geopandas: puntos y polígonos como tablas; cruce espacial
import pandas as pd              # pandas: leer y filtrar el CSV

RAIZ = Path(__file__).resolve().parent.parent
DATOS = RAIZ / "datos"
argumentos = argparse.ArgumentParser()
argumentos.add_argument("--renipress", default=r"G:\Mi unidad\1_Comun\13_Py_FEN\fuentes\RENIPRESS_30-10-2026.csv")
argumentos.add_argument("--mapa", default=r"G:\Mi unidad\1_Comun\14_Mapa_Peru_Distrito\peru_distritos_1892_2025.gpkg")
rutas = argumentos.parse_args()

# ============================================================
# PROCESO 1: Cargar el RENIPRESS
# Insumo:    CSV separado por punto y coma, UTF-8 con BOM, 36 246 filas
# Resultado: renipress (todas las IPRESS del país, todo como texto)
# ============================================================
# dtype=str: lee todo como texto para no perder ceros iniciales (UBIGEO 010101, COD_IPRESS 00002806)
renipress = pd.read_csv(rutas.renipress, sep=";", dtype=str, encoding="utf-8-sig")
print("Proceso 1 - RENIPRESS:", renipress.shape)

# ============================================================
# PROCESO 2: Quedarse con EsSalud
# Insumo:    renipress
# Resultado: essalud (495 filas: las de INSTITUCION = ESSALUD)
# ============================================================
# Filtro con condición: como "Filtrar" en Excel por la columna INSTITUCION
#   Antes: 36 246 filas | Después: solo las de EsSalud, mismas columnas
essalud = renipress[renipress["INSTITUCION"].str.strip().str.upper() == "ESSALUD"].copy()
print("Proceso 2 - EsSalud:", essalud.shape, "| por estado:", essalud["ESTADO"].value_counts().to_dict())

# ============================================================
# PROCESO 3: Coordenadas
# Insumo:    columnas NORTE y ESTE (a pesar del nombre, son latitud y longitud en grados)
# Resultado: columnas lat y lon numéricas + marca 'con_coordenadas'
# ============================================================
# pd.to_numeric(): convierte el texto en número; lo que no es número queda vacío (NaN)
essalud["lat"] = pd.to_numeric(essalud["NORTE"], errors="coerce")
essalud["lon"] = pd.to_numeric(essalud["ESTE"], errors="coerce")
# Se aceptan solo coordenadas dentro del recuadro del Perú
essalud["con_coordenadas"] = essalud["lat"].between(-18.6, 0.1) & essalud["lon"].between(-81.5, -68.5)
print("Proceso 3 - con coordenadas válidas:", int(essalud["con_coordenadas"].sum()),
      "| sin coordenadas:", int((~essalud["con_coordenadas"]).sum()))

# ============================================================
# PROCESO 4: Verificar que cada punto cae en el distrito que declara
# Insumo:    puntos con coordenadas + polígonos distritales
# Resultado: columna ubigeo_punto (distrito donde cae el punto) y marca 'distrito_coincide'
# ============================================================
distritos = gpd.read_file(rutas.mapa)[["UBIGEO", "geometry"]]
puntos = gpd.GeoDataFrame(essalud[essalud["con_coordenadas"]],
                          geometry=gpd.points_from_xy(essalud.loc[essalud["con_coordenadas"], "lon"],
                                                      essalud.loc[essalud["con_coordenadas"], "lat"]), crs=4326)
# sjoin(): cruce espacial; a cada punto le pega el UBIGEO del polígono que lo contiene
#   Antes: puntos sin distrito calculado | Después: puntos con 'UBIGEO_right' (vacío si cae fuera, p. ej. en el mar)
cruce = gpd.sjoin(puntos, distritos, how="left", predicate="within")
essalud["ubigeo_punto"] = cruce["UBIGEO_right"]
essalud["distrito_coincide"] = essalud["ubigeo_punto"] == essalud["UBIGEO"]
con = essalud["con_coordenadas"]
print("Proceso 4 - el punto cae en su distrito declarado:", int(essalud.loc[con, "distrito_coincide"].sum()),
      "| en otro distrito:", int((con & essalud["ubigeo_punto"].notna() & ~essalud["distrito_coincide"]).sum()),
      "| fuera de todo distrito (mar):", int((con & essalud["ubigeo_punto"].isna()).sum()))

# ============================================================
# PROCESO 5: Nivel de atención según la categoría
# Insumo:    CATEGORIA (I-1 … III-E; '0' = sin categoría)
# Resultado: columna nivel (1, 2, 3 o 0) para el tamaño del símbolo
# ============================================================
def nivel_de(categoria):
    c = str(categoria or "").strip().upper()
    return 3 if c.startswith("III") else 2 if c.startswith("II") else 1 if c.startswith("I") else 0

essalud["nivel"] = essalud["CATEGORIA"].map(nivel_de)
print("Proceso 5 - por nivel:", essalud["nivel"].value_counts().sort_index().to_dict())

# ============================================================
# PROCESO 6: Llevar los puntos a las coordenadas del dibujo de la web
# Insumo:    lat/lon + parámetros 'proy' de datos/mapa.json (UTM 18S, 1 unidad = 100 m)
# Resultado: columnas x, y (enteras, en el mismo sistema que los trazos de los distritos)
# ============================================================
proy = json.loads((DATOS / "mapa.json").read_text(encoding="utf-8"))["proy"]
metros = puntos.to_crs(proy["crs"])
essalud.loc[con, "x"] = ((metros.geometry.x - proy["xmin"]) / proy["escala"]).round().values
essalud.loc[con, "y"] = ((proy["ymax"] - metros.geometry.y) / proy["escala"]).round().values

# ============================================================
# PROCESO 7: Exportar
# Insumo:    essalud con todas las marcas
# Resultado: JSON para la web (solo ACTIVOS) y CSV de revisión (los 495, con estado y marcas)
# ============================================================
activos = essalud[essalud["ESTADO"].str.upper() == "ACTIVO"]
registros = []
for f in activos.itertuples():
    r = {"c": f.COD_IPRESS, "n": f.NOMBRE, "cl": f.CLASIFICACION if isinstance(f.CLASIFICACION, str) else "",
         "ca": f.CATEGORIA, "nv": int(f.nivel), "u": f.UBIGEO}
    if f.con_coordenadas:
        r.update({"x": int(f.x), "y": int(f.y)})
        if not f.distrito_coincide:
            r["otro"] = f.ubigeo_punto if isinstance(f.ubigeo_punto, str) else "fuera"
    registros.append(r)
salida = {
    "fuente": "SUSALUD, RENIPRESS al 30/10/2026 (datosabiertos.gob.pe, licencia ODC-BY). Solo establecimientos de EsSalud en estado ACTIVO.",
    "total_activos": len(registros),
    "sin_coordenadas": sum("x" not in r for r in registros),
    "establecimientos": registros,
}
(DATOS / "essalud_establecimientos.json").write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
columnas = ["COD_IPRESS", "NOMBRE", "CLASIFICACION", "CATEGORIA", "nivel", "ESTADO", "DEPARTAMENTO", "PROVINCIA",
            "DISTRITO", "UBIGEO", "DIRECCION", "lat", "lon", "con_coordenadas", "ubigeo_punto", "distrito_coincide"]
essalud[columnas].sort_values(["DEPARTAMENTO", "NOMBRE"]).to_csv(DATOS / "essalud_establecimientos.csv", index=False, encoding="utf-8-sig")
print("Proceso 7 - activos exportados:", len(registros), "| de ellos sin coordenadas:", salida["sin_coordenadas"])
