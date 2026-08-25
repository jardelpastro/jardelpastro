"""Cores da planta, símbolos por tipo e exportação do perfil."""

import os

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

pytest.importorskip("PySide6")

from PySide6.QtWidgets import QApplication  # noqa: E402

from sanesim.core.models import Project  # noqa: E402
from sanesim.ui.main_window import MainWindow  # noqa: E402
from sanesim.ui.plan_tab import _node_path  # noqa: E402


@pytest.fixture(scope="module")
def app():
    yield QApplication.instance() or QApplication([])


@pytest.fixture()
def window(app):
    w = MainWindow()
    w.project = Project.load("examples/exemplo_rede.json")
    w._load_all()
    return w


def test_eee_is_triangle_pv_is_circle(app):
    # triângulo tem 3 vértices (4 elementos com o fechamento); círculo não
    tri = _node_path("EEE")
    circ = _node_path("PV")
    assert tri.elementCount() <= 5
    assert circ.elementCount() > 5


def test_pipe_color_precedence(window):
    plan = window.plan_tab
    pipe = window.project.pipes[0]
    item = plan._pipe_items[pipe.id]
    default = item.base_color().name()
    # cor por rede
    window.project.network_colors[pipe.network or ""] = "#00aa00"
    assert item.base_color().name() == "#00aa00"
    # cor individual tem prioridade sobre a da rede
    pipe.color = "#123456"
    assert item.base_color().name() == "#123456"
    # violação tem prioridade máxima
    item.violated = True
    assert item.base_color().name() == "#cc0000"
    item.violated = False
    pipe.color = ""
    del window.project.network_colors[pipe.network or ""]
    assert item.base_color().name() == default


def test_node_color_override(window):
    plan = window.plan_tab
    node = window.project.nodes[0]
    item = plan._node_items[node.id]
    default = item.fill_color().name()
    node.color = "#ff00ff"
    assert item.fill_color().name() == "#ff00ff"
    node.color = ""
    assert item.fill_color().name() == default


def test_colors_serialization_roundtrip(tmp_path):
    proj = Project.load("examples/exemplo_rede.json")
    proj.network_colors["C1"] = "#00aa00"
    proj.pipes[0].color = "#123456"
    proj.nodes[0].color = "#ff00ff"
    path = tmp_path / "cores.json"
    proj.save(str(path))
    loaded = Project.load(str(path))
    assert loaded.network_colors["C1"] == "#00aa00"
    assert loaded.pipes[0].color == "#123456"
    assert loaded.nodes[0].color == "#ff00ff"


def test_profile_export_png_pdf(window, tmp_path):
    window.run_simulation()
    profile = window.profile_tab
    png = tmp_path / "perfil.png"
    pdf = tmp_path / "perfil.pdf"
    profile.export_png(str(png))
    profile.export_pdf(str(pdf))
    assert png.exists() and png.stat().st_size > 10_000
    assert pdf.exists() and pdf.stat().st_size > 5_000
    with open(pdf, "rb") as fh:
        assert fh.read(5) == b"%PDF-"
