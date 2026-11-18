# ============================================================
# 02_crear_plantillas.py
# Crea la estructura (columnas, listas desplegables e instrucciones) de las dos bases
# que alimentan la web. Se generan como Excel y luego se importan a Google Sheets con
# Archivo › Importar › Subir › "Reemplazar hoja de cálculo" (así se conserva el enlace).
#
# Uso:    python scripts/02_crear_plantillas.py
# Insumo: datos/catalogo_lugares.csv (creado por 01_preparar_datos.py)
# Resultado (carpeta plantillas/):
#   FEN_2026_2027.xlsx                    → hoja "FEN_2026_2027" (radar de noticias + demanda)
#   Identificacion_Aliados_Essalud.xlsx   → hoja "Identificacion_Aliados_Essalud" (aliados + oferta)
# ============================================================

# --- Paquetes (ya vienen con Anaconda) ---
import csv                                   # csv: leer el catálogo de lugares
from pathlib import Path                     # pathlib: armar rutas
from openpyxl import Workbook                # openpyxl: crear archivos de Excel
from openpyxl.comments import Comment        #   Comment: nota explicativa en cada encabezado
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation  # listas desplegables

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "plantillas"
SALIDA.mkdir(exist_ok=True)
FILAS = 1000                                  # filas con listas desplegables preparadas

# ============================================================
# PROCESO 1: Definir las listas de valores (catálogos)
# Insumo:    criterios del proyecto
# Resultado: diccionario LISTAS (una lista por columna con desplegable)
# ============================================================
CATEGORIAS = ["Medicamentos e insumos médicos", "Equipamiento médico",
              "Infraestructura y rehabilitación de establecimientos", "Personal de salud y brigadas",
              "Hospitales de campaña y módulos temporales", "Agua, saneamiento e higiene",
              "Control vectorial y dengue", "Salud mental y apoyo psicosocial", "Logística y transporte",
              "Albergue, abrigo y alimentos", "Asistencia técnica y capacitación", "Financiamiento", "Otro"]
TIPOLOGIAS = [
    ("Donante", "Organización que proporciona gratuitamente bienes, recursos o servicios para atender las necesidades de la población afectada por emergencias.",
     "Alimentos, agua, kits de higiene, frazadas, carpas, medicamentos y servicios especializados.", "MIDIS"),
    ("Voluntario", "Organización que moviliza personas para brindar apoyo voluntario mediante actividades físicas, técnicas o profesionales durante situaciones de emergencia.",
     "Carga y descarga de bienes, distribución de ayuda, limpieza, remoción de escombros, atención psicológica y asistencia comunitaria.", "MIDIS"),
    ("Logístico", "Organización que proporciona medios, infraestructura o servicios operativos para facilitar el traslado, almacenamiento y distribución de ayuda humanitaria.",
     "Transporte terrestre, aéreo o marítimo, almacenes, vehículos, maquinaria pesada y distribución de suministros.", "MIDIS"),
    ("Articulador", "Organización que facilita la coordinación y vinculación entre instituciones públicas, empresas y organizaciones de la sociedad civil para movilizar recursos y canalizar apoyo ante emergencias.",
     "Convocatoria de donantes, coordinación de alianzas, identificación de recursos disponibles y vinculación entre quienes ofrecen apoyo y quienes lo requieren.", "MIDIS"),
    ("Financiero", "Organización que aporta recursos financieros —donaciones dinerarias, fondos de emergencia o préstamos— para la respuesta o la recuperación.",
     "Fondos de respuesta rápida, donaciones en efectivo, préstamos contingentes y financiamiento de la reconstrucción de establecimientos.", "Propuesta EsSalud (editable)"),
    ("Técnico", "Organización que aporta conocimiento especializado: expertos, asistencia técnica, capacitación o evaluación de daños en salud.",
     "Equipos médicos de emergencia, epidemiólogos, evaluación de establecimientos de salud, protocolos y capacitación del personal.", "Propuesta EsSalud (editable)"),
]
LISTAS = {
    "fenomeno": ["Lluvias intensas", "Inundación o desborde de río", "Huaico o deslizamiento",
                 "Activación de quebradas", "Sequía", "Heladas o friaje", "Calor extremo", "Oleaje anómalo",
                 "Dengue", "Otra enfermedad (EDA, leptospirosis, IRA)", "Otro"],
    "nivel_afectacion": ["Bajo", "Medio", "Alto", "Muy alto"],
    "afectacion_salud": ["Establecimiento de salud dañado o inoperativo", "Interrupción de servicios de salud",
                         "Brote o epidemia", "Personas heridas o fallecidas", "Acceso a salud cortado (vías)",
                         "Sin afectación en salud reportada"],
    "tipo_fuente": ["Oficial (INDECI, COEN, ENFEN, MINSA, gobierno regional)", "Prensa", "Redes sociales",
                    "Reporte interno EsSalud"],
    "si_no": ["Sí", "No"],
    "categoria": CATEGORIAS,
    "moneda": ["PEN", "USD", "EUR"],
    "prioridad": ["Alta", "Media", "Baja"],
    "estado_demanda": ["Identificada", "En gestión", "Cubierta parcialmente", "Cubierta", "Descartada"],
    "origen_demanda": ["Red asistencial EsSalud", "Noticia del radar", "COE o INDECI", "Informe técnico", "Otro"],
    "tipologia": [t[0] for t in TIPOLOGIAS],
    "tipo_actor": ["Cooperación bilateral (agencia o embajada)", "Organismo multilateral", "Sistema de Naciones Unidas",
                   "Banca de desarrollo", "ONG internacional", "ONG nacional", "Fundación", "Empresa privada",
                   "Gremio empresarial", "Universidad o centro de investigación", "Organización religiosa", "Otro"],
    "estado_relacion": ["Identificado", "Primer contacto", "En conversación", "Compromiso de apoyo",
                        "Acuerdo o convenio firmado", "En ejecución", "Cerrado", "Descartado"],
    "nivel_emergencia": ["Sin nivel específico", "Nivel 3", "Niveles 4 y 5", "Nivel 5"],
    "modalidad": ["Donación en especie", "Donación dineraria", "Préstamo", "Asistencia técnica", "Voluntariado",
                  "Servicio logístico", "Articulación con otros actores", "Otro"],
    "estado_oferta": ["Ofrecida", "Confirmada", "Asignada a una demanda", "Entregada", "No disponible"],
}

