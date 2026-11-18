# CLAUDE.md · proyecto «aliados» (EsSalud · FEN 2026-2027)

Contexto para continuar este proyecto con Claude Code en cualquier computadora (PC de escritorio o laptop). Las preferencias generales del usuario están en su `~/.claude/CLAUDE.md` de cada máquina: explicar en español, código comentado por procesos numerados (insumo → método → resultado), nombres en español y no modificar datos sin decir cuántos registros se afectan.

## Qué es
Web estática (GitHub Pages) de la oficina de cooperación internacional de EsSalud para buscar cooperación ante el FEN 2026-2027. Decisión que informa: a qué aliado pedir qué apoyo y para qué zona.

**Regla permanente:** reconocer siempre a la web de aliados del MIDIS (https://claude.ai/artifact/XCFnRvFZUEnCZ79exZgucG) como la referencia de arquitectura y conceptualización: en el pie de página, en el pipeline (nodo «Referencia», cable rojo punteado) y en el README. Sin logo por ahora y sin la ilustración de lluvia y casa de la web del MIDIS; fondo neutro `assets/fondo.svg`.

## Piezas
- `scripts/01_preparar_datos.py` (P1–P8): mapa distrital → `datos/mapa.json`; matriz de escenarios + `datos/fuentes/escenarios_lugares.csv` → `datos/fen_historico.json`; catálogo de lugares.
  - Insumos por defecto: `G:\Mi unidad\1_Comun\14_Mapa_Peru_Distrito\peru_distritos_1892_2025.gpkg` y `G:\Mi unidad\1_Comun\13_Py_FEN\Matriz_Escenarios_El_Nino_2026-2027_MIDIS.xlsx`. En otra máquina, usar `--mapa` y `--matriz`.
- `scripts/02_crear_plantillas.py` (P9): estructura de las dos hojas de Google (`plantillas/*.xlsx`). Se importan con Archivo › Importar › Subir › «Reemplazar hoja de cálculo», para conservar el ID de la hoja.
- `scripts/03_copiar_hojas.py` (P10): copia CSV de las pestañas en `datos/copia/`; la web la usa si falla la lectura en vivo.
- `assets/app.js` (W1–W9): lee las hojas en vivo con `gviz/tq?tqx=out:csv&sheet=<pestaña>` cada 5 min; mapa SVG con zoom; panel; secciones; pipeline estilo n8n (`NODOS` y `CABLES` en W8: si cambia el flujo, actualizar ahí y en el diagrama Mermaid del README).
- Python: Anaconda (`C:\Users\Principal\anaconda3\python.exe` en la PC; geopandas, shapely ≥ 2.1, openpyxl).

## Hojas de Google (dueño: cuenta del usuario; compartidas como lector para la web)
- FEN_2026_2027 `1YE-9gXDLxJOuHyfflAFxznstzzi1sihIF3RiLt6zp5c`: LEEME, Radar, Demanda, Listas, Lugares.
- Identificacion_Aliados_Essalud `1NYboI4a8f3SYIUpmPrKBunqqmcSTwwL6GylItubkLIE`: LEEME, Aliados, Oferta, Tipologias, Listas, Lugares.
- El lugar se elige de un desplegable que termina en «(código)»: 00 país, 2 dígitos departamento, 4 provincia, 6 distrito. La web lee el código con una expresión regular.
- La web busca pestañas y columnas por nombre: no renombrarlas sin cambiar `app.js` (W3).
- Las hojas son públicas con el enlace: no agregar columnas de datos personales.

## Decisiones tomadas
- Capa FEN histórico: 753 distritos (135 nombrados uno por uno; el resto por provincia o departamento completo). Casilla «Solo distritos nombrados». Detalle de las interpretaciones en el README.
- Colores validados con el script de la guía dataviz: azul = FEN histórico (Media/Alta/Muy alta), naranja = FEN 2026-27 (Bajo…Muy alto), franjas = ambas capas.
- Tipologías: las 4 del MIDIS + Financiero y Técnico (propuesta para EsSalud, editables en la pestaña Tipologias).
- No se publica la columna «Implicancias para MIDIS» de la matriz.

## Estado y pendientes (actualizar al cerrar cada sesión)
- 18/11/2026: web, scripts, plantillas y documentación creados en el repositorio. Ver en el README los pasos que faltan (importar las plantillas en las hojas, compartir como lector, activar GitHub Pages).
- Antes de editar: `git pull`. Para probar: `python -m http.server 8000` en la carpeta del repo.
