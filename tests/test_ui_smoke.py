"""Teste de fumaça da interface (roda offscreen, sem display)."""

import os

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

pytest.importorskip("PySide6")

from PySide6.QtWidgets import QApplication  # noqa: E402

from sanesim.core.models import Project  # noqa: E402
from sanesim.ui.main_window import MainWindow  # noqa: E402


@pytest.fixture(scope="module")
def app():
    application = QApplication.instance() or QApplication([])
    yield application


def test_window_roundtrip(app, tmp_path):
    window = MainWindow()
    window.project = Project.load("examples/exemplo_rede.json")
    window._load_all()

    # os dados carregados devem sobreviver ao ciclo load -> apply
    lengths_before = [round(window.project.pipe_length(p), 3)
                      for p in window.project.pipes]
    window._apply_all()
    assert len(window.project.nodes) == 8
    assert len(window.project.pipes) == 7
    assert window.project.criteria.end.population == 5200
    # regressão: coordenadas com milhar não podem corromper as extensões
    lengths_after = [round(window.project.pipe_length(p), 3)
                     for p in window.project.pipes]
    assert lengths_after == lengths_before

    # simulação disparada como na barra de ferramentas
    window.run_simulation()
    assert window.last_result is not None
    assert len(window.last_result.pipes) == 7
    assert not window.last_result.has_violations

    # memorial exportado a partir do resultado da janela
    from sanesim.core.memorial import export_memorial
    out = tmp_path / "memorial.xlsx"
    export_memorial(window.project, window.last_result, str(out))
    assert out.exists() and out.stat().st_size > 5000

    # aba de resultados preenchida (2 linhas por trecho)
    assert window.results_tab.table.rowCount() == 14


def test_tab_edits_reach_project(app):
    window = MainWindow()
    window.project = Project.load("examples/exemplo_rede.json")
    window._load_all()

    window.criteria_tab.title_edit.setText("Título Editado")
    window.design_tab.max_depth.setValue(7.5)
    window.calc_tab.rename.setChecked(True)
    window._apply_all()

    assert window.project.title == "Título Editado"
    assert window.project.design.max_depth_m == 7.5
    assert window.project.options.rename_nodes is True

    window.run_simulation()
    assert window.last_result.renamed  # PVs renomeados em ordem de cálculo