# ============================================================
# PROCESO 2: Definir las columnas de cada pestaña
# Insumo:    criterios del proyecto
# Resultado: listas de (columna, ancho, explicación, lista desplegable, formato)
# ============================================================
# Cada columna: (nombre, ancho, nota del encabezado, nombre de lista o None, formato)
LUGAR = "lugar"  # marca especial: desplegable con los 2114 lugares de la pestaña Lugares
RADAR = [
    ("id_noticia", 12, "Código de la noticia, p. ej. N-0001. Si una noticia menciona varios lugares, usa una fila por lugar con el mismo código.", None, "@"),
    ("fecha_noticia", 13, "Fecha de publicación de la noticia (AAAA-MM-DD).", None, "yyyy-mm-dd"),
    ("lugar", 46, "Elige de la lista: distrito, provincia, departamento o todo el país. Escribe para buscar (p. ej. 'SULLANA'). El código entre paréntesis es el UBIGEO que usa la web.", LUGAR, "@"),
    ("fenomeno", 26, "Qué ocurrió.", "fenomeno", "@"),
    ("nivel_afectacion", 14, "Bajo: daños menores. Medio: viviendas o vías dañadas, servicios afectados en parte. Alto: damnificados, servicios de salud interrumpidos o aislamiento. Muy alto: víctimas fatales, colapso de servicios o estado de emergencia.", "nivel_afectacion", "@"),
    ("afectacion_salud", 30, "Efecto principal sobre la salud o los servicios de salud.", "afectacion_salud", "@"),
    ("resumen", 50, "Una o dos frases con lo esencial de la noticia.", None, "@"),
    ("personas_afectadas", 12, "Número, si la noticia lo da. Vacío si no se sabe (no pongas 0).", None, "0"),
    ("fallecidos", 10, "Número, si la noticia lo da. Vacío si no se sabe.", None, "0"),
    ("viviendas_afectadas", 12, "Número, si la noticia lo da. Vacío si no se sabe.", None, "0"),
    ("eess_afectados", 11, "Número de establecimientos de salud afectados (de cualquier institución).", None, "0"),
    ("establecimiento_essalud", 28, "Nombre del establecimiento de EsSalud afectado, si lo hay.", None, "@"),
    ("medio", 18, "Medio o entidad que publica (p. ej. RPP, El Comercio, INDECI).", None, "@"),
    ("tipo_fuente", 22, "Tipo de fuente.", "tipo_fuente", "@"),
    ("enlace", 40, "URL de la noticia.", None, "@"),
    ("verificado", 10, "Sí: confirmado con una fuente oficial. No: solo prensa o redes.", "si_no", "@"),
    ("fecha_registro", 13, "Fecha en que registras la fila (AAAA-MM-DD).", None, "yyyy-mm-dd"),
    ("notas", 30, "Comentarios libres.", None, "@"),
]
DEMANDA = [
    ("id_demanda", 11, "Código de la necesidad, p. ej. D-001.", None, "@"),
    ("fecha_identificacion", 13, "Fecha en que se identificó la necesidad (AAAA-MM-DD).", None, "yyyy-mm-dd"),
    ("lugar", 46, "Dónde se necesita el apoyo. Elige de la lista (escribe para buscar).", LUGAR, "@"),
    ("red_asistencial", 22, "Red asistencial o prestacional de EsSalud, p. ej. 'Red Asistencial Piura'.", None, "@"),
    ("establecimiento", 26, "Establecimiento de salud que necesita el apoyo, si aplica.", None, "@"),
    ("categoria", 30, "Tipo de necesidad. Es la misma lista que la columna 'categoria' de la oferta: así la web cruza demanda y oferta.", "categoria", "@"),
    ("descripcion", 46, "Qué se necesita exactamente.", None, "@"),
    ("cantidad", 10, "Cantidad, si aplica.", None, "0"),
    ("unidad", 12, "Unidad de la cantidad (kits, camas, personas, m³…).", None, "@"),
    ("monto_estimado", 14, "Monto estimado, si aplica.", None, "#,##0"),
    ("moneda", 8, "Moneda del monto.", "moneda", "@"),
    ("prioridad", 10, "Alta, Media o Baja.", "prioridad", "@"),
    ("tipologia_requerida", 16, "Qué tipo de aliado podría cubrirla (ver pestaña Tipologias del archivo de aliados).", "tipologia", "@"),
    ("estado", 18, "Situación de la necesidad.", "estado_demanda", "@"),
    ("aliado_asignado", 26, "Nombre del aliado que la cubre, escrito igual que en la base de aliados.", None, "@"),
    ("origen", 20, "Cómo se identificó la necesidad.", "origen_demanda", "@"),
    ("id_noticia", 12, "Si viene del radar, el código de la noticia (N-0001).", None, "@"),
    ("notas", 30, "Comentarios libres.", None, "@"),
]
ALIADOS = [
    ("id_aliado", 10, "Código del aliado, p. ej. A-001.", None, "@"),
    ("nombre", 34, "Nombre completo de la organización. La pestaña Oferta usa este nombre: escríbelo siempre igual.", None, "@"),
    ("siglas", 12, "Siglas, si tiene.", None, "@"),
    ("tipo_actor", 30, "Qué clase de organización es.", "tipo_actor", "@"),
    ("pais_origen", 16, "País de origen o sede (para organismos multilaterales: 'Multilateral').", None, "@"),
    ("tipologias", 26, "Una o más tipologías separadas por comas, p. ej. 'Donante, Logístico'. Valores: Donante, Voluntario, Logístico, Articulador, Financiero, Técnico.", None, "@"),
    ("sitio_web", 30, "Página web institucional.", None, "@"),
    ("canal_contacto_institucional", 30, "Correo o formulario INSTITUCIONAL. Esta hoja es visible con el enlace: no registres nombres, correos ni teléfonos de personas.", None, "@"),
    ("estado_relacion", 22, "En qué punto está la relación con EsSalud.", "estado_relacion", "@"),
    ("nivel_emergencia", 18, "Nivel de emergencia SINAGERD en que se activa su apoyo.", "nivel_emergencia", "@"),
    ("fecha_identificacion", 13, "Fecha en que se identificó (AAAA-MM-DD).", None, "yyyy-mm-dd"),
    ("fecha_ultimo_contacto", 13, "Fecha del último contacto (AAAA-MM-DD).", None, "yyyy-mm-dd"),
    ("siguiente_paso", 34, "Próxima acción acordada.", None, "@"),
    ("logo_url", 30, "Enlace directo a una imagen del logo (opcional). La web lo muestra junto al nombre.", None, "@"),
    ("fuente", 26, "Cómo se identificó (p. ej. matriz MIDIS, embajada, reunión).", None, "@"),
    ("notas", 30, "Comentarios libres.", None, "@"),
]
OFERTA = [
    ("id_oferta", 10, "Código de la oferta, p. ej. O-001.", None, "@"),
    ("aliado", 34, "Elige el aliado de la lista (sale de la pestaña Aliados).", "ALIADOS", "@"),
    ("tipologia", 14, "Tipología de ESTE apoyo.", "tipologia", "@"),
    ("categoria", 30, "Tipo de apoyo. Es la misma lista que la demanda: así la web cruza demanda y oferta.", "categoria", "@"),
    ("descripcion", 46, "Qué ofrece exactamente.", None, "@"),
    ("cobertura", 46, "Dónde puede apoyar. Elige 'PERÚ › TODO EL PAÍS (00)' si es nacional. Si cubre varios departamentos, usa una fila por departamento con el mismo id_oferta.", LUGAR, "@"),
    ("modalidad", 22, "Forma del apoyo.", "modalidad", "@"),
    ("cantidad", 10, "Cantidad, si aplica.", None, "0"),
    ("unidad", 12, "Unidad de la cantidad.", None, "@"),
    ("monto_estimado", 14, "Monto estimado, si aplica.", None, "#,##0"),
    ("moneda", 8, "Moneda del monto.", "moneda", "@"),
    ("disponible_desde", 13, "Desde cuándo está disponible (AAAA-MM-DD).", None, "yyyy-mm-dd"),
    ("disponible_hasta", 13, "Hasta cuándo (AAAA-MM-DD). Vacío si no tiene fecha límite.", None, "yyyy-mm-dd"),
    ("estado_oferta", 20, "Situación de la oferta.", "estado_oferta", "@"),
    ("fuente", 26, "De dónde sale la información (reunión, carta, correo…).", None, "@"),
    ("notas", 30, "Comentarios libres.", None, "@"),
]

