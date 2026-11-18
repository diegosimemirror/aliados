# ============================================================
# 01_preparar_datos.py
# Prepara los datos fijos de la web: el mapa distrital y la capa "FEN histórico".
#
# Uso (desde la carpeta del repositorio):
#   python scripts/01_preparar_datos.py
# Si los archivos de origen están en otra ruta (por ejemplo en la laptop), indícalas:
#   python scripts/01_preparar_datos.py --mapa "<ruta .gpkg>" --matriz "<ruta .xlsx>"
#
# Resultados (carpeta datos/):
#   mapa.json              distritos y departamentos como trazos SVG
#   fen_historico.json     escenarios de la matriz y distritos de cada escenario
#   fen_historico_distritos.csv   la misma vinculación en tabla, para revisarla en Excel
#   catalogo_lugares.csv   lista de lugares (país, departamentos, provincias, distritos)
# ============================================================

# --- Paquetes (ya vienen con Anaconda; aquí solo se cargan) ---
import argparse                 # argparse: leer las rutas de entrada desde la línea de comandos
import csv                      # csv: escribir tablas de texto separadas por comas
import json                     # json: escribir los datos en el formato que lee la web
import unicodedata              # unicodedata: quitar tildes para comparar nombres
from pathlib import Path        # pathlib: armar rutas de archivos

import geopandas as gpd         # geopandas: leer el mapa y trabajar con polígonos como tablas
import openpyxl                 # openpyxl: leer el Excel de la matriz de escenarios
import pandas as pd             # pandas: unir y resumir tablas
import shapely                  # shapely: simplificar, unir y medir polígonos
from shapely.ops import polylabel  # polylabel: punto interior para ubicar etiquetas

RAIZ = Path(__file__).resolve().parent.parent
DATOS = RAIZ / "datos"

argumentos = argparse.ArgumentParser()
argumentos.add_argument("--mapa", default=r"G:\Mi unidad\1_Comun\14_Mapa_Peru_Distrito\peru_distritos_1892_2025.gpkg")
argumentos.add_argument("--matriz", default=r"G:\Mi unidad\1_Comun\13_Py_FEN\Matriz_Escenarios_El_Nino_2026-2027_MIDIS.xlsx")
rutas = argumentos.parse_args()


def normalizar(texto):
    """Pasa un nombre a MAYÚSCULAS, sin tildes y con espacios simples, para comparar.
    Antes: 'Veintiséis de Octubre ' | Después: 'VEINTISEIS DE OCTUBRE'"""
    texto = unicodedata.normalize("NFD", str(texto or ""))
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return " ".join(texto.replace("-", " ").upper().split())


# ============================================================
# PROCESO 1: Cargar el mapa distrital
# Insumo:    peru_distritos_1892_2025.gpkg (INEI, 1892 distritos, WGS84)
# Resultado: distritos (1892 filas: UBIGEO, nombres y polígono)
# ============================================================
# gpd.read_file(): convierte el archivo en una tabla con una fila por distrito
distritos = gpd.read_file(rutas.mapa)
# to_crs(32718): pasa de grados (latitud/longitud) a metros (UTM zona 18 Sur),
#   necesario para simplificar en metros y dibujar sin deformar el país
distritos = distritos.to_crs(32718).sort_values("UBIGEO").reset_index(drop=True)
print("Proceso 1 - distritos:", distritos.shape)

# ============================================================
# PROCESO 2: Simplificar los contornos sin abrir huecos entre vecinos
# Insumo:    distritos (1,7 millones de vértices)
# Resultado: geometria_simple (unos 260 mil vértices; bordes compartidos idénticos)
# ============================================================
# shapely.coverage_simplify(): quita vértices que se apartan menos de ~200 m de la línea.
#   Trata el mapa como un rompecabezas: el borde entre dos distritos se simplifica una
#   sola vez, así que no aparecen huecos ni solapes entre vecinos.
geometria_simple = shapely.coverage_simplify(distritos.geometry.values, tolerance=200, simplify_boundary=True)
print("Proceso 2 - vértices:", int(shapely.get_num_coordinates(distritos.geometry.values).sum()),
      "→", int(shapely.get_num_coordinates(geometria_simple).sum()))

# ============================================================
# PROCESO 3: Formar los departamentos uniendo sus distritos
# Insumo:    geometria_simple + código de departamento (CCDD)
# Resultado: departamentos (25 polígonos)
# ============================================================
# shapely.coverage_union_all(): junta los distritos de un departamento en un solo polígono
distritos["geom_simple"] = geometria_simple
departamentos = []
for ccdd, grupo in distritos.groupby("CCDD"):
    departamentos.append({
        "c": ccdd,
        "n": grupo["DEPARTAMEN"].iloc[0],
        "geom": shapely.coverage_union_all(grupo["geom_simple"].values),
    })
