"""Exportação DXF da planta e do perfil para CAD (AutoCAD/Civil 3D).

Planta em coordenadas reais (X = Leste, Y = Norte), com layers
organizados: rede (um layer por nome de rede, com a cor configurada),
PVs (símbolos por tipo), textos, setas de fluxo e curvas de nível como
polylines 3D. Perfil com X = distância real e Y = cota multiplicada
pelo exagero (razão escala H / escala V), com grid, bandas e textos.
"""

from __future__ import annotations

import math

from .models import Project
from .profile import (ProfilePath, build_geometry, interpolate_at,
                      pv_positions, stations)
from .simulation import PipeResult, SimulationResult

STATION_STEP = 20.0


class DxfExportError(Exception):
    pass


def _fmt(value: float, decimals: int = 2) -> str:
    text = f"{value:,.{decimals}f}"
    return text.replace(",", "\x00").replace(".", ",").replace("\x00", ".")


def _new_doc():
    try:
        import ezdxf
    except ImportError as exc:
        raise DxfExportError(
            "Exportação DXF requer o pacote 'ezdxf' "
            "(pip install ezdxf).") from exc
    return ezdxf.new("R2010", setup=True)


def _layer(doc, name: str, aci: int = 7, rgb: str | None = None,
           linetype: str | None = None):
    if name in doc.layers:
        return
    attribs = {"color": aci}
    if linetype:
        attribs["linetype"] = linetype
    layer = doc.layers.add(name, **attribs)
    if rgb:
        color = rgb.lstrip("#")
        layer.rgb = tuple(int(color[i:i + 2], 16) for i in (0, 2, 4))


def _text(msp, content: str, x: float, y: float, height: float,
          layer: str, rotation: float = 0.0, center: bool = False):
    from ezdxf.enums import TextEntityAlignment
    t = msp.add_text(content, height=height,
                     rotation=rotation, dxfattribs={"layer": layer})
    align = (TextEntityAlignment.MIDDLE_CENTER if center
             else TextEntityAlignment.LEFT)
    t.set_placement((x, y), align=align)
    return t


# ======================================================================
# PLANTA
# ======================================================================
def export_plan_dxf(project: Project, result: SimulationResult | None,
                    path: str) -> None:
    """Planta da rede em coordenadas reais, com layers organizados."""
    doc = _new_doc()
    msp = doc.modelspace()

    _layer(doc, "SANESIM-PV", aci=7)
    _layer(doc, "SANESIM-PV-TEXTO", aci=7)
    _layer(doc, "SANESIM-REDE-TEXTO", aci=4)
    _layer(doc, "SANESIM-SETAS", aci=5)
    _layer(doc, "SANESIM-CURVAS-NIVEL", aci=42, linetype="DASHED")

    results_by_name = {r.pipe: r for r in result.pipes} if result else {}

    # ----------------------------------------------------------- trechos
    for pipe in project.pipes:
        up = project.node_by_name(pipe.upstream)
        down = project.node_by_name(pipe.downstream)
        if not (up and down):
            continue
        net = pipe.network or ""
        layer_name = f"SANESIM-REDE-{net}" if net else "SANESIM-REDE"
        _layer(doc, layer_name, aci=5,
               rgb=pipe.color or project.network_colors.get(net))
        p1 = (up.coord_e, up.coord_n)
        p2 = (down.coord_e, down.coord_n)
        msp.add_lwpolyline([p1, p2], dxfattribs={"layer": layer_name})

        dx, dy = p2[0] - p1[0], p2[1] - p1[1]
        length = math.hypot(dx, dy)
        if length < 1e-6:
            continue
        ux, uy = dx / length, dy / length
        # seta de fluxo a 60% do vão (tamanho 2 m)
        ax, ay = p1[0] + dx * 0.6, p1[1] + dy * 0.6
        size = 2.0
        left = (ax - size * (ux * math.cos(0.45) - uy * math.sin(0.45)),
                ay - size * (uy * math.cos(0.45) + ux * math.sin(0.45)))
        right = (ax - size * (ux * math.cos(-0.45) - uy * math.sin(-0.45)),
                 ay - size * (uy * math.cos(-0.45) + ux * math.sin(-0.45)))
        msp.add_solid([(ax, ay), left, right],
                      dxfattribs={"layer": "SANESIM-SETAS"})

        # rótulo ao longo do trecho, legível (nunca de cabeça para baixo)
        angle = math.degrees(math.atan2(dy, dx))
        if angle > 90:
            angle -= 180
        elif angle < -90:
            angle += 180
        r = results_by_name.get(pipe.name)
        label = pipe.name
        if r:
            label = (f"{pipe.name}  DN {r.diameter_mm}  "
                     f"L={_fmt(r.length)} m  I={_fmt(r.slope, 4)}")
        # deslocado 2 m perpendicular à esquerda da linha
        off = 2.0
        mx = (p1[0] + p2[0]) / 2 - uy * off
        my = (p1[1] + p2[1]) / 2 + ux * off
        _text(msp, label, mx, my, 1.5, "SANESIM-REDE-TEXTO",
              rotation=angle, center=True)

    # -------------------------------------------------------------- nós
    for node in project.nodes:
        e, n = node.coord_e, node.coord_n
        if node.node_type == "EEE":
            r = 1.2
            msp.add_lwpolyline(
                [(e, n + 1.35 * r), (e + 1.25 * r, n - r),
                 (e - 1.25 * r, n - r)],
                close=True, dxfattribs={"layer": "SANESIM-PV"})
        else:
            msp.add_circle((e, n), 0.8, dxfattribs={"layer": "SANESIM-PV"})
        _text(msp, node.name, e + 1.2, n + 1.2, 2.0, "SANESIM-PV-TEXTO")
        if node.ground_elev:
            _text(msp, f"CT {_fmt(node.ground_elev, 3)}",
                  e + 1.2, n - 1.6, 1.2, "SANESIM-PV-TEXTO")

    # ------------------------------------------------- curvas de nível
    for line in project.terrain_lines:
        if len(line) < 2:
            continue
        z = line[0][2]
        msp.add_polyline3d([(v[0], v[1], v[2]) for v in line],
                           dxfattribs={"layer": "SANESIM-CURVAS-NIVEL"})
        _text(msp, _fmt(z, 1), line[0][0], line[0][1], 1.2,
              "SANESIM-CURVAS-NIVEL")

    doc.saveas(path)