# --- Estilos del encabezado ---
ENCABEZADO = PatternFill("solid", fgColor="0A2A4A")
LETRA_ENCABEZADO = Font(bold=True, color="FFFFFF")
with open(RAIZ / "datos" / "catalogo_lugares.csv", encoding="utf-8") as f:
    LUGARES = list(csv.DictReader(f))


# ============================================================
# PROCESO 3: Funciones para escribir cada tipo de pestaña
# Insumo:    definiciones de los procesos 1 y 2
# Resultado: pestañas con encabezado, notas, anchos y listas desplegables
# ============================================================
def pestana_datos(libro, nombre, columnas, rangos):
    """Crea una pestaña de registro: fila 1 = encabezados; desde la fila 2, los datos."""
    hoja = libro.create_sheet(nombre)
    for i, (col, ancho, nota, lista, formato) in enumerate(columnas, start=1):
        celda = hoja.cell(row=1, column=i, value=col)
        celda.fill, celda.font = ENCABEZADO, LETRA_ENCABEZADO
        celda.alignment = Alignment(vertical="center")
        celda.comment = Comment(nota, "Plantilla")
        letra = celda.column_letter
        hoja.column_dimensions[letra].width = ancho
        # formato de las celdas de datos: texto (@), número o fecha
        for fila in range(2, FILAS + 2):
            hoja.cell(row=fila, column=i).number_format = formato
        if lista:
            # DataValidation: lista desplegable; con aviso (no bloquea) si se escribe otro valor
            dv = DataValidation(type="list", formula1=rangos[lista], allow_blank=True,
                                showErrorMessage=True, errorStyle="warning",
                                error="El valor no está en la lista. Revisa si está bien escrito.")
            dv.add(f"{letra}2:{letra}{FILAS + 1}")
            hoja.add_data_validation(dv)
    hoja.freeze_panes = "B2"   # deja fijos el encabezado y la primera columna
    hoja.row_dimensions[1].height = 22
    return hoja


