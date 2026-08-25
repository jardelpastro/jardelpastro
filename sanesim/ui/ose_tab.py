"""Aba OSEs: criação, edição dos dados não hidráulicos e prévia da planilha.

Os campos aqui editados (número, ruas, observações, responsáveis, régua)
pertencem à entidade OseSheet do projeto — a mesma que a planta e o
perfil usam. Alterar aqui reflete em todas as vistas e na exportação.
"""

from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (QDoubleSpinBox, QFormLayout, QGroupBox,
                               QHBoxLayout, QLabel, QLineEdit, QListWidget,
                               QListWidgetItem, QPlainTextEdit, QPushButton,
                               QSplitter, QTableWidget, QTableWidgetItem,
                               QVBoxLayout, QWidget)

from ..core import fmt
from ..core.models import OseSheet, Project
from ..core.ose import HEADERS as OSE_HEADERS
from ..core.ose import build_ose_rows


class OseTab(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self._project: Project | None = None
        self._current: OseSheet | None = None
        self.result_provider = lambda: None   # definido pela MainWindow

        layout = QVBoxLayout(self)
        splitter = QSplitter(Qt.Horizontal)
        layout.addWidget(splitter)

        # ------------------------------------------------- lista (esquerda)
        left = QWidget()
        lv = QVBoxLayout(left)
        lv.addWidget(QLabel("OSEs do projeto:"))
        self.ose_list = QListWidget()
        self.ose_list.currentRowChanged.connect(self._on_select)
        lv.addWidget(self.ose_list)
        buttons = QHBoxLayout()
        new_btn = QPushButton("Nova OSE")
        new_btn.clicked.connect(self._new_ose)
        del_btn = QPushButton("Remover")
        del_btn.clicked.connect(self._remove_ose)
        gen_btn = QPushButton("Gerar p/ trechos sem OSE")
        gen_btn.setToolTip("Cria uma OSE por rede para os trechos que "
                           "ainda não pertencem a nenhuma OSE.")
        gen_btn.clicked.connect(self._generate)
        buttons.addWidget(new_btn)
        buttons.addWidget(del_btn)
        lv.addLayout(buttons)
        lv.addWidget(gen_btn)

        info_box = QGroupBox("Informações do projeto (padrão das OSEs)")
        form = QFormLayout(info_box)
        self.info_city = QLineEdit()
        self.info_system = QLineEdit()
        self.info_designer = QLineEdit()
        self.info_registration = QLineEdit()
        self.info_client = QLineEdit()
        form.addRow("Cidade:", self.info_city)
        form.addRow("Sistema:", self.info_system)
        form.addRow("Responsável técnico:", self.info_designer)
        form.addRow("Registro (CREA):", self.info_registration)
        form.addRow("Contratante:", self.info_client)
        lv.addWidget(info_box)
        splitter.addWidget(left)

        # -------------------------------------------------- edição (meio)
        mid = QWidget()
        mv = QVBoxLayout(mid)
        ose_box = QGroupBox("Dados da OSE selecionada (editáveis — não "
                            "alteram o dimensionamento)")
        form = QFormLayout(ose_box)
        self.f_number = QLineEdit()
        self.f_location = QLineEdit()
        self.f_cadastre = QLineEdit()
        self.f_city = QLineEdit()
        self.f_street = QLineEdit()
        self.f_side = QLineEdit()
        self.f_between = QLineEdit()
        self.f_and = QLineEdit()
        self.f_gauge = QDoubleSpinBox()
        self.f_gauge.setRange(0.5, 20.0)
        self.f_gauge.setDecimals(2)
        self.f_gauge.setSingleStep(0.5)
        self.f_gauge.setValue(3.0)
        self.f_gauge.setSuffix(" m")
        self.f_gauge.setToolTip(
            "Gabarito da régua/cruzeta. Redes profundas (ex.: 5 m) podem "
            "exigir régua maior nesta OSE específica.")
        self.f_obs = QPlainTextEdit()
        self.f_obs.setMaximumHeight(70)
        self.f_prop = QLineEdit()
        self.f_appr = QLineEdit()
        self.f_rel = QLineEdit()
        self.f_exec = QLineEdit()
        form.addRow("Número da O.S.E.:", self.f_number)
        form.addRow("Locação:", self.f_location)
        form.addRow("Nº folha de cadastro:", self.f_cadastre)
        form.addRow("Cidade (vazio = do projeto):", self.f_city)
        form.addRow("Rua:", self.f_street)
        form.addRow("Lado:", self.f_side)
        form.addRow("Entre rua:", self.f_between)
        form.addRow("E rua:", self.f_and)
        form.addRow("Gabarito da régua:", self.f_gauge)
        form.addRow("Observações:", self.f_obs)
        form.addRow("Proposição:", self.f_prop)
        form.addRow("Aprovação:", self.f_appr)
        form.addRow("Liberação p/ execução:", self.f_rel)
        form.addRow("Execução/cadastramento:", self.f_exec)
        mv.addWidget(ose_box)

        mv.addWidget(QLabel("Trechos desta OSE (a ordem segue a aba "
                            "Trechos):"))
        self.pipe_list = QListWidget()
        mv.addWidget(self.pipe_list)
        splitter.addWidget(mid)

        # ------------------------------------------------ prévia (direita)
        right = QWidget()
        rv = QVBoxLayout(right)
        self.preview_label = QLabel(
            "Prévia da planilha (rode a simulação para preencher):")
        self.preview_label.setWordWrap(True)
        rv.addWidget(self.preview_label)
        self.preview = QTableWidget(0, len(OSE_HEADERS))
        self.preview.setHorizontalHeaderLabels(OSE_HEADERS)
        self.preview.setEditTriggers(QTableWidget.NoEditTriggers)
        self.preview.setAlternatingRowColors(True)
        rv.addWidget(self.preview)
        refresh = QPushButton("Atualizar prévia")
        refresh.clicked.connect(self._refresh_preview)
        rv.addWidget(refresh)
        splitter.addWidget(right)
        splitter.setSizes([260, 380, 640])

        self.f_gauge.valueChanged.connect(self._refresh_preview_soft)

    # ------------------------------------------------------------------
    def load_from(self, project: Project):
        self._save_current()
        self._project = project
        self._current = None
        self.info_city.setText(project.info.city)
        self.info_system.setText(project.info.system)
        self.info_designer.setText(project.info.designer)
        self.info_registration.setText(project.info.registration)
        self.info_client.setText(project.info.client)
        self.ose_list.blockSignals(True)
        self.ose_list.clear()
        for ose in project.oses:
            self.ose_list.addItem(self._ose_label(ose))
        self.ose_list.blockSignals(False)
        if project.oses:
            self.ose_list.setCurrentRow(0)
        else:
            self._load_form(None)

    def apply_to(self, project: Project):
        self._project = project
        self._save_current()
        project.info.city = self.info_city.text().strip()
        project.info.system = self.info_system.text().strip()
        project.info.designer = self.info_designer.text().strip()
        project.info.registration = self.info_registration.text().strip()
        project.info.client = self.info_client.text().strip()

    # ------------------------------------------------------------------
    def _ose_label(self, ose: OseSheet) -> str:
        name = f"OSE {ose.number}" if ose.number else "OSE (sem número)"
        if ose.street:
            name += f" — {ose.street}"
        return name

    def _on_select(self, row: int):
        self._save_current()
        if self._project and 0 <= row < len(self._project.oses):
            self._load_form(self._project.oses[row])
        else:
            self._load_form(None)
        self._refresh_preview()

    def _load_form(self, ose: OseSheet | None):
        self._current = ose
        widgets = [self.f_number, self.f_location, self.f_cadastre,
                   self.f_city, self.f_street, self.f_side, self.f_between,
                   self.f_and, self.f_obs, self.f_prop, self.f_appr,
                   self.f_rel, self.f_exec, self.f_gauge, self.pipe_list]
        for w in widgets:
            w.setEnabled(ose is not None)
        if ose is None:
            for w in widgets[:13]:
                if isinstance(w, QLineEdit):
                    w.clear()
            self.f_obs.setPlainText("")
            self.pipe_list.clear()
            return
        self.f_number.setText(ose.number)
        self.f_location.setText(ose.location)
        self.f_cadastre.setText(ose.cadastre_sheet)
        self.f_city.setText(ose.city)
        self.f_street.setText(ose.street)
        self.f_side.setText(ose.side)
        self.f_between.setText(ose.between_street)
        self.f_and.setText(ose.and_street)
        self.f_gauge.setValue(ose.gauge_height)
        self.f_obs.setPlainText(ose.observations)
        self.f_prop.setText(ose.resp_proposal)
        self.f_appr.setText(ose.resp_approval)
        self.f_rel.setText(ose.resp_release)
        self.f_exec.setText(ose.resp_execution)
        self.pipe_list.clear()
        if self._project:
            selected = set(ose.pipe_ids)
            for pipe in self._project.pipes:
                item = QListWidgetItem(
                    f"{pipe.name}  ({pipe.upstream} → {pipe.downstream})")
                item.setData(Qt.UserRole, pipe.id)
                item.setFlags(item.flags() | Qt.ItemIsUserCheckable)
                item.setCheckState(Qt.Checked if pipe.id in selected
                                   else Qt.Unchecked)
                self.pipe_list.addItem(item)

    def _save_current(self):
        ose = self._current
        if ose is None:
            return
        ose.number = self.f_number.text().strip()
        ose.location = self.f_location.text().strip()
        ose.cadastre_sheet = self.f_cadastre.text().strip()
        ose.city = self.f_city.text().strip()
        ose.street = self.f_street.text().strip()
        ose.side = self.f_side.text().strip()
        ose.between_street = self.f_between.text().strip()
        ose.and_street = self.f_and.text().strip()
        ose.gauge_height = self.f_gauge.value()
        ose.observations = self.f_obs.toPlainText().strip()
        ose.resp_proposal = self.f_prop.text().strip()
        ose.resp_approval = self.f_appr.text().strip()
        ose.resp_release = self.f_rel.text().strip()
        ose.resp_execution = self.f_exec.text().strip()
        pipe_ids = []
        for i in range(self.pipe_list.count()):
            item = self.pipe_list.item(i)
            if item.checkState() == Qt.Checked:
                pipe_ids.append(item.data(Qt.UserRole))
        ose.pipe_ids = pipe_ids
        row = self.ose_list.currentRow()
        if self._project and 0 <= row < len(self._project.oses):
            self.ose_list.item(row).setText(self._ose_label(ose))

    # ------------------------------------------------------------------
    def _new_ose(self):
        if self._project is None:
            return
        self._save_current()
        self._project.oses.append(OseSheet(
            number=str(len(self._project.oses) + 1),
            city=self._project.info.city))
        self.ose_list.addItem(self._ose_label(self._project.oses[-1]))
        self.ose_list.setCurrentRow(self.ose_list.count() - 1)

    def _remove_ose(self):
        row = self.ose_list.currentRow()
        if self._project is None or row < 0:
            return
        self._current = None
        del self._project.oses[row]
        self.ose_list.takeItem(row)

    def _generate(self):
        if self._project is None:
            return
        self._save_current()
        created = self._project.ensure_oses()
        if created:
            row = self.ose_list.currentRow()
            self.load_from(self._project)
            self.ose_list.setCurrentRow(max(0, row))

    # ------------------------------------------------------------------
    def _refresh_preview_soft(self, *_):
        if self._current is not None:
            self._current.gauge_height = self.f_gauge.value()
            self._refresh_preview()

    def _refresh_preview(self):
        self.preview.setRowCount(0)
        result = self.result_provider()
        ose = self._current
        if result is None or ose is None or self._project is None:
            self.preview_label.setText(
                "Prévia da planilha (rode a simulação para preencher):")
            return
        self._save_current()
        rows = build_ose_rows(self._project, result, ose)
        self.preview_label.setText(
            f"Prévia da planilha — {len(rows)} estacas, régua "
            f"{fmt.fmt(ose.gauge_height, 2)} m:")
        f = fmt.fmt
        for r in rows:
            i = self.preview.rowCount()
            self.preview.insertRow(i)
            values = [r.stake_label, f(r.dist_prev), f(r.dist_accum),
                      f(r.ground, 3), f"{r.slope:.5f}".replace(".", ","),
                      f(r.invert, 3), f(r.gauge, 2), f(r.board, 3),
                      f(r.ruler, 3), str(r.diameter_mm), f(r.depth, 3),
                      f(r.cover, 3), r.obs]
            for col, value in enumerate(values):
                self.preview.setItem(i, col, QTableWidgetItem(value))
        self.preview.resizeColumnsToContents()
