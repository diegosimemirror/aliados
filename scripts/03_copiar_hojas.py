# ============================================================
# 03_copiar_hojas.py
# Guarda una copia (CSV) de las pestañas de Google Sheets que usa la web.
# La web lee las hojas en vivo; esta copia solo se usa si la lectura en vivo falla
# (sin internet, hoja privada o Google no responde).
#
# Uso:    python scripts/03_copiar_hojas.py      (luego: git add datos/copia && git commit)
# Insumo: hojas FEN_2026_2027 e Identificacion_Aliados_Essalud (compartidas como lector)
# Resultado: datos/copia/radar.csv, demanda.csv, aliados.csv, oferta.csv, tipologias.csv
# ============================================================

# --- Paquetes (vienen con Python; no hay que instalar nada) ---
import csv                         # csv: leer y escribir tablas de texto
import io                          # io: tratar un texto descargado como si fuera un archivo
import urllib.parse                # urllib.parse: armar la dirección de descarga
import urllib.request              # urllib.request: descargar desde internet
from pathlib import Path           # pathlib: armar rutas
from openpyxl import load_workbook # openpyxl: leer los encabezados de las plantillas (respaldo)

RAIZ = Path(__file__).resolve().parent.parent
COPIA = RAIZ / "datos" / "copia"
COPIA.mkdir(parents=True, exist_ok=True)

HOJAS = {"fen": "1YE-9gXDLxJOuHyfflAFxznstzzi1sihIF3RiLt6zp5c",
         "aliados": "1NYboI4a8f3SYIUpmPrKBunqqmcSTwwL6GylItubkLIE"}
PESTANAS = {"Radar": ("fen", "FEN_2026_2027.xlsx"), "Demanda": ("fen", "FEN_2026_2027.xlsx"),
            "Aliados": ("aliados", "Identificacion_Aliados_Essalud.xlsx"),
            "Oferta": ("aliados", "Identificacion_Aliados_Essalud.xlsx"),
            "Tipologias": ("aliados", "Identificacion_Aliados_Essalud.xlsx")}

# ============================================================
# PROCESO 1: Descargar cada pestaña como CSV
# Insumo:    hoja de Google (pública como lector)
# Resultado: un archivo CSV por pestaña en datos/copia/
# ============================================================
for pestana, (clave, plantilla) in PESTANAS.items():
    url = (f"https://docs.google.com/spreadsheets/d/{HOJAS[clave]}/gviz/tq?tqx=out:csv&headers=1&sheet="
           + urllib.parse.quote(pestana))
    destino = COPIA / f"{pestana.lower()}.csv"
    try:
        # urlopen(): descarga el texto CSV de la pestaña
        with urllib.request.urlopen(url, timeout=30) as r:
            texto = r.read().decode("utf-8")
        if texto.lstrip().startswith("<"):
            raise ValueError("Google devolvió una página web: la hoja no está compartida como lector")
        filas = [f for f in csv.reader(io.StringIO(texto)) if any(c.strip() for c in f)]
        origen = "hoja en vivo"
    except Exception as error:
        # Respaldo: el contenido de la plantilla (encabezados y, en Tipologias, las definiciones)
        hoja = load_workbook(RAIZ / "plantillas" / plantilla, read_only=True)[pestana]
        filas = [["" if c is None else c for c in r] for r in hoja.iter_rows(values_only=True) if any(r)]
        origen = f"contenido de la plantilla ({error})"
    with open(destino, "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows(filas)
    # Verificación: cuántas filas de datos (sin contar el encabezado) quedaron guardadas
    print(f"{pestana:11s} → {destino.name}: {len(filas) - 1} filas de datos · {origen}")
