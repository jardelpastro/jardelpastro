"""Tela principal: traçado contínuo, invalidação e gestão de OSEs."""

import os

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

pytest.importorskip("PySide6")

from PySide6.QtCore import QPointF  # noqa: E402
from PySide6.QtWidgets import QApplication  # noqa: E402

from sanesim.core.models import OseSheet, Project  # noqa: E402
from sanesim.ui.main_window import MainWindow  # noqa: E402


@pytest.fixture(scope="module")
def app():
    yield QApplication.instance() or QApplication([])


@pytest.fixture()
def window(app):
    w = MainWindow()
    w.project = Project.load("examples/exemplo_rede.json")
    w._load_all()
    return w


def test_draw_mode_chains_nodes_and_pipes(window):
    plan = window.plan_tab
    plan.set_mode("draw")
    n_nodes = len(window.project.nodes)
    n_pipes = len(window.project.pipes)
    # três cliques no vazio: 3 PVs e 2 trechos encadeados
    plan.draw_click(QPointF(672300.0, -7184700.0))
    plan.draw_click(QPointF(672350.0, -7184650.0))
    plan.draw_click(QPointF(672400.0, -7184600.0))
    assert len(window.project.nodes) == n_nodes + 3
    assert len(window.project.pipes) == n_pipes + 2
    p1, p2 = window.project.pipes[-2], window.project.pipes[-1]
    assert p1.downstream == p2.upstream
    assert p2.upstream == window.project.nodes[-2].name


def test_draw_mode_connects_to_existing_node(window):
    plan = window.plan_tab
    plan.set_mode("draw")
    # cria um nó livre (sem saída), encerra a sequência e reinicia dele
    plan.draw_click(QPointF(672250.0, -7184750.0))
    free_node = window.project.nodes[-1]
    plan._draw_last = None
    n_nodes = len(window.project.nodes)
    plan.draw_click(QPointF(free_node.coord_e, -free_node.coord_n))
    assert len(window.project.nodes) == n_nodes    # conectou, não criou
    plan.draw_click(QPointF(free_node.coord_e + 80.0, -free_node.coord_n))
    assert window.project.pipes[-1].upstream == free_node.name


def test_draw_from_node_with_outlet_is_blocked(window):
    plan = window.plan_tab
    plan.set_mode("draw")
    existing = window.project.node_by_name("PV-01")   # já tem saída (T1)
    n_pipes = len(window.project.pipes)
    plan.draw_click(QPointF(existing.coord_e, -existing.coord_n))
    plan.draw_click(QPointF(existing.coord_e + 60.0, -existing.coord_n))
    assert len(window.project.pipes) == n_pipes       # bloqueado
    assert "única saída" in plan.status.text()


def test_draw_eee_ends_drawing(window):
    plan = window.plan_tab
    plan.set_mode("draw")
    plan.draw_click(QPointF(672600.0, -7184500.0))
    plan.node_type_combo.setCurrentText("EEE")
    plan.draw_click(QPointF(672650.0, -7184450.0))
    new_node = window.project.nodes[-1]
    assert new_node.node_type == "EEE"
    assert plan.mode == "select"          # elevatória encerra o traçado
    assert window.project.pipes[-1].downstream == new_node.name


def test_network_change_invalidates_results(window):
    window.run_simulation()
    assert window.last_result is not None
    window.plan_tab.add_node_at(QPointF(672700.0, -7184400.0))
    assert window.last_result is None     # topologia mudou: descarta


def test_live_update_during_drag(window):
    plan = window.plan_tab
    node = window.project.nodes[0]
    item = plan._node_items[node.id]
    item.setSelected(True)
    item.setPos(672123.0, -7184987.0)     # simula o arrasto
    assert "672.123" in plan.n_coord_e.text()
    assert "7.184.987" in plan.n_coord_n.text()


def test_ose_sequential_numbering(window):
    ose_tab = window.ose_tab
    window.project.oses = [OseSheet(number="41")]
    ose_tab.load_from(window.project)
    ose_tab._new_ose()
    assert window.project.oses[-1].number == "42"
    ose_tab._new_ose()
    assert window.project.oses[-1].number == "43"


