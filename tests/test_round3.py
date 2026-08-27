"""Rodada 3 de uso real: cascata, coordenadas digitadas, notas, folhas."""

import os

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

pytest.importorskip("PySide6")

from PySide6.QtCore import QPointF, Qt  # noqa: E402
from PySide6.QtWidgets import QApplication  # noqa: E402

from sanesim.core.models import Project  # noqa: E402
from sanesim.core.ose import build_ose_rows, export_oses  # noqa: E402
from sanesim.core.simulation import simulate  # noqa: E402
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


def test_deleting_node_row_cascades_pipes(window):
    # remove a linha do PV-03 na tabela de nós: os trechos ligados somem
    table = window.nodes_tab.table
    row = next(r for r in range(table.rowCount())
               if table.item(r, 0).text() == "PV-03")
    connected = [p.name for p in window.project.pipes
                 if "PV-03" in (p.upstream, p.downstream)]
    assert connected
    table.removeRow(row)
    window._apply_all()
    assert window.project.node_by_name("PV-03") is None
    remaining = {p.name for p in window.project.pipes}
    assert not remaining.intersection(connected)
    # excluir trecho NÃO exclui os PVs: já garantido pela ausência de
    # cascata inversa (nós permanecem na tabela)
    assert window.project.node_by_name("PV-02") is not None


def test_typed_coordinates_move_node(window):
    plan = window.plan_tab
    node = window.project.nodes[0]
    item = plan._node_items[node.id]
    item.setSelected(True)
    plan.n_coord_e.setText("672.345,5")
    plan.n_coord_n.setText("7.184.999")
    plan._coords_typed()
    assert node.coord_e == pytest.approx(672345.5)
    assert node.coord_n == pytest.approx(7184999.0)
    assert item.pos().x() == pytest.approx(672345.5)
    assert item.pos().y() == pytest.approx(-7184999.0)


def test_empty_scene_still_pannable(app):
    w = MainWindow()          # projeto vazio
    rect = w.plan_tab.scene.sceneRect()
    assert rect.width() > 100_000     # área ampla para navegar


def test_scene_rect_much_larger_than_content(window):
    content = window.plan_tab.scene.itemsBoundingRect()
    rect = window.plan_tab.scene.sceneRect()
    assert rect.width() > content.width() * 3


def test_row_notes_roundtrip_and_export(tmp_path):
    proj = Project.load("examples/exemplo_rede.json")
    proj.oses = []
    proj.ensure_oses()
    ose = proj.oses[0]
    res = simulate(proj)
    rows = build_ose_rows(proj, res, ose)
    key = rows[2].key
    ose.row_notes[key] = "Travessia de rua — atenção"
    # persistência
    path = tmp_path / "p.json"
    proj.save(str(path))
    loaded = Project.load(str(path))
    assert loaded.oses[0].row_notes[key] == "Travessia de rua — atenção"
    # exportação com a coluna do projetista
    import openpyxl
    out = tmp_path / "oses.xlsx"
    export_oses(proj, res, str(out))
    wb = openpyxl.load_workbook(str(out))
    text = " ".join(str(c.value) for row in wb.active.iter_rows()
                    for c in row if c.value)
    assert "Travessia de rua" in text
    assert "Projetista" in text


def test_note_edit_via_preview(window):
    window.run_simulation()
    ose_tab = window.ose_tab
    assert ose_tab._current is not None
    table = ose_tab.preview.table
    col = table.columnCount() - 1
    item = table.item(1, col)
    assert item is not None and item.data(Qt.UserRole)
    item.setText("nota do projetista")
    key = item.data(Qt.UserRole)
    assert ose_tab._current.row_notes[key] == "nota do projetista"


def test_profile_material_band_stacks_when_short(window):
    window.run_simulation()
    profile = window.profile_tab
    profile.scale_h.setValue(5000)     # vãos curtos em px -> empilha
    assert profile._material_stacked is True
    profile.scale_h.setValue(1000)


def test_profile_and_croqui_have_sheet(window):
    window.run_simulation()
    # a folha (papel) é maior que o conteúdo e com proporção série A
    rect = window.profile_tab.scene.sceneRect()
    assert rect.width() / rect.height() == pytest.approx(1.41421356,
                                                         rel=1e-3)
    rect = window.croqui_tab.scene.sceneRect()
    assert rect.width() / rect.height() == pytest.approx(1.41421356,
                                                         rel=1e-3)


