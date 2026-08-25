"""Modelo de terreno: curvas de nível / pontos cotados e interpolação.

Fontes suportadas:
- DXF: LWPOLYLINE (elevação da entidade), POLYLINE 2D/3D (z dos
  vértices), LINE e POINT com z — o caso típico de levantamento
  topográfico ou superfície exportada do Civil 3D.
- CSV: colunas E/X, N/Y, Z/COTA (com cabeçalho, separador ; ou ,).

A cota é interpolada por TIN (triangulação de Delaunay, via scipy) —
o mesmo princípio da superfície do Civil 3D. Sem scipy instalado, cai
em IDW (inverso da distância) com os vizinhos mais próximos.
"""

from __future__ import annotations

import csv
import math

# Uma polyline de terreno: lista de vértices (E, N, Z)
TerrainLine = list[tuple[float, float, float]]


class TerrainError(Exception):
    pass


class TerrainModel:
    """Interpola cotas a partir dos vértices das curvas/pontos."""

    def __init__(self, points: list[tuple[float, float, float]]):
        # remove duplicados exatos de posição (quebram a triangulação)
        seen = {}
        for e, n, z in points:
            seen[(round(e, 3), round(n, 3))] = (e, n, z)
        self.points = list(seen.values())
        if len(self.points) < 3:
            raise TerrainError(
                "Terreno precisa de ao menos 3 pontos cotados distintos.")
        self._tin = None
        self._z = None
        try:
            import numpy as np
            from scipy.interpolate import LinearNDInterpolator
            from scipy.spatial import cKDTree
            xy = np.array([(p[0], p[1]) for p in self.points])
            z = np.array([p[2] for p in self.points])
            try:
                self._tin = LinearNDInterpolator(xy, z)
            except Exception:
                self._tin = None   # pontos colineares etc.
            self._kdtree = cKDTree(xy)
            self._z = z
        except ImportError:
            self._kdtree = None

    def elevation_at(self, e: float, n: float) -> float:
        """Cota interpolada em (E, N).

        Dentro do TIN: interpolação linear no triângulo. Fora do TIN (ou
        sem scipy): IDW com os vizinhos mais próximos.
        """
        if self._tin is not None:
            z = float(self._tin(e, n))
            if not math.isnan(z):
                return z
        return self._idw(e, n)

    def _idw(self, e: float, n: float, k: int = 8, power: float = 2.0):
        if self._kdtree is not None:
            dists, idxs = self._kdtree.query((e, n),
                                             k=min(k, len(self.points)))
            try:
                pairs = list(zip(dists, idxs))
            except TypeError:      # k == 1 devolve escalares
                pairs = [(dists, idxs)]
            num = den = 0.0
            for d, i in pairs:
                if d < 1e-9:
                    return float(self._z[i])
                w = 1.0 / d ** power
                num += w * float(self._z[i])
                den += w
            return num / den
        # fallback puro-python (sem scipy)
        best = sorted(((math.hypot(p[0] - e, p[1] - n), p[2])
                       for p in self.points))[:k]
        if best[0][0] < 1e-9:
            return best[0][1]
        num = sum(z / d ** power for d, z in best)
        den = sum(1.0 / d ** power for d, _z in best)
        return num / den


# ---------------------------------------------------------------- leitura
def lines_to_points(lines: list[TerrainLine]) -> list[tuple[float, float,
                                                            float]]:
    return [tuple(v) for line in lines for v in line]


def load_dxf(path: str) -> list[TerrainLine]:
    """Extrai polylines/pontos com elevação de um DXF."""
    try:
        import ezdxf
    except ImportError as exc:
        raise TerrainError(
            "Leitura de DXF requer o pacote 'ezdxf' "
            "(pip install ezdxf).") from exc
    try:
        doc = ezdxf.readfile(path)
    except Exception as exc:
        raise TerrainError(f"DXF inválido: {exc}") from exc

    lines: list[TerrainLine] = []
    for entity in doc.modelspace():
        kind = entity.dxftype()
        if kind == "LWPOLYLINE":
            z = float(entity.dxf.elevation)
            line = [(float(x), float(y), z)
                    for x, y, *_ in entity.get_points()]
            if line:
                lines.append(line)
        elif kind == "POLYLINE":
            line = []
            for v in entity.vertices:
                loc = v.dxf.location
                line.append((float(loc.x), float(loc.y), float(loc.z)))
            if line:
                lines.append(line)
        elif kind == "LINE":
            s, e = entity.dxf.start, entity.dxf.end
            lines.append([(float(s.x), float(s.y), float(s.z)),
                          (float(e.x), float(e.y), float(e.z))])
        elif kind == "POINT":
            loc = entity.dxf.location
            lines.append([(float(loc.x), float(loc.y), float(loc.z))])
    lines = [ln for ln in lines if any(abs(v[2]) > 1e-9 for v in ln)]
    if not lines:
        raise TerrainError(
            "Nenhuma polyline/ponto com elevação encontrada no DXF. "
            "Verifique se as curvas têm cota (elevation) definida.")
    return lines


def load_csv(path: str) -> list[TerrainLine]:
    """Lê pontos cotados de CSV com colunas E/X, N/Y, Z/COTA."""
    with open(path, encoding="utf-8-sig", newline="") as fh:
        sample = fh.read(4096)
        fh.seek(0)
        delimiter = ";" if sample.count(";") >= sample.count(",") else ","
        reader = csv.reader(fh, delimiter=delimiter)
        rows = [r for r in reader if any(cell.strip() for cell in r)]
    if not rows:
        raise TerrainError("CSV vazio.")

    def parse_num(text: str) -> float | None:
        text = text.strip().replace(",", ".")
        try:
            return float(text)
        except ValueError:
            return None

    header = [c.strip().upper() for c in rows[0]]
    idx_e = idx_n = idx_z = None
    for i, name in enumerate(header):
        if name in ("E", "X", "ESTE", "LESTE"):
            idx_e = i
        elif name in ("N", "Y", "NORTE"):
            idx_n = i
        elif name in ("Z", "COTA", "ELEV", "ELEVACAO", "ELEVAÇÃO", "H"):
            idx_z = i
    if idx_e is None or idx_n is None or idx_z is None:
        # sem cabeçalho reconhecível: assume E;N;Z nas 3 primeiras colunas
        idx_e, idx_n, idx_z = 0, 1, 2
        data_rows = rows
    else:
        data_rows = rows[1:]

    points: TerrainLine = []
    for row in data_rows:
        if len(row) <= max(idx_e, idx_n, idx_z):
            continue
        e = parse_num(row[idx_e])
        n = parse_num(row[idx_n])
        z = parse_num(row[idx_z])
        if e is not None and n is not None and z is not None:
            points.append((e, n, z))
    if len(points) < 3:
        raise TerrainError(
            "CSV precisa de ao menos 3 pontos com E, N e Z numéricos.")
    return [points]