def test_ose_cancelada_flag_and_serialization(tmp_path):
    proj = Project.load("examples/exemplo_rede.json")
    proj.ensure_oses()
    proj.oses[0].status = "cancelada"
    path = tmp_path / "c.json"
    proj.save(str(path))
    loaded = Project.load(str(path))
    assert loaded.oses[0].status == "cancelada"


def test_click_without_move_keeps_results(window):
    window.run_simulation()
    assert window.last_result is not None
    plan = window.plan_tab
    item = next(iter(plan._node_items.values()))
    # clique simples (sem arrastar): resultados preservados
    plan._node_drag_finished(item, moved=False)
    assert window.last_result is not None
    # arrasto real: resultados invalidados
    plan._node_drag_finished(item, moved=True)
    assert window.last_result is None


def test_object_identity_survives_table_apply(window):
    node = window.project.nodes[0]
    pipe = window.project.pipes[0]
    window._apply_all()
    assert window.project.nodes[0] is node     # atualização em-lugar
    assert window.project.pipes[0] is pipe
    # o item da planta continua apontando para o MESMO objeto
    assert window.plan_tab._node_items[node.id].node is node


def test_pipe_follows_dragged_node_after_apply(window):
    window._apply_all()                        # ciclo que antes quebrava
    plan = window.plan_tab
    node = window.project.node_by_name("PV-01")
    item = plan._node_items[node.id]
    pipe_item = next(p for p in plan._pipe_items.values()
                     if p.pipe.upstream == "PV-01")
    item.setPos(node.coord_e + 40.0, -(node.coord_n + 25.0))
    line = pipe_item.line()
    assert line.x1() == pytest.approx(node.coord_e)
    assert line.y1() == pytest.approx(-node.coord_n)
    assert node.coord_e == pytest.approx(item.pos().x())


def test_simulation_rejects_two_outlets():
    from sanesim.core.models import Pipe
    from sanesim.core.simulation import SimulationError, simulate
    proj = Project.load("examples/exemplo_rede.json")
    proj.pipes.append(Pipe(name="T99", upstream="PV-01",
                           downstream="PV-04"))
    with pytest.raises(SimulationError, match="única tubulação de saída"):
        simulate(proj)


def test_more_than_three_arrivals_warns():
    from sanesim.core.models import Node, Pipe
    from sanesim.core.simulation import simulate
    proj = Project.load("examples/exemplo_rede.json")
    # cria 4 cabeceiras chegando no PV-06 (que já recebe T5): 5 chegadas
    base = proj.node_by_name("PV-06")
    for i in range(4):
        name = f"PVX-{i}"
        proj.nodes.append(Node(name=name, coord_e=base.coord_e + 50 + i,
                               coord_n=base.coord_n + 50 + i,
                               ground_elev=base.ground_elev + 1.0))
        proj.pipes.append(Pipe(name=f"TX{i}", upstream=name,
                               downstream="PV-06"))
    res = simulate(proj)
    assert any("chegadas" in m and "PV-06" in m for m in res.messages)
    arriving = [r for r in res.pipes if r.downstream == "PV-06"]
    assert len(arriving) == 5
    assert all(any("chegadas" in v for v in r.violations)
               for r in arriving)


def test_profile_paths_are_ose_only(window):
    window.run_simulation()
    combo = window.profile_tab.path_combo
    assert combo.count() > 0
    for i in range(combo.count()):
        assert combo.itemText(i).startswith("OSE")


def test_croqui_has_own_selector(window):
    window.run_simulation()
    croqui = window.croqui_tab
    assert croqui.ose_combo.count() == len(window.project.oses)
    croqui.ose_combo.setCurrentIndex(0)
    assert "CROQUI — OSE" in croqui.header.text()


def test_cancelada_marked_in_export(tmp_path):
    import openpyxl
    from sanesim.core.ose import export_oses
    from sanesim.core.simulation import simulate
    proj = Project.load("examples/exemplo_rede.json")
    proj.oses = []
    proj.ensure_oses()
    proj.oses[0].number = "7"
    proj.oses[0].status = "cancelada"
    res = simulate(proj)
    out = tmp_path / "oses.xlsx"
    export_oses(proj, res, str(out))
    wb = openpyxl.load_workbook(str(out))
    assert wb.sheetnames == ["OSE 7 CANCELADA"]
    text = " ".join(str(c.value) for row in wb.active.iter_rows()
                    for c in row if c.value)
    assert "CANCELADA" in text