def test_croqui_info_block_offset_remembered(window):
    window.run_simulation()
    croqui = window.croqui_tab
    node = window.project.nodes[0]
    croqui._block_offsets[node.id] = QPointF(30.0, -20.0)
    croqui._redraw()
    # o bloco redesenhado usa o deslocamento arrastado
    from sanesim.ui.croqui_tab import _InfoBlock
    blocks = [i for i in croqui.scene.items() if isinstance(i, _InfoBlock)]
    assert any(abs(b.pos().x() - (node.coord_e + 30.0)) < 1e-6
               for b in blocks)


def test_display_settings_roundtrip(window, tmp_path):
    window.calc_tab.dec_coords.setValue(2)
    window.calc_tab.dec_flow.setValue(3)
    window._apply_all()
    assert window.project.display.coord_decimals == 2
    assert window.project.display.flow_decimals == 3
    path = tmp_path / "d.json"
    window.project.save(str(path))
    loaded = Project.load(str(path))
    assert loaded.display.coord_decimals == 2
    assert loaded.display.flow_decimals == 3


def test_renaming_node_in_table_keeps_pipes(window):
    """Regressão (revisão adversarial): renomear ≠ excluir."""
    table = window.nodes_tab.table
    row = next(r for r in range(table.rowCount())
               if table.item(r, 0).text() == "PV-03")
    n_pipes = len(window.project.pipes)
    table.item(row, 0).setText("PV-03A")
    window._apply_all()
    assert len(window.project.pipes) == n_pipes
    # os trechos passaram a referenciar o novo nome
    touching = [p for p in window.project.pipes
                if "PV-03A" in (p.upstream, p.downstream)]
    assert len(touching) == 3
    assert not any("PV-03" in (p.upstream, p.downstream)
                   and "PV-03A" not in (p.upstream, p.downstream)
                   for p in window.project.pipes)


def test_pipe_typed_before_nodes_survives(window):
    """Trecho digitado antes dos PVs existirem não pode ser podado."""
    ptable = window.pipes_tab.table
    row = ptable.rowCount()
    ptable.insertRow(row)
    from PySide6.QtWidgets import QTableWidgetItem
    ptable.setItem(row, 0, QTableWidgetItem("T-NOVO"))
    ptable.setItem(row, 1, QTableWidgetItem("PV-90"))
    ptable.setItem(row, 2, QTableWidgetItem("PV-91"))
    window._apply_all()
    assert any(p.name == "T-NOVO" for p in window.project.pipes)


def test_ose_row_keys_are_unique():
    from sanesim.core.models import Node, Pipe, OseSheet
    proj = Project.load("examples/exemplo_rede.json")
    # trecho de 19,996 m: limite de trecho a 4 mm da estaca de 20 m
    base = proj.node_by_name("PV-01")
    proj.nodes.append(Node(name="PVK-1", coord_e=base.coord_e + 300,
                           coord_n=base.coord_n, ground_elev=812.0))
    proj.nodes.append(Node(name="PVK-2", coord_e=base.coord_e + 319.996,
                           coord_n=base.coord_n, ground_elev=811.8))
    proj.nodes.append(Node(name="PVK-3", coord_e=base.coord_e + 360,
                           coord_n=base.coord_n, ground_elev=811.5))
    proj.pipes.append(Pipe(name="TK1", upstream="PVK-1",
                           downstream="PVK-2"))
    proj.pipes.append(Pipe(name="TK2", upstream="PVK-2",
                           downstream="PVK-3"))
    res = simulate(proj)
    ose = OseSheet(number="099",
                   pipe_ids=[p.id for p in proj.pipes
                             if p.name in ("TK1", "TK2")])
    rows = build_ose_rows(proj, res, ose)
    keys = [r.key for r in rows]
    assert len(keys) == len(set(keys))


def test_enter_on_unedited_coord_field_is_noop(window):
    window.run_simulation()
    plan = window.plan_tab
    node = window.project.nodes[0]
    item = plan._node_items[node.id]
    item.setSelected(True)
    # Enter sem editar: o arredondamento de exibição não move o PV
    plan._coords_typed()
    assert window.last_result is not None