def pestana_listas(libro, claves):
    """Escribe cada catálogo en una columna de la pestaña Listas y devuelve sus rangos."""
    hoja = libro.create_sheet("Listas")
    rangos = {}
    for i, clave in enumerate(claves, start=1):
        celda = hoja.cell(row=1, column=i, value=clave)
        celda.fill, celda.font = ENCABEZADO, LETRA_ENCABEZADO
        for j, valor in enumerate(LISTAS[clave], start=2):
            hoja.cell(row=j, column=i, value=valor)
        letra = celda.column_letter
        hoja.column_dimensions[letra].width = max(14, min(48, max(len(v) for v in LISTAS[clave]) + 2))
        rangos[clave] = f"=Listas!${letra}$2:${letra}${len(LISTAS[clave]) + 1}"
    return rangos


def pestana_lugares(libro):
    """Catálogo de 2114 lugares: la columna A alimenta los desplegables de 'lugar' y 'cobertura'."""
    hoja = libro.create_sheet("Lugares")
    campos = ["etiqueta", "codigo", "nivel", "departamento", "provincia", "distrito"]
    for i, campo in enumerate(campos, start=1):
        c = hoja.cell(row=1, column=i, value=campo)
        c.fill, c.font = ENCABEZADO, LETRA_ENCABEZADO
    for j, r in enumerate(LUGARES, start=2):
        for i, campo in enumerate(campos, start=1):
            c = hoja.cell(row=j, column=i, value=r[campo])
            c.number_format = "@"   # el código se guarda como texto para no perder el 0 inicial
    for letra, ancho in zip("ABCDEF", (52, 9, 13, 16, 24, 28)):
        hoja.column_dimensions[letra].width = ancho
    hoja.freeze_panes = "A2"
    return f"=Lugares!$A$2:$A${len(LUGARES) + 1}"


