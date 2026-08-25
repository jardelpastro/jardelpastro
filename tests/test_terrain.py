import pytest

from sanesim.core.models import Project
from sanesim.core.simulation import simulate
from sanesim.core.terrain import (TerrainError, TerrainModel, lines_to_points,
                                  load_csv, load_dxf)


def plane_points():
    """Plano z = 100 + 0,01x + 0,02y: interpolação linear deve ser exata."""
    pts = []
    for x in (0, 50, 100, 150, 200):
        for y in (0, 50, 100, 150, 200):
            pts.append((float(x), float(y), 100 + 0.01 * x + 0.02 * y))
    return pts


def test_tin_interpolates_plane_exactly():
    model = TerrainModel(plane_points())
    for e, n in ((25, 25), (60, 130), (199, 1), (100, 100)):
        expected = 100 + 0.01 * e + 0.02 * n
        assert model.elevation_at(e, n) == pytest.approx(expected, abs=1e-6)


def test_outside_hull_falls_back_gracefully():
    model = TerrainModel(plane_points())
    z = model.elevation_at(500.0, 500.0)   # fora das curvas
    assert 100.0 <= z <= 106.0             # limitado pela faixa dos dados


def test_needs_three_points():
    with pytest.raises(TerrainError):
        TerrainModel([(0, 0, 1), (1, 1, 2)])


def test_load_dxf_lwpolyline_and_polyline(tmp_path):
    ezdxf = pytest.importorskip("ezdxf")
    doc = ezdxf.new()
    msp = doc.modelspace()
    # curva de nível como LWPOLYLINE com elevation
    msp.add_lwpolyline([(0, 0), (100, 0), (200, 10)],
                       dxfattribs={"elevation": 810.0})
    # curva como POLYLINE 3D
    msp.add_polyline3d([(0, 50, 812.0), (100, 50, 812.0), (200, 60, 812.0)])
    # entidade sem cota deve ser ignorada
    msp.add_lwpolyline([(0, 100), (100, 100)], dxfattribs={"elevation": 0})
    path = tmp_path / "curvas.dxf"
    doc.saveas(str(path))

    lines = load_dxf(str(path))
    assert len(lines) == 2
    zs = {round(line[0][2], 1) for line in lines}
    assert zs == {810.0, 812.0}
    model = TerrainModel(lines_to_points(lines))
    # entre as curvas 810 e 812, a meia distância, cota ~811
    assert model.elevation_at(100.0, 25.0) == pytest.approx(811.0, abs=0.3)


def test_load_csv_with_headers(tmp_path):
    path = tmp_path / "pontos.csv"
    path.write_text("E;N;COTA\n0;0;800,5\n100;0;801\n0;100;802\n50;50;801,2\n",
                    encoding="utf-8")
    lines = load_csv(str(path))
    pts = lines_to_points(lines)
    assert len(pts) == 4
    assert pts[0] == (0.0, 0.0, 800.5)


def test_load_csv_without_headers(tmp_path):
    path = tmp_path / "pontos.txt"
    path.write_text("0,0,800\n100,0,801\n0,100,802\n", encoding="utf-8")
    pts = lines_to_points(load_csv(str(path)))
    assert len(pts) == 3


def test_simulation_with_interpolated_elevations():
    proj = Project.load("examples/exemplo_rede.json")
    # terreno sintético: plano inclinado cobrindo a rede, 2 m acima
    # das cotas manuais para ficar visível a diferença
    es = [n.coord_e for n in proj.nodes]
    ns = [n.coord_n for n in proj.nodes]
    e0, e1 = min(es) - 100, max(es) + 100
    n0, n1 = min(ns) - 100, max(ns) + 100
    def z(e, n):
        return 800.0 + 0.01 * (e - e0) + 0.005 * (n - n0)
    grid = []
    steps = 6
    for i in range(steps + 1):
        row = []
        e = e0 + (e1 - e0) * i / steps
        for j in range(steps + 1):
            n = n0 + (n1 - n0) * j / steps
            row.append([e, n, z(e, n)])
        grid.append(row)
    proj.terrain_lines = grid
    proj.options.elevation_source = "interpolar"
    res = simulate(proj)
    assert any("interpoladas" in m for m in res.messages)
    node = proj.node_by_name(res.pipes[0].upstream) or proj.nodes[0]
    r0 = res.pipes[0]
    up = proj.node_by_name("PV-01")
    assert r0.ground_up == pytest.approx(z(up.coord_e, up.coord_n), abs=0.05)
    # cotas manuais NÃO são alteradas (interpolação só na simulação)
    assert up.ground_elev == pytest.approx(812.50)


def test_terrain_serialization_roundtrip(tmp_path):
    proj = Project.load("examples/exemplo_rede.json")
    proj.terrain_lines = [[[0, 0, 800], [100, 0, 800]],
                          [[0, 50, 802], [100, 50, 802]]]
    path = tmp_path / "t.json"
    proj.save(str(path))
    loaded = Project.load(str(path))
    assert len(loaded.terrain_lines) == 2
    assert loaded.terrain_lines[1][0] == [0, 50, 802]
