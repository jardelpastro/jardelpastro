import pytest

from sanesim.core.models import (CalcOptions, DesignCriteria, Node, Pipe,
                                 PlanCriteria, Project, ProjectCriteria)
from sanesim.core.simulation import SimulationError, simulate


def small_project() -> Project:
    proj = Project(title="Teste")
    proj.criteria = ProjectCriteria(
        start=PlanCriteria(population=2000, per_capita=150, return_coef=0.8,
                           k1=1.2, k2=1.5),
        end=PlanCriteria(population=3000, per_capita=150, return_coef=0.8,
                         k1=1.2, k2=1.5),
        infiltration_rate=0.1,
    )
    proj.design = DesignCriteria(min_diameter_mm=150, min_cover_m=0.9,
                                 max_depth_m=6.0)
    proj.options = CalcOptions(default_material="pvc_ocre")
    proj.nodes = [
        Node("PV-1", ground_elev=100.0, coord_n=0, coord_e=0),
        Node("PV-2", ground_elev=99.0, coord_n=0, coord_e=100),
        Node("PV-3", ground_elev=98.0, coord_n=0, coord_e=200),
    ]
    proj.pipes = [
        Pipe("T1", "PV-1", "PV-2", length=100.0),
        Pipe("T2", "PV-2", "PV-3", length=100.0),
    ]
    return proj


def test_flow_accumulation():
    proj = small_project()
    res = simulate(proj)
    t1, t2 = res.pipes
    assert t1.pipe == "T1" and t2.pipe == "T2"
    # taxa linear: K2 * C*P*q/86400 / L_km + infiltração
    qmed_ini = 0.8 * 2000 * 150 / 86400
    rate_ini = 1.5 * qmed_ini / 0.2 + 0.1
    assert res.rate_start == pytest.approx(rate_ini, rel=1e-9)
    assert t1.q_down_start == pytest.approx(rate_ini * 0.1, rel=1e-9)
    # T2 recebe tudo de T1
    assert t2.q_up_start == pytest.approx(t1.q_down_start, rel=1e-9)
    assert t2.q_down_end == pytest.approx(res.rate_end * 0.2, rel=1e-6)


def test_design_respects_criteria():
    proj = small_project()
    res = simulate(proj)
    for r in res.pipes:
        assert r.diameter_mm >= proj.design.min_diameter_mm
        assert r.yd_end <= proj.design.max_yd + 1e-9
        assert r.tractive_pa >= proj.design.min_tractive_pa - 1e-6
        assert r.cover_up >= proj.design.min_cover_m - 1e-6
        assert r.cover_down >= proj.design.min_cover_m - 1e-6
        assert not r.violations


def test_invert_continuity():
    proj = small_project()
    res = simulate(proj)
    t1, t2 = res.pipes
    # o coletor não pode subir no sentido do fluxo
    assert t1.invert_down >= t2.invert_up - 1e-9
    assert t1.invert_up > t1.invert_down
    assert t2.invert_up > t2.invert_down


def test_no_diameter_reduction_downstream():
    proj = small_project()
    # força DN 300 no primeiro trecho; o segundo não pode reduzir
    proj.pipes[0].diameter_mm = 300
    res = simulate(proj)
    assert res.pipes[1].diameter_mm >= 300


def test_point_flow_enters_accumulation():
    proj = small_project()
    proj.nodes[1].q_point_start = 5.0
    proj.nodes[1].q_point_end = 8.0
    res = simulate(proj)
    t1, t2 = res.pipes
    assert t2.q_up_start == pytest.approx(t1.q_down_start + 5.0, rel=1e-9)
    assert t2.q_up_end == pytest.approx(t1.q_down_end + 8.0, rel=1e-9)


def test_loop_detected():
    proj = small_project()
    proj.pipes.append(Pipe("T3", "PV-3", "PV-1", length=50.0))
    with pytest.raises(SimulationError):
        simulate(proj)


def test_rename_nodes():
    proj = small_project()
    proj.options.rename_nodes = True
    proj.options.rename_prefix = "PV-"
    res = simulate(proj)
    assert res.renamed["PV-1"] == "PV-01"
    assert res.pipes[0].upstream == "PV-01"


def test_length_from_coordinates():
    proj = small_project()
    proj.pipes[0].length = 0.0  # deve usar as coordenadas (100 m)
    res = simulate(proj)
    assert res.pipes[0].length == pytest.approx(100.0, rel=1e-9)


def test_roundtrip_serialization(tmp_path):
    proj = small_project()
    path = tmp_path / "p.json"
    proj.save(str(path))
    loaded = Project.load(str(path))
    assert loaded.title == proj.title
    assert loaded.criteria.start.population == 2000
    assert len(loaded.pipes) == 2
    assert loaded.catalog[0].key == "pvc_ocre"
    res = simulate(loaded)
    assert len(res.pipes) == 2