def pestana_leeme(libro, lineas):
    """Primera pestaña: instrucciones para quien llena la base."""
    hoja = libro.active
    hoja.title = "LEEME"
    hoja.column_dimensions["A"].width = 120
    for j, texto in enumerate(lineas, start=1):
        c = hoja.cell(row=j, column=1, value=texto)
        c.alignment = Alignment(wrap_text=True, vertical="top")
        if texto and texto == texto.upper() and len(texto) < 70:
            c.font = Font(bold=True)
    return hoja


def diccionario(columnas):
    return [f"  • {c[0]}: {c[2]}" for c in columnas]


# ============================================================
# PROCESO 4: Base FEN_2026_2027 (radar de noticias + demanda de cooperación)
# Insumo:    columnas RADAR y DEMANDA, listas y catálogo de lugares
# Resultado: plantillas/FEN_2026_2027.xlsx
# ============================================================
libro = Workbook()
pestana_leeme(libro, [
    "FEN 2026-2027 · RADAR DE NOTICIAS Y DEMANDA DE COOPERACIÓN (EsSalud)",
    "Esta hoja alimenta la web del proyecto «aliados». La web lee las pestañas Radar y Demanda al abrirse y cada 5 minutos.",
    "La hoja está compartida como «cualquier persona con el enlace: lector». No registres datos personales (nombres, DNI, teléfonos o correos de personas).",
    "",
    "CÓMO LLENAR",
    "1. Una fila = una noticia en un lugar. Si una noticia habla de 3 distritos, registra 3 filas con el mismo id_noticia.",
    "2. En 'lugar' elige de la lista (escribe para buscar). Termina en un código entre paréntesis: 2 dígitos = departamento, 4 = provincia, 6 = distrito, 00 = todo el país. Ese código ubica la fila en el mapa.",
    "3. No cambies los nombres de las columnas ni de las pestañas: la web los busca por nombre. Puedes agregar columnas nuevas al final.",
    "4. Fechas en formato AAAA-MM-DD (p. ej. 2026-12-05). Números sin texto (escribe 120, no '120 personas').",
    "5. Los valores de los desplegables están en la pestaña Listas. Si agregas uno, escríbelo al final de su columna.",
    "",
    "PESTAÑA RADAR (noticias sobre dónde está afectando el FEN 2026-2027)",
    *diccionario(RADAR),
    "",
    "PESTAÑA DEMANDA (necesidades de cooperación por zona)",
    *diccionario(DEMANDA),
    "",
    "EJEMPLO DE FILA EN RADAR",
    "  N-0001 | 2026-12-05 | PIURA › PIURA › CASTILLA (200104) | Inundación o desborde de río | Alto | Interrupción de servicios de salud | Desborde del río Piura inunda el barrio… | 1200 | | 300 | 2 | | INDECI | Oficial (…) | https://… | Sí | 2026-12-06 |",
    "",
    "Mapa base: INEI, límites distritales del Censo 2025 (1892 distritos). Lista de lugares generada con scripts/01_preparar_datos.py del repositorio github.com/diegosimemirror/aliados.",
])
rangos = pestana_listas(libro, ["fenomeno", "nivel_afectacion", "afectacion_salud", "tipo_fuente", "si_no",
                                "categoria", "moneda", "prioridad", "tipologia", "estado_demanda", "origen_demanda"])
