import pytest

ezdxf = pytest.importorskip("ezdxf")

from sanesim.core.dxf_export import export_plan_dxf, export_profile_dxf
from sanesim.core.models import Project
from sanesim.core.profile import build_paths
from sanesim.core.simulation import simulate


@pytest.fixture()
def project_result():
    proj = Project.load("examples/exemplo_rede.json")
    proj.network_colors["C1"] = "#2e7d32"
    res = simulate(proj)
    return proj, res


def test_export_plan_dxf(project_result, tmp_path):
    proj, res = project_result
    # terreno para conferir as curvas 3D
    proj.terrain_lines = [[[671900, 7184600, 806.0], [672200, 7184600, 806.0]],
                          [[671900, 7184700, 807.0], [672200, 7184700, 807.0]]]
    out = tmp_path / "planta.dxf"
    export_plan_dxf(proj, res, str(out))

    doc = ezdxf.readfile(str(out))
    msp = doc.modelspace()
    layers = {layer.dxf.name for layer in doc.layers}
    assert {"SANESIM-PV", "SANESIM-PV-TEXTO", "SANESIM-REDE-TEXTO",
            "SANESIM-SETAS", "SANESIM-CURVAS-NIVEL",
            "SANESIM-REDE-C1"} <= layers
    # cor da rede aplicada no layer
    assert doc.layers.get("SANESIM-REDE-C1").rgb == (0x2e, 0x7d, 0x32)

    pipes = [e for e in msp if e.dxftype() == "LWPOLYLINE"
             and e.dxf.layer == "SANESIM-REDE-C1"]
    assert len(pipes) == len(proj.pipes)
    # PVs: círculos + triângulo da EEE
    circles = [e for e in msp if e.dxftype() == "CIRCLE"]
    triangles = [e for e in msp if e.dxftype() == "LWPOLYLINE"
                 and e.dxf.layer == "SANESIM-PV"]
    assert len(circles) == 7 and len(triangles) == 1
    # coordenadas reais (E, N) — sem inversão de eixo
    node = proj.node_by_name("PV-01")
    assert any(abs(c.dxf.center.x - node.coord_e) < 1e-6
               and abs(c.dxf.center.y - node.coord_n) < 1e-6
               for c in circles)
    # setas de fluxo e textos com DN
    solids = [e for e in msp if e.dxftype() == "SOLID"]
    assert len(solids) == len(proj.pipes)
    texts = [e.dxf.text for e in msp if e.dxftype() == "TEXT"]
    assert any("DN 150" in t for t in texts)
    assert any(t == "PV-01" for t in texts)
    # curvas de nível em polyline 3D com a cota
    p3d = [e for e in msp if e.dxftype() == "POLYLINE"
           and e.dxf.layer == "SANESIM-CURVAS-NIVEL"]
    assert len(p3d) == 2
    zs = {round(v.dxf.location.z, 1) for v in p3d[0].vertices}
    assert zs <= {806.0, 807.0}


def test_export_profile_dxf(project_result, tmp_path):
    _proj, res = project_result
    path_obj = build_paths(res)[0]
    out = tmp_path / "perfil.dxf"
    export_profile_dxf(path_obj, str(out), scale_h=1000, scale_v=100)

    doc = ezdxf.readfile(str(out))
    msp = doc.modelspace()
    layers = {layer.dxf.name for layer in doc.layers}
    assert {"PERFIL-TERRENO", "PERFIL-TUBO", "PERFIL-NA", "PERFIL-PV",
            "PERFIL-GRID", "PERFIL-GRID-MESTRE", "PERFIL-BANDAS",
            "PERFIL-TEXTO"} <= layers
    # terreno: uma linha por trecho; tubo: duas (GI e GS)
    ground = [e for e in msp if e.dxftype() == "LINE"
              and e.dxf.layer == "PERFIL-TERRENO"]
    tube = [e for e in msp if e.dxftype() == "LINE"
            and e.dxf.layer == "PERFIL-TUBO"]
    assert len(ground) == len(path_obj.pipes)
    assert len(tube) == 2 * len(path_obj.pipes)
    # lâmina fechada por trecho e retângulos de PV
    water = [e for e in msp if e.dxftype() == "LWPOLYLINE"
             and e.dxf.layer == "PERFIL-NA"]
    pv_rects = [e for e in msp if e.dxftype() == "LWPOLYLINE"
                and e.dxf.layer == "PERFIL-PV"]
    assert len(water) == len(path_obj.pipes)
    assert len(pv_rects) == len(path_obj.pipes) + 1
    # exagero vertical 10x: dy do terreno = 10 * (cota_up - cota_down)
    s = path_obj.pipes[0]
    g0 = next(e for e in ground if abs(e.dxf.start.x) < 1e-6)
    dy = g0.dxf.start.y - g0.dxf.end.y
    assert dy == pytest.approx(10.0 * (s.ground_up - s.ground_down),
                               rel=1e-6)
    texts = [e.dxf.text for e in msp if e.dxftype() == "TEXT"]
    assert any(t.startswith("PERFIL -") for t in texts)
    assert any("Distâncias (m)" == t for t in texts)
    assert any("I = " in t for t in texts)