# ======================================================================
# PERFIL
# ======================================================================
def export_profile_dxf(path_obj: ProfilePath, out_path: str,
                       scale_h: int = 1000, scale_v: int = 100,
                       gauge_note: str = "") -> None:
    """Perfil longitudinal em DXF: X = distância (m), Y = cota × exagero.

    O exagero vertical é a razão escala_h/escala_v (10 para 1:1000 e
    1:100), reproduzindo a geometria da tela/PDF em unidades reais de
    distância — pronto para inserir na prancha e ajustar na viewport.
    """
    segments = build_geometry(path_obj)
    if not segments:
        raise DxfExportError("Caminho sem trechos para desenhar.")
    doc = _new_doc()
    msp = doc.modelspace()

    _layer(doc, "PERFIL-GRID", aci=8, linetype="DASHED")
    _layer(doc, "PERFIL-GRID-MESTRE", aci=8)
    _layer(doc, "PERFIL-TERRENO", aci=32)
    _layer(doc, "PERFIL-TUBO", aci=7)
    _layer(doc, "PERFIL-NA", aci=5)
    _layer(doc, "PERFIL-PV", aci=7)
    _layer(doc, "PERFIL-BANDAS", aci=7)
    _layer(doc, "PERFIL-TEXTO", aci=7)

    ex = scale_h / scale_v          # exagero vertical
    total = path_obj.length
    elev_top = max(max(s.ground0, s.ground1) for s in segments)
    elev_bot = min(min(s.invert0, s.invert1) for s in segments)
    grid_top = (int(elev_top / 5.0) + 1) * 5.0
    grid_bot = int(elev_bot / 5.0) * 5.0
    if grid_bot > elev_bot - 0.5:
        grid_bot -= 5.0

    def Y(elev: float) -> float:
        return (elev - grid_bot) * ex

    y_top, y_bot = Y(grid_top), Y(grid_bot)

    # ------------------------------------------------------------ grid
    e = grid_bot
    while e <= grid_top + 1e-6:
        master = abs(e / 5.0 - round(e / 5.0)) < 1e-6
        layer = "PERFIL-GRID-MESTRE" if master else "PERFIL-GRID"
        msp.add_line((0, Y(e)), (total, Y(e)), dxfattribs={"layer": layer})
        if master:
            _text(msp, _fmt(e, 2), -2.0, Y(e), 1.6, "PERFIL-TEXTO",
                  center=False)
        e += 1.0
    x = 0.0
    while x <= total + 1e-6:
        master = abs(x / 100.0 - round(x / 100.0)) < 1e-6
        layer = "PERFIL-GRID-MESTRE" if master else "PERFIL-GRID"
        msp.add_line((x, y_bot), (x, y_top), dxfattribs={"layer": layer})
        if master:
            _text(msp, _fmt(x, 0), x, y_top + 2.0, 1.6, "PERFIL-TEXTO",
                  center=True)
        x += STATION_STEP
    for x_edge in (0.0, total):
        msp.add_line((x_edge, y_bot), (x_edge, y_top),
                     dxfattribs={"layer": "PERFIL-BANDAS"})

    # ---------------------------------------------------------- perfil
    for s in segments:
        msp.add_line((s.x0, Y(s.ground0)), (s.x1, Y(s.ground1)),
                     dxfattribs={"layer": "PERFIL-TERRENO"})
        msp.add_line((s.x0, Y(s.invert0)), (s.x1, Y(s.invert1)),
                     dxfattribs={"layer": "PERFIL-TUBO"})
        msp.add_line((s.x0, Y(s.crown0)), (s.x1, Y(s.crown1)),
                     dxfattribs={"layer": "PERFIL-TUBO"})
        # lâmina d'água (polígono fechado)
        msp.add_lwpolyline(
            [(s.x0, Y(s.water0)), (s.x1, Y(s.water1)),
             (s.x1, Y(s.invert1)), (s.x0, Y(s.invert0))],
            close=True, dxfattribs={"layer": "PERFIL-NA"})

    pv_info = pv_positions(segments)
    half_w = 0.75
    for x_pv, ground, bottom, name in pv_info:
        msp.add_lwpolyline(
            [(x_pv - half_w, Y(ground)), (x_pv + half_w, Y(ground)),
             (x_pv + half_w, Y(bottom)), (x_pv - half_w, Y(bottom))],
            close=True, dxfattribs={"layer": "PERFIL-PV"})
        _text(msp, name, x_pv, Y(ground) + 2.5, 2.0, "PERFIL-TEXTO",
              center=True)

    # ---------------------------------------------------------- bandas
    band_gap = 6.0
    band_top_y = y_bot - band_gap
    _text(msp, "Distância (m)", total / 2, y_bot - band_gap / 2, 1.8,
          "PERFIL-TEXTO", center=True)

    pv_xs = [p[0] for p in pv_info]
    st = stations(total, STATION_STEP)

    def band(y0: float, height: float, label: str, ticks: str) -> float:
        y1 = y0 - height
        msp.add_lwpolyline([(0, y0), (total, y0), (total, y1), (0, y1)],
                           close=True, dxfattribs={"layer": "PERFIL-BANDAS"})
        _text(msp, label, -2.0, (y0 + y1) / 2, 1.5, "PERFIL-TEXTO")
        if ticks == "dividers":
            for x_t in pv_xs:
                msp.add_line((x_t, y0), (x_t, y1),
                             dxfattribs={"layer": "PERFIL-BANDAS"})
        else:
            xs = st if ticks == "stations" else pv_xs
            for x_t in xs:
                msp.add_line((x_t, y0), (x_t, y0 - 0.8),
                             dxfattribs={"layer": "PERFIL-BANDAS"})
                msp.add_line((x_t, y1 + 0.8), (x_t, y1),
                             dxfattribs={"layer": "PERFIL-BANDAS"})
        return y1

    def rotated_values(y0: float, y1: float, value_fn):
        mid = (y0 + y1) / 2
        for x_v in st:
            if any(abs(x_v - x_pv) < 6.0 for x_pv in pv_xs):
                continue
            _text(msp, value_fn(x_v), x_v, mid, 1.4, "PERFIL-TEXTO",
                  rotation=90, center=True)
        for x_pv in pv_xs:
            _text(msp, value_fn(x_pv), x_pv, mid, 1.4, "PERFIL-TEXTO",
                  rotation=90, center=True)

    y = band_top_y
    # distâncias
    y1 = band(y, 8.0, "Distâncias (m)", "pvs")
    for s in segments:
        _text(msp, _fmt(s.x1 - s.x0, 2), (s.x0 + s.x1) / 2, (y + y1) / 2,
              1.5, "PERFIL-TEXTO", center=True)
    for x_pv in pv_xs:
        _text(msp, _fmt(x_pv, 2), x_pv, y1 + 0.8, 1.3, "PERFIL-TEXTO",
              rotation=90)
    y = y1
    # cotas / profundidade
    y1 = band(y, 7.0, "Cota terreno (m)", "stations")
    rotated_values(y, y1, lambda xv: _fmt(interpolate_at(segments, xv)[0], 3))
    y = y1
    y1 = band(y, 7.0, "Cota coletor GI (m)", "stations")
    rotated_values(y, y1, lambda xv: _fmt(interpolate_at(segments, xv)[1], 3))
    y = y1
    y1 = band(y, 7.0, "Profundidade (m)", "stations")

    def depth(xv):
        ground, invert = interpolate_at(segments, xv)
        return _fmt(ground - invert, 3)
    rotated_values(y, y1, depth)
    y = y1
    # declividade e material
    y1 = band(y, 3.5, "Declividade (m/m)", "dividers")
    for s in segments:
        _text(msp, f"I = {_fmt(s.pipe.slope, 4)}", (s.x0 + s.x1) / 2,
              (y + y1) / 2, 1.4, "PERFIL-TEXTO", center=True)
    y = y1
    y1 = band(y, 3.5, "Material / Vazão", "dividers")
    for s in segments:
        r: PipeResult = s.pipe
        mat = r.material.split("(")[0].strip()
        _text(msp, f"{mat} DN {r.diameter_mm} - Qf={_fmt(r.q_down_end, 2)} l/s",
              (s.x0 + s.x1) / 2, (y + y1) / 2, 1.3, "PERFIL-TEXTO",
              center=True)

    # ----------------------------------------------------------- título
    title = f"PERFIL - {path_obj.label}"
    _text(msp, title, total / 2, y_top + 7.0, 2.8, "PERFIL-TEXTO",
          center=True)
    note = (f"Escala horizontal 1:{scale_h} - vertical 1:{scale_v} "
            f"(exagero {ex:g}x)")
    if gauge_note:
        note += f" - {gauge_note}"
    _text(msp, note, total / 2, y_top + 3.5, 1.6, "PERFIL-TEXTO",
          center=True)

    doc.saveas(out_path)
