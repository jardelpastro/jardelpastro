"""Janela principal do SaneSim.

A simulação pode ser disparada de qualquer aba (F5 ou botão na barra de
ferramentas) — não é preciso passar por todas as abas antes.
"""

from __future__ import annotations

from PySide6.QtGui import QAction, QKeySequence
from PySide6.QtWidgets import (QFileDialog, QMainWindow, QMessageBox,
                               QTabWidget)

from ..core.memorial import export_memorial
from ..core.models import Project
from ..core.ose import OseError, export_oses
from ..core.simulation import SimulationError, simulate
from .criteria_tabs import CalcTab, CriteriaTab, DesignTab
from .network_tabs import MaterialsTab, NodesTab, PipesTab
from .ose_tab import OseTab
from .profile_tab import ProfileTab
from .results_tab import ResultsTab


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("SaneSim — Simulador de Redes de Esgoto")
        self.resize(1280, 760)
        self.project = Project()
        self.last_result = None
        self._project_path: str | None = None

        self.tabs = QTabWidget()
        self.criteria_tab = CriteriaTab()
        self.design_tab = DesignTab()
        self.calc_tab = CalcTab()
        self.nodes_tab = NodesTab()
        self.pipes_tab = PipesTab()
        self.materials_tab = MaterialsTab()
        self.results_tab = ResultsTab()
        self.ose_tab = OseTab()
        self.ose_tab.result_provider = lambda: self.last_result
        self.profile_tab = ProfileTab()
        self.tabs.addTab(self.criteria_tab, "1. Critérios de Projeto")
        self.tabs.addTab(self.design_tab, "2. Dimensionamento")
        self.tabs.addTab(self.calc_tab, "3. Método de Cálculo")
        self.tabs.addTab(self.nodes_tab, "4. Nós (PVs)")
        self.tabs.addTab(self.pipes_tab, "5. Trechos")
        self.tabs.addTab(self.materials_tab, "6. Materiais e Tubos")
        self.tabs.addTab(self.results_tab, "7. Resultados")
        self.tabs.addTab(self.ose_tab, "8. OSEs")
        self.tabs.addTab(self.profile_tab, "9. Perfil")
        self.setCentralWidget(self.tabs)

        self._build_toolbar()
        self._load_all()
        self.statusBar().showMessage("Pronto. F5 roda a simulação de "
                                     "qualquer aba.")

    # ------------------------------------------------------------------
    def _build_toolbar(self):
        bar = self.addToolBar("Principal")
        bar.setMovable(False)

        def action(text, slot, shortcut=None, tip=None):
            act = QAction(text, self)
            act.triggered.connect(slot)
            if shortcut:
                act.setShortcut(QKeySequence(shortcut))
            if tip:
                act.setToolTip(tip)
            bar.addAction(act)
            return act

        action("Novo", self.new_project, "Ctrl+N")
        action("Abrir…", self.open_project, "Ctrl+O")
        action("Salvar", self.save_project, "Ctrl+S")
        action("Salvar como…", self.save_project_as, "Ctrl+Shift+S")
        bar.addSeparator()
        action("▶ Rodar Simulação", self.run_simulation, "F5",
               "Roda a simulação com os dados atuais (de qualquer aba).")
        action("Exportar Memorial…", self.export_memorial, "Ctrl+E",
               "Gera o memorial de cálculo em Excel (.xlsx).")
        action("Exportar OSEs…", self.export_ose, "Ctrl+Shift+E",
               "Gera as OSEs do projeto (uma folha por OSE, estaqueamento "
               "a cada 20 m).")

    # ------------------------------------------------------------------
    def _load_all(self):
        self.criteria_tab.load_from(self.project)
        self.design_tab.load_from(self.project)
        self.calc_tab.load_from(self.project)
        self.nodes_tab.load_from(self.project)
        self.pipes_tab.load_from(self.project)
        self.materials_tab.load_from(self.project)
        self.ose_tab.load_from(self.project)

    def _apply_all(self):
        # o catálogo primeiro: os combos de material dependem dele
        self.materials_tab.apply_to(self.project)
        self.criteria_tab.apply_to(self.project)
        self.design_tab.apply_to(self.project)
        self.calc_tab.apply_to(self.project)
        self.nodes_tab.apply_to(self.project)
        self.pipes_tab.apply_to(self.project)
        self.ose_tab.apply_to(self.project)

    # ------------------------------------------------------------------
    def new_project(self):
        self.project = Project()
        self._project_path = None
        self.last_result = None
        self._load_all()
        self.statusBar().showMessage("Novo projeto criado.")

    def open_project(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "Abrir projeto", "", "Projeto SaneSim (*.json)")
        if not path:
            return
        try:
            self.project = Project.load(path)
        except Exception as exc:
            QMessageBox.critical(self, "Erro ao abrir",
                                 f"Não foi possível abrir o projeto:\n{exc}")
            return
        self._project_path = path
        self.last_result = None
        self._load_all()
        self.statusBar().showMessage(f"Projeto aberto: {path}")

    def save_project(self):
        if not self._project_path:
            self.save_project_as()
            return
        self._apply_all()
        self.project.save(self._project_path)
        self.statusBar().showMessage(f"Projeto salvo: {self._project_path}")

    def save_project_as(self):
        path, _ = QFileDialog.getSaveFileName(
            self, "Salvar projeto", "projeto.json",
            "Projeto SaneSim (*.json)")
        if not path:
            return
        self._project_path = path
        self.save_project()

    # ------------------------------------------------------------------
    def run_simulation(self):
        self._apply_all()
        try:
            self.last_result = simulate(self.project)
        except SimulationError as exc:
            QMessageBox.warning(self, "Simulação", str(exc))
            return
        self.results_tab.show_result(self.last_result)
        self.ose_tab._refresh_preview()
        self.profile_tab.show_result(self.project, self.last_result)
        if self.tabs.currentWidget() not in (self.ose_tab,
                                             self.profile_tab):
            self.tabs.setCurrentWidget(self.results_tab)
        n_viol = sum(1 for r in self.last_result.pipes if r.violations)
        if n_viol:
            self.statusBar().showMessage(
                f"Simulação concluída com {n_viol} trecho(s) em violação.")
        else:
            self.statusBar().showMessage(
                "Simulação concluída: todos os critérios atendidos.")

    def export_memorial(self):
        if self.last_result is None:
            self.run_simulation()
            if self.last_result is None:
                return
        path, _ = QFileDialog.getSaveFileName(
            self, "Exportar memorial de cálculo", "memorial.xlsx",
            "Planilha Excel (*.xlsx)")
        if not path:
            return
        try:
            export_memorial(self.project, self.last_result, path)
        except Exception as exc:
            QMessageBox.critical(self, "Erro ao exportar",
                                 f"Não foi possível gravar o memorial:\n{exc}")
            return
        self.statusBar().showMessage(f"Memorial exportado: {path}")

    def export_ose(self):
        if self.last_result is None:
            self.run_simulation()
            if self.last_result is None:
                return
        self._apply_all()
        if not self.project.oses:
            created = self.project.ensure_oses()
            if created:
                self.ose_tab.load_from(self.project)
                self.statusBar().showMessage(
                    f"{created} OSE(s) gerada(s) automaticamente — revise "
                    "os dados na aba OSEs.")
        path, _ = QFileDialog.getSaveFileName(
            self, "Exportar OSEs (uma folha por OSE)", "oses.xlsx",
            "Planilha Excel (*.xlsx)")
        if not path:
            return
        try:
            export_oses(self.project, self.last_result, path)
        except OseError as exc:
            QMessageBox.warning(self, "OSEs", str(exc))
            return
        except Exception as exc:
            QMessageBox.critical(self, "Erro ao exportar",
                                 f"Não foi possível gravar as OSEs:\n{exc}")
            return
        self.statusBar().showMessage(
            f"{len(self.project.oses)} OSE(s) exportada(s): {path}")
