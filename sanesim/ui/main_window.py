"""Janela principal do SaneSim.

A PLANTA é a tela principal (fundo de trabalho permanente); os demais
conteúdos abrem como janelas sobre ela, pelos botões da barra:

- Dados do Projeto: critérios, dimensionamento, método e materiais.
- Tabelas da Rede: nós e trechos.
- Resultados: planilha de resultados da simulação.
- OSEs: grupo Planilha | Perfil | Croqui — uma OSE é composta pelas
  três vistas, sincronizadas pela OSE selecionada na lista.

A simulação (F5) e as exportações funcionam de qualquer lugar. Qualquer
alteração de topologia invalida os resultados da simulação anterior.
"""

from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtGui import QAction, QKeySequence
from PySide6.QtWidgets import (QDialog, QFileDialog, QMainWindow,
                               QMessageBox, QTabWidget, QVBoxLayout)

from ..core.memorial import export_memorial
from ..core.models import Project
from ..core.ose import OseError, export_oses
from ..core.simulation import SimulationError, simulate
from .criteria_tabs import CalcTab, CriteriaTab, DesignTab
from .croqui_tab import CroquiTab
from .network_tabs import MaterialsTab, NodesTab, PipesTab
from .ose_tab import OseTab
from .plan_tab import PlanTab
from .profile_tab import ProfileTab
from .results_tab import ResultsTab
from .style import app_icon


