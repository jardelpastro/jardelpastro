"""Fundo de planta: DXF de arruamento/cadastro e imagem georreferenciada.

O DXF de fundo é convertido em geometria leve (polylines e textos, sem
cota) para desenhar atrás da rede. Blocos (INSERT) são explodidos.
A imagem de fundo é referenciada por caminho + posicionamento (canto
superior esquerdo em E/N e metros por pixel); um world file (.jgw/.pgw/
.tfw) ao lado da imagem é lido automaticamente quando existe.
"""

from __future__ import annotations

import math
import os

# polyline de fundo: [[e, n], ...]; texto: [e, n, altura, rotação°, texto]
BgLine = list[list[float]]
BgText = list

MAX_VERTICES = 400_000     # proteção contra DXFs gigantes


class BackgroundError(Exception):
    pass


def _arc_points(cx: float, cy: float, radius: float, a0: float, a1: float,
                max_seg: float = 12.0) -> BgLine:
    """Aproxima um arco por segmentos (ângulos em graus)."""
    if a1 < a0:
        a1 += 360.0
    steps = max(4, int((a1 - a0) / max_seg))
    pts = []
    for i in range(steps + 1):
        ang = math.radians(a0 + (a1 - a0) * i / steps)
        pts.append([cx + radius * math.cos(ang),
                    cy + radius * math.sin(ang)])
    return pts


def load_dxf_background(path: str) -> tuple[list[BgLine], list[BgText]]:
    """Extrai linhas e textos de um DXF de fundo (arruamento/cadastro)."""
    try:
        import ezdxf
    except ImportError as exc:
        raise BackgroundError(
            "Leitura de DXF requer o pacote 'ezdxf' "
            "(pip install ezdxf).") from exc
    try:
        doc = ezdxf.readfile(path)
    except Exception as exc:
        raise BackgroundError(f"DXF inválido: {exc}") from exc

    lines: list[BgLine] = []
    texts: list[BgText] = []
    vertices = 0

    def add_line(pts: BgLine):
        nonlocal vertices
        if len(pts) >= 2 and vertices < MAX_VERTICES:
            lines.append(pts)
            vertices += len(pts)

    def handle(entity):
        kind = entity.dxftype()
        try:
            if kind == "LINE":
                s, e = entity.dxf.start, entity.dxf.end
                add_line([[float(s.x), float(s.y)],
                          [float(e.x), float(e.y)]])
            elif kind == "LWPOLYLINE":
                pts = [[float(x), float(y)]
                       for x, y, *_ in entity.get_points()]
                if entity.closed and pts:
                    pts.append(pts[0])
                add_line(pts)
            elif kind == "POLYLINE":
                pts = [[float(v.dxf.location.x), float(v.dxf.location.y)]
                       for v in entity.vertices]
                if entity.is_closed and pts:
                    pts.append(pts[0])
                add_line(pts)
            elif kind == "CIRCLE":
                c = entity.dxf.center
                add_line(_arc_points(float(c.x), float(c.y),
                                     float(entity.dxf.radius), 0.0, 360.0))
            elif kind == "ARC":
                c = entity.dxf.center
                add_line(_arc_points(float(c.x), float(c.y),
                                     float(entity.dxf.radius),
                                     float(entity.dxf.start_angle),
                                     float(entity.dxf.end_angle)))
            elif kind in ("TEXT", "MTEXT"):
                if kind == "TEXT":
                    ins = entity.dxf.insert
                    height = float(entity.dxf.height)
                    rotation = float(entity.dxf.rotation)
                    content = entity.dxf.text
                else:
                    ins = entity.dxf.insert
                    height = float(entity.dxf.char_height)
                    rotation = float(entity.dxf.rotation)
                    content = entity.plain_text()
                content = (content or "").strip()
                if content:
                    texts.append([float(ins.x), float(ins.y), height,
                                  rotation, content])
            elif kind == "INSERT":
                for sub in entity.virtual_entities():
                    handle(sub)
        except Exception:
            pass    # entidade malformada: ignora e segue

    for entity in doc.modelspace():
        handle(entity)

    if not lines and not texts:
        raise BackgroundError(
            "Nenhuma linha ou texto encontrado no DXF de fundo.")
    return lines, texts


def read_world_file(image_path: str) -> tuple[float, float, float] | None:
    """Lê o world file da imagem, se existir.

    Retorna (m_per_px, origin_e, origin_n) com a origem no canto superior
    esquerdo da imagem, ou None quando não há world file.
    """
    base, ext = os.path.splitext(image_path)
    ext = ext.lower().lstrip(".")
    candidates = []
    if len(ext) == 3:
        candidates.append(f"{base}.{ext[0]}{ext[-1]}w")   # .jgw/.pgw/.tfw
    candidates.append(f"{base}.wld")
    candidates.append(image_path + "w")
    for candidate in candidates:
        if os.path.exists(candidate):
            try:
                with open(candidate, encoding="utf-8") as fh:
                    values = [float(line.strip().replace(",", "."))
                              for line in fh if line.strip()][:6]
                if len(values) < 6:
                    return None
                a, _d, _b, e, c, f = values
                # (c, f) é o CENTRO do pixel superior esquerdo
                m_per_px = abs(a)
                origin_e = c - a / 2.0
                origin_n = f - e / 2.0
                return m_per_px, origin_e, origin_n
            except (ValueError, OSError):
                return None
    return None
