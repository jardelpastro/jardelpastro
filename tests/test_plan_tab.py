"""Testes do editor gráfico de planta (offscreen)."""

import os

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

pytest.importorskip("PySide6")

from PySide6.QtCore import QPointF  # noqa: E402
from PySide6.QtWidgets import QApplication  # noqa: E402

from sanesim.core.models import Project  # noqa: E402
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


def test_plan_loads_network(window):
    plan = window.plan_tab
    assert len(plan._node_items) == 8
    assert len(plan._pipe_items) == 7


def test_add_node_via_click_position(window):
    plan = window.plan_tab
    plan.set_mode("add_node")
    n_before = len(window.project.nodes)
    # clique em uma posição da planta (x=E, y=-N)
    plan.add_node_at(QPointF(672200.0, -7184700.0))
    assert len(window.project.nodes) == n_before + 1
    new = window.project.nodes[-1]
    assert new.coord_e == pytest.approx(672200.0)
    assert new.coord_n == pytest.approx(7184700.0)
    assert new.name.startswith("PV-")
    # as tabelas foram sincronizadas
    assert window.nodes_tab.table.rowCount() == n_before + 1


def test_add_pipe_by_picking_nodes(window):
    plan = window.plan_tab
    plan.set_mode("add_pipe")
    items = list(plan._node_items.values())
    n_before = len(window.project.pipes)
    plan.pick_pipe_node(items[0])
    plan.pick_pipe_node(items[1])
    assert len(window.project.pipes) == n_before + 1
    pipe = window.project.pipes[-1]
    assert pipe.upstream == items[0].node.name
    assert pipe.downstream == items[1].node.name
    assert window.pipes_tab.table.rowCount() == n_before + 1


def test_move_node_updates_coordinates(window):
    plan = window.plan_tab
    plan.set_mode("select")
    item = next(iter(plan._node_items.values()))
    item.setPos(672500.0, -7185100.0)
    assert item.node.coord_e == pytest.approx(672500.0)
    assert item.node.coord_n == pytest.approx(7185100.0)


def test_rename_node_via_panel_updates_pipes(window):
    plan = window.plan_tab
    item = plan._node_items[window.project.nodes[0].id]
    item.setSelected(True)
    old_name = item.node.name
    plan.n_name.setText("PV-RENOMEADO")
    plan.apply_panel()
    assert item.node.name == "PV-RENOMEADO"
    for pipe in window.project.pipes:
        assert old_name not in (pipe.upstream, pipe.downstream)


def test_delete_node_removes_connected_pipes(window):
    plan = window.plan_tab
    node = window.project.node_by_name("PV-03")
    connected = [p.name for p in window.project.pipes
                 if "PV-03" in (p.upstream, p.downstream)]
    assert connected
    plan.delete_node(node)
    assert window.project.node_by_name("PV-03") is None
    remaining = {p.name for p in window.project.pipes}
    assert not remaining.intersection(connected)


def test_results_shown_on_selection(window):
    window.run_simulation()
    plan = window.plan_tab
    pipe_item = next(iter(plan._pipe_items.values()))
    pipe_item.setSelected(True)
    assert plan.results_box.isVisibleTo(plan)
    assert plan.results_form.rowCount() > 0
    # o rótulo do trecho ganhou o DN adotado
    assert "DN" in pipe_item.label.text()