class _ToolWindow(QDialog):
    """Janela flutuante não modal sobre a tela principal."""

    def __init__(self, parent, title: str, widget, size=(900, 620)):
        super().__init__(parent)
        self.setWindowTitle(f"SaneSim — {title}")
        self.setModal(False)
        self.resize(*size)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.addWidget(widget)

    def open_raise(self):
        self.show()
        self.raise_()
        self.activateWindow()


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("SaneSim — Simulador de Redes de Esgoto "
                            "(Pastro Engenharia)")
        self.setWindowIcon(app_icon())
        self.resize(1360, 820)
        self.project = Project()
        self.last_result = None
        self._project_path: str | None = None

        # ------------------------------ tela principal: a PLANTA
        self.plan_tab = PlanTab()
        self.plan_tab.result_provider = lambda: self.last_result
        self.plan_tab.network_changed = self._on_network_changed
        self.setCentralWidget(self.plan_tab)

        # ------------------------------ conteúdos das janelas
        self.criteria_tab = CriteriaTab()
        self.design_tab = DesignTab()
        self.calc_tab = CalcTab()
        self.materials_tab = MaterialsTab()
        self.nodes_tab = NodesTab()
        self.pipes_tab = PipesTab()
        self.results_tab = ResultsTab()
        self.ose_tab = OseTab()
        self.ose_tab.result_provider = lambda: self.last_result
        self.profile_tab = ProfileTab()
        self.croqui_tab = CroquiTab()

        project_tabs = QTabWidget()
        project_tabs.addTab(self.criteria_tab, "Critérios de Projeto")
        project_tabs.addTab(self.design_tab, "Dimensionamento")
        project_tabs.addTab(self.calc_tab, "Método de Cálculo")
        project_tabs.addTab(self.materials_tab, "Materiais e Tubos")
        self.win_project = _ToolWindow(self, "Dados do Projeto",
                                       project_tabs, (980, 680))

        network_tabs = QTabWidget()
        network_tabs.addTab(self.nodes_tab, "Nós (PVs)")
        network_tabs.addTab(self.pipes_tab, "Trechos")
        self.win_network = _ToolWindow(self, "Tabelas da Rede",
                                       network_tabs, (1050, 620))
        network_tabs.currentChanged.connect(self._tables_edited)

        self.win_results = _ToolWindow(self, "Resultados",
                                       self.results_tab, (1250, 640))

        # grupo OSE: Planilha | Perfil | Croqui (mesma OSE selecionada)
        self.ose_group = QTabWidget()
        self.ose_group.addTab(self.ose_tab, "Planilha")
        self.ose_group.addTab(self.profile_tab, "Perfil")
        self.ose_group.addTab(self.croqui_tab, "Croqui")
        self.win_ose = _ToolWindow(self, "OSE — Planilha / Perfil / Croqui",
                                   self.ose_group, (1280, 720))
        self.ose_group.currentChanged.connect(self._sync_ose_views)
        self.ose_tab.ose_list.currentRowChanged.connect(
            lambda _row: self._sync_ose_views())

        self._build_toolbar()
        self._load_all()
        self.statusBar().showMessage(
            "Pronto. Trace a rede na tela principal; F5 roda a simulação.")

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
               "Roda a simulação com os dados atuais.")
        bar.addSeparator()
        action("Dados do Projeto", self.win_project.open_raise, "Ctrl+1")
        action("Tabelas da Rede", self.win_network.open_raise, "Ctrl+2")
        action("Resultados", self.win_results.open_raise, "Ctrl+3")
        action("OSEs", self.win_ose.open_raise, "Ctrl+4")
        bar.addSeparator()
        action("Exportar Memorial…", self.export_memorial, "Ctrl+E")
        action("Exportar OSEs…", self.export_ose, "Ctrl+Shift+E")

    # ------------------------------------------------------------------
    def _load_all(self):
        self.criteria_tab.load_from(self.project)
        self.design_tab.load_from(self.project)
        self.calc_tab.load_from(self.project)
        self.nodes_tab.load_from(self.project)
        self.pipes_tab.load_from(self.project)
        self.materials_tab.load_from(self.project)
        self.ose_tab.load_from(self.project)
        self.plan_tab.load_from(self.project)
        self._sync_ose_views()

    def _apply_all(self):
        # o catálogo primeiro: os combos de material dependem dele
        self.materials_tab.apply_to(self.project)
        self.criteria_tab.apply_to(self.project)
        self.design_tab.apply_to(self.project)
        self.calc_tab.apply_to(self.project)
        self.nodes_tab.apply_to(self.project)
        self.pipes_tab.apply_to(self.project)
        self.ose_tab.apply_to(self.project)

    def _tables_edited(self, *_):
        """Ao navegar nas tabelas, aplica e reflete na tela principal."""
        self.nodes_tab.apply_to(self.project)
        self.pipes_tab.apply_to(self.project)
        self.plan_tab.load_from(self.project)

    def _on_network_changed(self):
        """Edição de topologia/geometria: sincroniza e invalida resultados."""
        self.nodes_tab.load_from(self.project)
        self.pipes_tab.load_from(self.project)
        self.ose_tab.load_from(self.project)
        self.invalidate_results()

    def invalidate_results(self):
        """A rede mudou: os resultados da última simulação não valem mais."""
        if self.last_result is None:
            return
        self.last_result = None
        self.results_tab.show_invalidated()
        self.plan_tab.clear_result_markers()
        self.ose_tab._refresh_preview()
        self.statusBar().showMessage(
            "Rede alterada — os resultados anteriores foram descartados. "
            "Rode a simulação novamente (F5).")

    def _sync_ose_views(self, *_):
        """Perfil e croqui seguem a OSE selecionada na Planilha."""
        ose = self.ose_tab._current
        self.croqui_tab.set_context(self.project, self.last_result, ose)
        if ose is not None and self.last_result is not None:
            combo = self.profile_tab.path_combo
            prefix = f"OSE {ose.number}"
            for i in range(combo.count()):
                if combo.itemText(i).startswith(prefix):
                    combo.setCurrentIndex(i)
                    break

    # ------------------------------------------------------------------
    def _confirm_discard(self) -> bool:
        """Pergunta antes de descartar o projeto aberto. True = seguir."""
        box = QMessageBox(self)
        box.setWindowTitle("Novo projeto")
        box.setText("Deseja salvar o projeto aberto antes de criar um "
                    "novo?\nO novo projeto começa vazio (sem rede, OSEs "
                    "ou perfis).")
        save_btn = box.addButton("Salvar e criar novo",
                                 QMessageBox.AcceptRole)
        discard_btn = box.addButton("Criar novo sem salvar",
                                    QMessageBox.DestructiveRole)
        cancel_btn = box.addButton("Voltar", QMessageBox.RejectRole)
        box.setDefaultButton(save_btn)
        box.exec()
        if box.clickedButton() is cancel_btn:
            return False
        if box.clickedButton() is save_btn:
            self.save_project()
            if self._project_path is None:
                return False    # usuário cancelou o salvar como
        return True

    def new_project(self):
        if not self._confirm_discard():
            return
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
        # o desenho acompanha o modelo (tabelas podem ter mudado coords)
        self.plan_tab.refresh_geometry()
        # simular sempre volta o cursor ao modo Selecionar
        self.plan_tab.exit_to_select()
        try:
            self.last_result = simulate(self.project)
        except SimulationError as exc:
            QMessageBox.warning(self, "Simulação", str(exc))
            return
        self.results_tab.show_result(self.last_result)
        self.ose_tab._refresh_preview()
        self.profile_tab.show_result(self.project, self.last_result)
        self.plan_tab.show_result(self.project, self.last_result)
        self._sync_ose_views()
        self.win_results.open_raise()
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
                    "os dados na janela OSEs.")
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
