"""Planilha de OSE (Ordem de Serviço para Execução) — folha de planilha.

Gera, por trecho, o estaqueamento a cada 20 m (configurável) no estilo da
folha 3 do modelo SANEPAR: distâncias, cota do terreno (interpolada
linearmente entre os PVs), cota da geratriz inferior do coletor,
profundidade da vala, recobrimento e altura de régua/cruzeta (gabarito).

Enquanto não há interpolação por curvas de nível, o terreno entre PVs é
interpolado em linha reta — a mesma premissa vale para o futuro perfil.
"""

from __future__ import annotations

import datetime as _dt

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from .models import Project
from .simulation import PipeResult, SimulationResult

_THIN = Side(style="thin")
_BORDER = Border(left=_THIN, right=_THIN, top=_THIN, bottom=_THIN)
_HEAD_FILL = PatternFill("solid", fgColor="D9E1F2")
_BLOCK_FILL = PatternFill("solid", fgColor="F2F2F2")
_HEAD_FONT = Font(bold=True, size=9)
_CELL_FONT = Font(size=9)
_CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)

HEADERS = ["Estaca", "Dist. entre\nPiquetes (m)", "Dist.\nAcumulada (m)",
           "Cota do\nTerreno (m)", "Declividade\n(m/m)",
           "Cota Geratriz\nInf. Coletor (m)", "Altura da\nRégua (m)",
           "Cota Bordo Sup.\nda Régua (m)", "Prof. da\nVala (m)",
           "Recobrimento\n(m)", "Observações"]
WIDTHS = [8, 11, 11, 11, 11, 13, 10, 13, 10, 12, 24]


def _cell(ws, row: int, col: int, value, fmt: str | None = None,
          bold: bool = False, fill=None):
    c = ws.cell(row=row, column=col, value=value)
    c.font = _HEAD_FONT if bold else _CELL_FONT
    c.border = _BORDER
    c.alignment = _CENTER
    if fmt:
        c.number_format = fmt
    if fill:
        c.fill = fill
    return c


def _stakes(length: float, step: float) -> list[float]:
    """Posições de estaqueamento: 0, step, 2*step..., extremidade final."""
    positions = []
    x = 0.0
    while x < length - 1e-6:
        positions.append(x)
        x += step
    positions.append(length)
    return positions


def export_ose(project: Project, result: SimulationResult, path: str,
               stake_step: float = 20.0, gauge_height: float = 3.0) -> None:
    """Gera a planilha de OSE com um bloco de estacas por trecho.

    gauge_height: altura do gabarito (régua/cruzeta) em relação à
    geratriz inferior do coletor, como no modelo (3,00 m).
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "OSE - Planilha"
    for col, width in enumerate(WIDTHS, start=1):
        ws.column_dimensions[get_column_letter(col)].width = width

    ws.cell(row=1, column=1,
            value="ORDEM DE SERVIÇO PARA EXECUÇÃO — PLANILHA").font = \
        Font(bold=True, size=13)
    ws.cell(row=2, column=1, value=project.title).font = Font(bold=True)
    ws.cell(row=2, column=len(HEADERS) - 1, value="DATA:").font = _HEAD_FONT
    d = ws.cell(row=2, column=len(HEADERS), value=_dt.date.today())
    d.number_format = "DD/MM/YYYY"
    ws.cell(row=3, column=1,
            value=f"Gabarito da régua: {gauge_height:.2f} m — estaqueamento "
                  f"a cada {stake_step:.0f} m — terreno interpolado "
                  "linearmente entre PVs").font = _CELL_FONT

    row = 5
    for r in result.pipes:
        row = _pipe_block(ws, row, r, project, stake_step, gauge_height)
        row += 1
    wb.save(path)


def _pipe_block(ws, row: int, r: PipeResult, project: Project,
                step: float, gauge: float) -> int:
    d_m = r.diameter_mm / 1000.0
    # cabeçalho do bloco do trecho
    info = (f"Trecho {r.pipe}:  {r.upstream} → {r.downstream}   |   "
            f"Extensão: {r.length:.2f} m   |   DN {r.diameter_mm}   |   "
            f"{r.material}   |   Declividade: {r.slope:.5f} m/m   |   "
            f"Rede: {r.network or '-'}")
    c = ws.cell(row=row, column=1, value=info)
    c.font = Font(bold=True, size=10)
    c.fill = _BLOCK_FILL
    ws.merge_cells(start_row=row, start_column=1,
                   end_row=row, end_column=len(HEADERS))
    row += 1
    for col, label in enumerate(HEADERS, start=1):
        c = ws.cell(row=row, column=col, value=label)
        c.font = _HEAD_FONT
        c.fill = _HEAD_FILL
        c.border = _BORDER
        c.alignment = _CENTER
    row += 1

    positions = _stakes(r.length, step)
    prev = 0.0
    for i, x in enumerate(positions):
        frac = x / r.length if r.length > 0 else 0.0
        ground = r.ground_up + (r.ground_down - r.ground_up) * frac
        invert = r.invert_up - r.slope * x
        board = invert + gauge                  # cota do bordo da régua
        ruler = board - ground                  # altura da régua no terreno
        depth = ground - invert                 # profundidade da vala
        cover = depth - d_m                     # recobrimento (geratriz sup.)
        obs = ""
        if i == 0:
            obs = f"PV montante ({r.upstream})"
        elif i == len(positions) - 1:
            obs = f"PV jusante ({r.downstream})"
        _cell(ws, row, 1, i, "0")
        _cell(ws, row, 2, round(x - prev, 2), "#,##0.00")
        _cell(ws, row, 3, round(x, 2), "#,##0.00")
        _cell(ws, row, 4, round(ground, 3), "#,##0.000")
        _cell(ws, row, 5, round(r.slope, 5), "0.00000")
        _cell(ws, row, 6, round(invert, 3), "#,##0.000")
        _cell(ws, row, 7, round(ruler, 3), "#,##0.000")
        _cell(ws, row, 8, round(board, 3), "#,##0.000")
        _cell(ws, row, 9, round(depth, 3), "#,##0.000")
        _cell(ws, row, 10, round(cover, 3), "#,##0.000")
        _cell(ws, row, 11, obs)
        prev = x
        row += 1
    return row