rangos[LUGAR] = pestana_lugares(libro)
pestana_datos(libro, "Radar", RADAR, rangos)
pestana_datos(libro, "Demanda", DEMANDA, rangos)
# orden de pestañas: LEEME, Radar, Demanda, Listas, Lugares
libro._sheets = [libro["LEEME"], libro["Radar"], libro["Demanda"], libro["Listas"], libro["Lugares"]]
libro.save(SALIDA / "FEN_2026_2027.xlsx")
print("Proceso 4 - FEN_2026_2027.xlsx:", [h.title for h in libro.worksheets])

# ============================================================
# PROCESO 5: Base Identificacion_Aliados_Essalud (aliados + oferta + tipologías)
# Insumo:    columnas ALIADOS y OFERTA, TIPOLOGIAS, listas y catálogo de lugares
# Resultado: plantillas/Identificacion_Aliados_Essalud.xlsx
# ============================================================
libro = Workbook()
pestana_leeme(libro, [
    "IDENTIFICACIÓN DE ALIADOS DE ESSALUD · FEN 2026-2027",
    "Esta hoja alimenta la web del proyecto «aliados». La web lee las pestañas Aliados, Oferta y Tipologias al abrirse y cada 5 minutos.",
    "La hoja está compartida como «cualquier persona con el enlace: lector». No registres nombres, correos ni teléfonos de personas: usa solo canales institucionales.",
    "",
    "CÓMO LLENAR",
    "1. Pestaña Aliados: una fila por organización.",
    "2. Pestaña Oferta: una fila por cada apoyo que ofrece un aliado y por cada lugar donde lo ofrece. Si ofrece lo mismo en 3 departamentos, registra 3 filas con el mismo id_oferta.",
    "3. En 'aliado' (Oferta) elige el nombre de la lista: sale de la columna 'nombre' de Aliados.",
    "4. En 'cobertura' elige de la lista (escribe para buscar). El código entre paréntesis ubica la oferta en el mapa: 00 = todo el país.",
    "5. La 'categoria' de la oferta usa la misma lista que la demanda (archivo FEN_2026_2027): así la web muestra qué aliados podrían cubrir cada necesidad.",
    "6. No cambies los nombres de las columnas ni de las pestañas. Puedes agregar columnas nuevas al final.",
    "",
    "PESTAÑA ALIADOS",
    *diccionario(ALIADOS),
    "",
    "PESTAÑA OFERTA",
    *diccionario(OFERTA),
    "",
    "PESTAÑA TIPOLOGIAS",
    "  Definiciones que muestra la web. Donante, Voluntario, Logístico y Articulador vienen de la web de aliados del MIDIS; Financiero y Técnico son una propuesta para EsSalud y se pueden editar.",
    "  Si agregas una tipología, agrégala también en la pestaña Listas (columna tipologia) y en la de FEN_2026_2027.",
])
LISTAS["ALIADOS"] = []  # el desplegable de aliados apunta a la columna 'nombre' de la pestaña Aliados
rangos = pestana_listas(libro, ["tipo_actor", "tipologia", "estado_relacion", "nivel_emergencia", "categoria",
                                "modalidad", "moneda", "estado_oferta"])
rangos["ALIADOS"] = f"=Aliados!$B$2:$B${FILAS + 1}"
rangos[LUGAR] = pestana_lugares(libro)
pestana_datos(libro, "Aliados", ALIADOS, rangos)
pestana_datos(libro, "Oferta", OFERTA, rangos)
hoja = libro.create_sheet("Tipologias")
for i, (titulo, ancho) in enumerate([("tipologia", 14), ("definicion", 70), ("ejemplos", 70), ("origen", 26)], start=1):
    c = hoja.cell(row=1, column=i, value=titulo)
    c.fill, c.font = ENCABEZADO, LETRA_ENCABEZADO
    hoja.column_dimensions[c.column_letter].width = ancho
for j, fila in enumerate(TIPOLOGIAS, start=2):
    for i, valor in enumerate(fila, start=1):
        hoja.cell(row=j, column=i, value=valor).alignment = Alignment(wrap_text=True, vertical="top")
libro._sheets = [libro["LEEME"], libro["Aliados"], libro["Oferta"], libro["Tipologias"], libro["Listas"], libro["Lugares"]]
libro.save(SALIDA / "Identificacion_Aliados_Essalud.xlsx")
print("Proceso 5 - Identificacion_Aliados_Essalud.xlsx:", [h.title for h in libro.worksheets])