print("Proceso 3 - departamentos:", len(departamentos))

# ============================================================
# PROCESO 4: Convertir los polígonos en trazos SVG para la web
# Insumo:    distritos y departamentos en metros
# Resultado: datos/mapa.json (1 unidad del dibujo = 100 m)
# ============================================================
# El dibujo usa coordenadas enteras: x crece hacia el este, y crece hacia el sur.
# Cada anillo se escribe como "M x y" + desplazamientos relativos "l dx dy" (ocupa menos).
xmin, ymin, xmax, ymax = shapely.total_bounds(geometria_simple)
ESCALA = 100  # metros por unidad


def a_unidades(x, y):
    return round((x - xmin) / ESCALA), round((ymax - y) / ESCALA)


def anillo_a_trazo(anillo):
    puntos = [a_unidades(x, y) for x, y in anillo.coords[:-1]]
    # se quitan puntos repetidos que aparecen al redondear
    limpios = [puntos[0]] + [p for i, p in enumerate(puntos[1:], 1) if p != puntos[i - 1]]
    if len(limpios) < 3:
        return ""
    trazo = [f"M{limpios[0][0]} {limpios[0][1]}"]
    pasos = [f"{b[0]-a[0]} {b[1]-a[1]}" for a, b in zip(limpios, limpios[1:])]
    return trazo[0] + "l" + " ".join(pasos) + "z"


def poligono_a_trazo(geom):
    partes = geom.geoms if geom.geom_type == "MultiPolygon" else [geom]
    trazos = []
    for parte in partes:
        trazos.append(anillo_a_trazo(parte.exterior))
        trazos.extend(anillo_a_trazo(hueco) for hueco in parte.interiors)
    return "".join(trazos)


def caja(geom):
    x0, y0, x1, y1 = geom.bounds
    a = a_unidades(x0, y1)
    b = a_unidades(x1, y0)
    return [a[0], a[1], b[0] - a[0], b[1] - a[1]]


def punto_etiqueta(geom):
    # polylabel(): punto más alejado del borde dentro del polígono más grande
    mayor = max(geom.geoms, key=lambda g: g.area) if geom.geom_type == "MultiPolygon" else geom
    p = polylabel(mayor, tolerance=500)
    return list(a_unidades(p.x, p.y))


