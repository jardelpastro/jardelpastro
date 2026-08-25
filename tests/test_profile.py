import pytest

from sanesim.core.models import Project
from sanesim.core.profile import build_geometry, build_ose_paths, build_paths
from sanesim.core.simulation import simulate


@pytest.fixture()
def project_result():
    proj = Project.load("examples/exemplo_rede.json")
    res = simulate(proj)
    return proj, res


def test_paths_start_at_heads_and_flow_left_to_right(project_result):
    _proj, res = project_result
    paths = build_paths(res)
    assert paths
    downstream_nodes = {r.downstream for r in res.pipes}
    for path in paths:
        # começa numa cabeceira (nó sem trecho chegando)
        assert path.pipes[0].upstream not in downstream_nodes
        # sequência contínua: jusante de um = montante do próximo
        for a, b in zip(path.pipes, path.pipes[1:]):
            assert a.downstream == b.upstream


def test_geometry_water_inside_pipe(project_result):
    _proj, res = project_result
    for path in build_paths(res):
        x_prev = -1.0
        for seg in build_geometry(path):
            # x cresce da esquerda (montante) para a direita (jusante)
            assert seg.x0 > x_prev - 1e-9
            assert seg.x1 > seg.x0
            x_prev = seg.x0
            # lâmina dentro do tubo: geratriz inf <= N.A. <= geratriz sup
            assert seg.invert0 <= seg.water0 <= seg.crown0 + 1e-9
            assert seg.invert1 <= seg.water1 <= seg.crown1 + 1e-9
            # coerência com a lâmina calculada
            d = seg.pipe.diameter_mm / 1000.0
            assert seg.water0 - seg.invert0 == pytest.approx(
                seg.pipe.yd_end * d, rel=1e-9)


def test_ose_paths_split_by_run(project_result):
    proj, res = project_result
    proj.oses = []
    proj.ensure_oses()
    proj.oses[0].number = "9"
    paths = build_ose_paths(proj, res)
    # o exemplo tem um ramal afluente: a OSE gera 2 caminhos contínuos
    assert len(paths) == 2
    assert all(p.label.startswith("OSE 9") for p in paths)
    assert sum(len(p.pipes) for p in paths) == len(proj.pipes)
    for path in paths:
        for a, b in zip(path.pipes, path.pipes[1:]):
            assert a.downstream == b.upstream
