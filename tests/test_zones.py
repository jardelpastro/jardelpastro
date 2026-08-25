import pytest

from sanesim.core.models import (ContributionZone, Node, Pipe, PlanCriteria,
                                 Project, ProjectCriteria)
from sanesim.core.simulation import simulate


def zoned_project() -> Project:
    proj = Project(title="Zonas")
    proj.criteria = ProjectCriteria(
        start=PlanCriteria(population=1000, per_capita=150, return_coef=0.8,
                           k1=1.2, k2=1.5),
        end=PlanCriteria(population=1500, per_capita=150, return_coef=0.8,
                         k1=1.2, k2=1.5),
        infiltration_rate=0.1,
        zones=[
            ContributionZone(key="Z1", name="Região de prédios",
                             population_start=2000, population_end=3000,
                             per_capita_start=200, per_capita_end=200,
                             return_coef=0.85),
        ],
    )
    proj.nodes = [
        Node("PV-1", ground_elev=100.0),
        Node("PV-2", ground_elev=99.0),
        Node("PV-3", ground_elev=98.0),
    ]
    proj.pipes = [
        Pipe("T1", "PV-1", "PV-2", length=100.0),            # zona global
        Pipe("T2", "PV-2", "PV-3", length=100.0, zone="Z1"),  # adensada
    ]
    return proj


def test_zone_population_included_in_global_by_default():
    """Padrão: a população da zona É parte da global (desconto no rateio).

    Global 1000 hab com zona de 2000 hab -> o rateio global fica com
    max(0, 1000-2000) = 0 hab (e a simulação avisa o excesso).
    """
    proj = zoned_project()
    assert proj.criteria.zones_included_in_global is True
    res = simulate(proj)
    t1, t2 = res.pipes
    # global zerado (só infiltração), pois a zona concentra mais que o total
    assert t1.rate_start == pytest.approx(0.1, rel=1e-9)
    assert any("excede" in m for m in res.messages)
    # Z1: pop 2000, q=200, C=0,85 rateada nos 100 m da zona
    qmed_z = 0.85 * 2000 * 200 / 86400
    rate_z = 1.5 * qmed_z / 0.1 + 0.1
    assert t2.rate_start == pytest.approx(rate_z, rel=1e-9)
    assert t2.zone == "Z1"
    assert res.zone_rates["Z1"][0] == pytest.approx(rate_z, rel=1e-9)


def test_zone_population_discount():
    """Global 5000 hab, zona concentra 2000 -> restante 3000 fora da zona."""
    proj = zoned_project()
    proj.criteria.start.population = 5000
    proj.criteria.end.population = 6000
    res = simulate(proj)
    t1 = res.pipes[0]
    qmed_g = 0.8 * (5000 - 2000) * 150 / 86400
    rate_g = 1.5 * qmed_g / 0.1 + 0.1
    assert t1.rate_start == pytest.approx(rate_g, rel=1e-9)
    assert not any("excede" in m for m in res.messages)


def test_zone_population_additional_mode():
    """zones_included_in_global=False: zona é contribuição adicional."""
    proj = zoned_project()
    proj.criteria.zones_included_in_global = False
    res = simulate(proj)
    t1, t2 = res.pipes
    qmed_g = 0.8 * 1000 * 150 / 86400
    rate_g = 1.5 * qmed_g / 0.1 + 0.1
    assert t1.rate_start == pytest.approx(rate_g, rel=1e-9)
    qmed_z = 0.85 * 2000 * 200 / 86400
    rate_z = 1.5 * qmed_z / 0.1 + 0.1
    assert t2.rate_start == pytest.approx(rate_z, rel=1e-9)


def test_zone_accumulation_continues_downstream():
    proj = zoned_project()
    res = simulate(proj)
    t1, t2 = res.pipes
    # a vazão de montante de T2 é a de jusante de T1 (zonas não quebram
    # a continuidade hidráulica)
    assert t2.q_up_start == pytest.approx(t1.q_down_start, rel=1e-9)
    assert t2.q_down_end == pytest.approx(
        t1.q_down_end + t2.rate_end * 0.1, rel=1e-9)


def test_manual_zone_rates():
    proj = zoned_project()
    proj.criteria.zones[0].auto = False
    proj.criteria.zones[0].rate_start_manual = 5.0
    proj.criteria.zones[0].rate_end_manual = 9.0
    res = simulate(proj)
    t2 = res.pipes[1]
    assert t2.rate_start == pytest.approx(5.0 + 0.1)
    assert t2.rate_end == pytest.approx(9.0 + 0.1)


def test_unknown_zone_flags_violation_and_uses_global():
    proj = zoned_project()
    proj.pipes[1].zone = "Z9"
    res = simulate(proj)
    t1, t2 = res.pipes
    assert any("Z9" in v for v in t2.violations)
    assert t2.rate_start == pytest.approx(t1.rate_start, rel=1e-9)


def test_zone_without_pipes_warns():
    proj = zoned_project()
    proj.pipes[1].zone = ""
    res = simulate(proj)
    assert any("Z1" in m for m in res.messages)


def test_zone_serialization_roundtrip(tmp_path):
    proj = zoned_project()
    path = tmp_path / "z.json"
    proj.save(str(path))
    loaded = Project.load(str(path))
    assert loaded.criteria.zones[0].key == "Z1"
    assert loaded.criteria.zones[0].population_end == 3000
    assert loaded.pipes[1].zone == "Z1"


def test_stable_ids_survive_roundtrip(tmp_path):
    proj = zoned_project()
    node_id = proj.nodes[0].id
    pipe_id = proj.pipes[0].id
    assert node_id and pipe_id
    path = tmp_path / "ids.json"
    proj.save(str(path))
    loaded = Project.load(str(path))
    assert loaded.nodes[0].id == node_id
    assert loaded.pipes[0].id == pipe_id


def test_v1_project_migrates(tmp_path):
    # projeto salvo antes do schema_version/ids/zonas deve abrir normalmente
    import json
    v1 = {
        "title": "Antigo",
        "criteria": {"start": {"population": 100}, "end": {},
                     "infiltration_rate": 0.1, "auto_linear_rate": True,
                     "linear_rate_start": 0, "linear_rate_end": 0},
        "design": {}, "options": {},
        "nodes": [{"name": "PV-1", "ground_elev": 10.0},
                  {"name": "PV-2", "ground_elev": 9.0}],
        "pipes": [{"name": "T1", "upstream": "PV-1", "downstream": "PV-2",
                   "length": 50.0}],
    }
    path = tmp_path / "v1.json"
    path.write_text(json.dumps(v1), encoding="utf-8")
    loaded = Project.load(str(path))
    assert loaded.nodes[0].id
    assert loaded.pipes[0].id
    assert loaded.criteria.zones == []
    simulate(loaded)


def test_future_version_rejected(tmp_path):
    import json
    path = tmp_path / "future.json"
    path.write_text(json.dumps({"schema_version": 99}), encoding="utf-8")
    with pytest.raises(ValueError):
        Project.load(str(path))
