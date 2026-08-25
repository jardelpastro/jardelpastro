"""Desfazer/refazer, snap e divisão de trecho no editor de planta."""

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


def test_undo_add_node(window):
    plan = window.plan_tab
    n_before = len(window.project.nodes)
    plan.add_node_at(QPointF(672300.0, -7184700.0))
    assert len(window.project.nodes) == n_before + 1
    plan.undo()
    assert len(window.project.nodes) == n_before
    plan.redo()
    assert len(window.project.nodes) == n_before + 1
    assert window.project.nodes[-1].coord_e == pytest.approx(672300.0)


def test_undo_delete_node_restores_pipes(window):
    plan = window.plan_tab
    n_nodes = len(window.project.nodes)
    n_pipes = len(window.project.pipes)
    node = window.project.node_by_name("PV-03")
    plan.delete_node(node)
    assert len(window.project.pipes) < n_pipes
    plan.undo()
    assert len(window.project.nodes) == n_nodes
    assert len(window.project.pipes) == n_pipes
    assert window.project.node_by_name("PV-03") is not None
    # ids preservados no restore
    assert window.project.node_by_name("PV-03").id == node.id


def test_undo_move_node(window):
    plan = window.plan_tab
    node = window.project.nodes[0]
    item = plan._node_items[node.id]
    e0, n0 = node.coord_e, node.coord_n
    plan.checkpoint()                      # como no início do arrasto
    item.setPos(e0 + 50.0, -(n0 + 30.0))
    plan.undo_stack.drop_if_unchanged(window.project)
    assert node.coord_e == pytest.approx(e0 + 50.0)
    plan.undo()
    node = window.project.node_by_name(node.name)
    assert node.coord_e == pytest.approx(e0)
    assert node.coord_n == pytest.approx(n0)


def test_noop_click_does_not_pollute_stack(window):
    plan = window.plan_tab
    depth = len(plan.undo_stack.undo_states)
    plan.checkpoint()                      # clique sem arrasto
    plan.undo_stack.drop_if_unchanged(window.project)
    assert len(plan.undo_stack.undo_states) == depth


def test_redo_cleared_after_new_action(window):
    plan = window.plan_tab
    plan.add_node_at(QPointF(672400.0, -7184600.0))
    plan.undo()
    assert plan.undo_stack.redo_states
    plan.add_node_at(QPointF(672500.0, -7184500.0))
    assert not plan.undo_stack.redo_states


def test_snap_picks_nearest_node(window):
    plan = window.plan_tab
    node = window.project.node_by_name("PV-01")
    item = plan._node_items[node.id]
    # clique deslocado alguns metros do PV: com o fit atual, o raio de
    # 18 px cobre a distância
    near = plan.node_item_near(QPointF(node.coord_e + 3.0,
                                       -(node.coord_n + 3.0)))
    assert near is item
    far = plan.node_item_near(QPointF(node.coord_e + 5000.0,
                                      -node.coord_n))
    assert far is not item


def test_split_pipe(window):
    plan = window.plan_tab
    pipe = window.project.pipes[0]        # T1: PV-01 -> PV-02
    up = window.project.node_by_name(pipe.upstream)
    down = window.project.node_by_name(pipe.downstream)
    total_before = window.project.pipe_length(pipe)
    ground_mid = (up.ground_elev + down.ground_elev) / 2
    n_nodes = len(window.project.nodes)
    n_pipes = len(window.project.pipes)

    mid = QPointF((up.coord_e + down.coord_e) / 2,
                  -(up.coord_n + down.coord_n) / 2)
    plan.split_pipe(pipe, mid)

    assert len(window.project.nodes) == n_nodes + 1
    assert len(window.project.pipes) == n_pipes + 1
    new_node = window.project.nodes[-1]
    # conectividade: T1 termina no novo PV; o novo trecho segue adiante
    assert pipe.downstream == new_node.name
    new_pipe = window.project.pipes[n_pipes - 6]  # inserido logo após T1
    new_pipe = next(p for p in window.project.pipes
                    if p.upstream == new_node.name)
    assert new_pipe.downstream == down.name
    # comprimentos somam o original e a cota foi interpolada no meio
    l1 = window.project.pipe_length(pipe)
    l2 = window.project.pipe_length(new_pipe)
    assert l1 + l2 == pytest.approx(total_before, rel=1e-6)
    assert new_node.ground_elev == pytest.approx(ground_mid, abs=0.01)
    # desfazer volta ao estado original
    plan.undo()
    assert len(window.project.nodes) == n_nodes
    assert len(window.project.pipes) == n_pipes
    assert window.project.pipes[0].downstream == down.name