mapa = {
    "nota": "Trazos SVG en UTM 18S; 1 unidad = 100 m. Fuente: INEI, límites distritales Censo 2025 (1892 distritos), vía geogpsperu.com",
    "vb": [0, 0, round((xmax - xmin) / ESCALA), round((ymax - ymin) / ESCALA)],
    # parámetros para llevar cualquier punto (p. ej. un establecimiento) a las mismas coordenadas del dibujo:
    #   x = (Este_UTM18S - xmin) / escala ;  y = (ymax - Norte_UTM18S) / escala
    "proy": {"crs": "EPSG:32718", "xmin": round(float(xmin), 2), "ymax": round(float(ymax), 2), "escala": ESCALA},
    "dep": [{"c": d["c"], "n": d["n"], "p": poligono_a_trazo(d["geom"]), "bb": caja(d["geom"]),
             "lc": punto_etiqueta(d["geom"])} for d in departamentos],
    "dis": [{"u": f.UBIGEO, "n": f.DISTRITO, "pr": f.PROVINCIA, "p": poligono_a_trazo(f.geom_simple)}
            for f in distritos.itertuples()],
}
DATOS.mkdir(exist_ok=True)
(DATOS / "mapa.json").write_text(json.dumps(mapa, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print("Proceso 4 - mapa.json:", round((DATOS / "mapa.json").stat().st_size / 1e6, 2), "MB")

# ============================================================
# PROCESO 5: Leer la matriz de escenarios El Niño 2026-2027
# Insumo:    hoja "Matriz" del Excel (encabezados en la fila 4, datos desde la fila 5)
# Resultado: escenarios (23 filas, una por escenario)
# ============================================================
# load_workbook(data_only=True): lee los valores (no las fórmulas) de cada celda
libro = openpyxl.load_workbook(rutas.matriz, data_only=True)
hoja = libro["Matriz"]
encabezados = [c.value for c in hoja[4]]
filas = [r for r in hoja.iter_rows(min_row=5, values_only=True) if isinstance(r[0], (int, float))]
escenarios = pd.DataFrame(filas, columns=encabezados)
escenarios["ID"] = escenarios["ID"].astype(int)
fecha_matriz = str(libro["Resumen"]["A2"].value or "")
print("Proceso 5 - escenarios:", escenarios.shape, "| IDs", escenarios["ID"].min(), "a", escenarios["ID"].max())

# ============================================================
# PROCESO 6: Vincular cada escenario con sus distritos (UBIGEO)
# Insumo:    datos/fuentes/escenarios_lugares.csv (tabla escrita a mano a partir del texto
#            de la columna "Provincias / distritos probables") + catálogo de distritos
# Resultado: vinculos (una fila por escenario y distrito) e informe de correcciones
# ============================================================
lugares = pd.read_csv(DATOS / "fuentes" / "escenarios_lugares.csv", dtype=str).fillna("")
catalogo = distritos[["UBIGEO", "DEPARTAMEN", "PROVINCIA", "DISTRITO"]].copy()
for col in ("DEPARTAMEN", "PROVINCIA", "DISTRITO"):
    catalogo["n_" + col] = catalogo[col].map(normalizar)

vinculos, avisos, sin_mapa = [], [], []
for fila in lugares.itertuples():
    esc = int(fila.id_escenario)
    if fila.cartografiado == "no":
        sin_mapa.append({"id": esc, "nota": fila.nota})
        continue
    en_dep = catalogo[catalogo["n_DEPARTAMEN"] == normalizar(fila.departamento)]
    if en_dep.empty:
        raise SystemExit(f"Departamento no encontrado: {fila.departamento} (escenario {esc})")
    if not fila.provincia:
        elegidos, nivel = en_dep, "departamento"
    else:
        en_prov = en_dep[en_dep["n_PROVINCIA"] == normalizar(fila.provincia)]
        if en_prov.empty:
            raise SystemExit(f"Provincia no encontrada: {fila.provincia} (escenario {esc})")
        if not fila.distrito:
            elegidos, nivel = en_prov, "provincia"
        else:
            nivel = "distrito"
            elegidos = en_prov[en_prov["n_DISTRITO"] == normalizar(fila.distrito)]
            if elegidos.empty:
                # si no está en la provincia indicada, se busca en todo el departamento
                elegidos = en_dep[en_dep["n_DISTRITO"] == normalizar(fila.distrito)]
                if len(elegidos) != 1:
                    raise SystemExit(f"Distrito no encontrado: {fila.distrito} (escenario {esc})")
                avisos.append(f"Escenario {esc}: {fila.distrito} está en la provincia "
                              f"{elegidos['PROVINCIA'].iloc[0]}, no en {fila.provincia.upper()}")
    for u in elegidos["UBIGEO"]:
        vinculos.append({"id_escenario": esc, "ubigeo": u, "nivel": nivel, "nota": fila.nota})

# Si un distrito entra dos veces en el mismo escenario (por nombre y por provincia completa),
# se conserva la entrada más precisa: distrito > provincia > departamento.
#   Antes: filas repetidas por escenario y distrito | Después: una sola fila por par
PRECISION = {"distrito": 0, "provincia": 1, "departamento": 2}
vinculos = (pd.DataFrame(vinculos)
            .sort_values("nivel", key=lambda s: s.map(PRECISION), kind="stable")
            .drop_duplicates(["id_escenario", "ubigeo"], keep="first"))
print("Proceso 6 - vínculos escenario-distrito:", len(vinculos),
      "| distritos distintos:", vinculos["ubigeo"].nunique())
for a in avisos:
    print("   corrección:", a)
print("   sin cartografiar:", [s["id"] for s in sin_mapa])

# ============================================================
# PROCESO 7: Exportar la capa "FEN histórico" para la web
# Insumo:    escenarios + vinculos
# Resultado: datos/fen_historico.json y datos/fen_historico_distritos.csv
# ============================================================
# No se publica la columna "Implicancias para MIDIS" (es propia de ese ministerio).
COLUMNAS = {"ID": "id", "Macrozona": "macrozona", "Departamento": "departamento",
            "Provincias / distritos probables": "lugares", "Periodo de riesgo": "periodo",
            "Pico esperado": "pico", "Fenómeno natural": "fenomeno", "Probabilidad": "probabilidad",
            "Daño potencial directo": "dano", "Efectos en cadena (suministros, servicios, salud, economía)": "efectos",
            "Riesgo de pérdida de vidas": "riesgo_vidas", "Población expuesta (dato oficial)": "poblacion",
            "Precedente histórico": "precedente", "Fuente / base": "fuente"}
# Tipos de riesgo del FEN: catálogo y clasificación de cada escenario (tablas editables en datos/fuentes/)
#   escenarios_riesgos.csv: '1,lluvias|huaicos' → el escenario 1 tiene dos tipos de riesgo
catalogo_riesgos = pd.read_csv(DATOS / "fuentes" / "riesgos_fen.csv", dtype=str).fillna("")
riesgos_por_escenario = pd.read_csv(DATOS / "fuentes" / "escenarios_riesgos.csv", dtype=str).fillna("")
riesgos_por_escenario = {int(f.id_escenario): f.riesgos.split("|") for f in riesgos_por_escenario.itertuples()}
claves_validas = set(catalogo_riesgos["clave"])
for esc_id, lista in riesgos_por_escenario.items():
    desconocidas = set(lista) - claves_validas
    if desconocidas:
        raise SystemExit(f"Escenario {esc_id}: tipo de riesgo desconocido {desconocidas}")
print("Proceso 7 - tipos de riesgo:", len(catalogo_riesgos), "| escenarios clasificados:", len(riesgos_por_escenario))

salida = []
for e in escenarios.rename(columns=COLUMNAS)[list(COLUMNAS.values())].to_dict("records"):
    propios = vinculos[vinculos["id_escenario"] == e["id"]]
    e = {k: ("" if v is None else str(v).strip()) if k != "id" else v for k, v in e.items()}
    e["ubigeos"] = sorted(propios["ubigeo"])
    # distritos escritos uno por uno en la matriz (los demás entran por provincia o departamento completo)
    e["nombrados"] = sorted(propios.loc[propios["nivel"] == "distrito", "ubigeo"])
    e["niveles"] = sorted(propios["nivel"].unique().tolist())
    e["riesgos"] = riesgos_por_escenario.get(e["id"], [])
    e["sin_mapa"] = [s["nota"] for s in sin_mapa if s["id"] == e["id"]]
    e["notas"] = sorted({n for n in propios["nota"] if n})
    salida.append(e)

fen_historico = {
    "fuente": "Matriz de escenarios de riesgo El Niño 2026-2027 (MIDIS). " + fecha_matriz,
    "advertencia": "Los distritos son los 'probables' según exposición histórica (1998, 2017, 2023) y escenarios CENEPRED; no es una lista oficial.",
    "escenarios": salida,
    "correcciones": avisos,
    "riesgos": [dict(r, fenomenos_radar=r["fenomenos_radar"].split("|")) for r in catalogo_riesgos.to_dict("records")],
}
(DATOS / "fen_historico.json").write_text(json.dumps(fen_historico, ensure_ascii=False, indent=1), encoding="utf-8")
# merge(): agrega los nombres del distrito a cada vínculo (como BUSCARV en Excel)
tabla_revision = vinculos.merge(catalogo[["UBIGEO", "DEPARTAMEN", "PROVINCIA", "DISTRITO"]],
                                left_on="ubigeo", right_on="UBIGEO").drop(columns="UBIGEO")
tabla_revision.to_csv(DATOS / "fen_historico_distritos.csv", index=False, encoding="utf-8-sig")
print("Proceso 7 - fen_historico.json:", len(salida), "escenarios")

# ============================================================
# PROCESO 8: Catálogo de lugares para las listas desplegables de Google Sheets
# Insumo:    distritos (códigos y nombres)
# Resultado: datos/catalogo_lugares.csv (país + 25 departamentos + 196 provincias + 1892 distritos)
# ============================================================
# La etiqueta termina con el código entre paréntesis: la web lo lee de ahí.
#   Ejemplo: "PIURA › SULLANA › BELLAVISTA (200602)"
registros = [{"etiqueta": "PERÚ › TODO EL PAÍS (00)", "codigo": "00", "nivel": "País",
              "departamento": "", "provincia": "", "distrito": ""}]
for ccdd, g in distritos.groupby("CCDD"):
    dep = g["DEPARTAMEN"].iloc[0]
    registros.append({"etiqueta": f"{dep} ({ccdd})", "codigo": ccdd, "nivel": "Departamento",
                      "departamento": dep, "provincia": "", "distrito": ""})
    for ccpp, gp in g.groupby("CCPP"):
        prov = gp["PROVINCIA"].iloc[0]
        registros.append({"etiqueta": f"{dep} › {prov} ({ccdd}{ccpp})", "codigo": ccdd + ccpp,
                          "nivel": "Provincia", "departamento": dep, "provincia": prov, "distrito": ""})
        for f in gp.itertuples():
            registros.append({"etiqueta": f"{dep} › {prov} › {f.DISTRITO} ({f.UBIGEO})", "codigo": f.UBIGEO,
                              "nivel": "Distrito", "departamento": dep, "provincia": prov, "distrito": f.DISTRITO})
catalogo_lugares = pd.DataFrame(registros)
catalogo_lugares.to_csv(DATOS / "catalogo_lugares.csv", index=False, encoding="utf-8")
print("Proceso 8 - catálogo de lugares:", catalogo_lugares.shape,
      catalogo_lugares["nivel"].value_counts().to_dict())
