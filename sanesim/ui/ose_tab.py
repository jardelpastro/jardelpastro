"""Aba OSEs: prévia editável no formato da folha exportada.

A prévia (painel direito) reproduz a "cara" da OSE exportada e os campos
não hidráulicos são editados ali mesmo, clicando no campo: número,
locação, folha de cadastro, cidade, rua, lado, entre/e rua, observações
e responsáveis. Os três painéis (lista | parâmetros | prévia) são
redimensionáveis arrastando os divisores.
"""

from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtGui import QFont
from PySide6.QtWidgets import (QDoubleSpinBox, QFormLayout, QFrame,
                               QGridLayout, QGroupBox, QHBoxLayout, QLabel,
                               QLineEdit, QListWidget, QListWidgetItem,
                               QPlainTextEdit, QPushButton, QScrollArea,
                               QSplitter, QTableWidget, QTableWidgetItem,
                               QVBoxLayout, QWidget)

from ..core import fmt
from ..core.models import OseSheet, Project
from ..core.ose import HEADERS as OSE_HEADERS
from ..core.ose import build_ose_rows, ose_pipe_results


class _SheetField(QLineEdit):
    """Campo editável com aparência de campo de formulário impresso."""

    def __init__(self, placeholder: str = ""):
        super().__init__()
        self.setPlaceholderText(placeholder)
        self.setStyleSheet(
            "QLineEdit { background: #fffef5; border: 1px solid #b0b0b0; "
            "padding: 1px 4px; }")


def _boxed(widget: QWidget) -> QFrame:
    frame = QFrame()
    frame.setFrameShape(QFrame.Box)
    frame.setLineWidth(1)
    lay = QVBoxLayout(frame)
    lay.setContentsMargins(4, 2, 4, 2)
    lay.addWidget(widget)
    return frame


class OsePreview(QWidget):
    """Folha da OSE: cabeçalho e assinaturas editáveis + planilha."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setStyleSheet("OsePreview { background: white; }")
        self.setAutoFillBackground(True)
        outer = QVBoxLayout(self)
        outer.setContentsMargins(14, 10, 14, 10)

        # linha 1: número / locação / folha de cadastro
        top = QGridLayout()
        self.f_number = _SheetField()
        self.f_location = _SheetField()
        self.f_cadastre = _SheetField()
        for col, (label, widget) in enumerate(
                [("Número da O.S.E.", self.f_number),
                 ("Locação", self.f_location),
                 ("Número da Folha de Cadastro", self.f_cadastre)]):
            cell = QWidget()
            v = QVBoxLayout(cell)
            v.setContentsMargins(2, 0, 2, 0)
            lab = QLabel(label)
            lab.setAlignment(Qt.AlignCenter)
            font = lab.font()
            font.setBold(True)
            font.setPointSize(8)
            lab.setFont(font)
            v.addWidget(lab)
            v.addWidget(widget)
            top.addWidget(_boxed(cell), 0, col)
        outer.addLayout(top)

        # título
        self.title_label = QLabel("ORDEM DE SERVIÇO PARA EXECUÇÃO")
        self.title_label.setAlignment(Qt.AlignCenter)
        font = QFont()
        font.setBold(True)
        font.setPointSize(13)
        self.title_label.setFont(font)
        outer.addWidget(self.title_label)
        self.system_label = QLabel("")
        self.system_label.setAlignment(Qt.AlignCenter)
        font = QFont()
        font.setBold(True)
        font.setPointSize(10)
        self.system_label.setFont(font)
        outer.addWidget(self.system_label)

        # identificação da rua
        ident = QGridLayout()
        self.f_city = _SheetField("(cidade do projeto)")
        self.f_street = _SheetField()
        self.f_side = _SheetField()
        self.ro_length = QLabel("-")
        self.ro_diameter = QLabel("-")
        self.f_between = _SheetField()
        self.f_and = _SheetField()
        self.ro_material = QLabel("-")

        def add(row, col, label, widget, span=1):
            h = QHBoxLayout()
            lab = QLabel(label)
            font = lab.font()
            font.setBold(True)
            font.setPointSize(8)
            lab.setFont(font)
            h.addWidget(lab)
            h.addWidget(widget, stretch=1)
            w = QWidget()
            w.setLayout(h)
            ident.addWidget(w, row, col, 1, span)

        add(0, 0, "Cidade:", self.f_city)
        add(0, 1, "Rua:", self.f_street, span=2)
        add(0, 3, "Lado:", self.f_side)
        add(1, 0, "Extensão:", self.ro_length)
        add(1, 1, "Diâmetro:", self.ro_diameter)
        add(1, 2, "Material:", self.ro_material, span=2)
        add(2, 0, "Entre Rua:", self.f_between, span=2)
        add(2, 2, "e Rua:", self.f_and, span=2)
        outer.addLayout(ident)

        # planilha de estaqueamento (hidráulica — somente leitura)
        self.table = QTableWidget(0, len(OSE_HEADERS))
        self.table.setHorizontalHeaderLabels(OSE_HEADERS)
        self.table.setEditTriggers(QTableWidget.NoEditTriggers)
        self.table.setAlternatingRowColors(True)
        self.table.verticalHeader().setVisible(False)
        self.table.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        outer.addWidget(self.table)

        # observações
        obs_row = QHBoxLayout()
        obs_lab = QLabel("(*) OBSERVAÇÃO:")
        font = obs_lab.font()
        font.setBold(True)
        font.setPointSize(8)
        obs_lab.setFont(font)
        obs_row.addWidget(obs_lab, alignment=Qt.AlignTop)
        self.f_obs = QPlainTextEdit()
        self.f_obs.setMaximumHeight(48)
        self.f_obs.setStyleSheet(
            "QPlainTextEdit { background: #fffef5; "
            "border: 1px solid #b0b0b0; }")
        obs_row.addWidget(self.f_obs)
        outer.addLayout(obs_row)

        # assinaturas
        signs = QGridLayout()
        self.f_prop = _SheetField()
        self.f_appr = _SheetField()
        self.f_rel = _SheetField()
        self.f_exec = _SheetField()
        blocks = [("Proposição", self.f_prop),
                  ("Aprovação", self.f_appr),
                  ("Liberação para Execução", self.f_rel),
                  ("Execução/Cadastramento", self.f_exec)]
        for col, (label, widget) in enumerate(blocks):
            cell = QWidget()
            v = QVBoxLayout(cell)
            v.setContentsMargins(2, 0, 2, 0)
            lab = QLabel(label)
            lab.setAlignment(Qt.AlignCenter)
            font = lab.font()
            font.setBold(True)
            font.setPointSize(8)
            lab.setFont(font)
            v.addWidget(lab)
            v.addWidget(widget)
            signs.addWidget(_boxed(cell), 0, col)
        outer.addLayout(signs)
        outer.addStretch(1)

    # ------------------------------------------------------------------
    def edit_fields(self) -> dict[str, QWidget]:
        """Campos editáveis, mapeados para os atributos de OseSheet."""
        return {
            "number": self.f_number, "location": self.f_location,
            "cadastre_sheet": self.f_cadastre, "city": self.f_city,
            "street": self.f_street, "side": self.f_side,
            "between_street": self.f_between, "and_street": self.f_and,
            "resp_proposal": self.f_prop, "resp_approval": self.f_appr,
            "resp_release": self.f_rel, "resp_execution": self.f_exec,
        }

    def load(self, project: Project, ose: OseSheet | None):
        enabled = ose is not None
        for widget in self.edit_fields().values():
            widget.setEnabled(enabled)
            widget.blockSignals(True)
        self.f_obs.setEnabled(enabled)
        system = project.info.system or project.title
        self.system_label.setText(system.upper())
        if ose is None:
            for widget in self.edit_fields().values():
                widget.clear()
                widget.blockSignals(False)
            self.f_obs.setPlainText("")
            self.table.setRowCount(0)
            self.ro_length.setText("-")
            self.ro_diameter.setText("-")
            self.ro_material.setText("-")
            return
        for attr, widget in self.edit_fields().items():
            widget.setText(getattr(ose, attr))
            widget.blockSignals(False)
        self.f_city.setPlaceholderText(project.info.city or "(cidade)")
        self.f_obs.setPlainText(ose.observations)

    def save_into(self, ose: OseSheet):
        for attr, widget in self.edit_fields().items():
            setattr(ose, attr, widget.text().strip())
        ose.observations = self.f_obs.toPlainText().strip()

    def fill_table(self, project: Project, result, ose: OseSheet):
        self.table.setRowCount(0)
        if result is None:
            self._fit_table()
            return
        pipes = ose_pipe_results(project, result, ose)
        length = sum(r.length for r in pipes)
        self.ro_length.setText(f"{fmt.fmt(length, 2)} m")
        self.ro_diameter.setText(" / ".join(sorted(
            {str(r.diameter_mm) for r in pipes}, key=int)) or "-")
        self.ro_material.setText(" / ".join(dict.fromkeys(
            r.material.split("(")[0].strip() for r in pipes)) or "-")
        f = fmt.fmt
        for r in build_ose_rows(project, result, ose):
            i = self.table.rowCount()
            self.table.insertRow(i)
            values = [r.stake_label, f(r.dist_prev), f(r.dist_accum),
                      f(r.ground, 3), f"{r.slope:.5f}".replace(".", ","),
                      f(r.invert, 3), f(r.gauge, 2), f(r.board, 3),
                      f(r.ruler, 3), str(r.diameter_mm), f(r.depth, 3),
                      f(r.cover, 3), r.obs]
            for col, value in enumerate(values):
                item = QTableWidgetItem(value)
                item.setTextAlignment(Qt.AlignCenter)
                self.table.setItem(i, col, item)
        self.table.resizeColumnsToContents()
        self._fit_table()

    def _fit_table(self):
        rows = self.table.rowCount()
        header = self.table.horizontalHeader().height()
        row_h = self.table.verticalHeader().defaultSectionSize()
        self.table.setFixedHeight(header + rows * row_h + 6)


class OseTab(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self._project: Project | None = None
        self._current: OseSheet | None = None
        self.result_provider = lambda: None   # definido pela MainWindow

        layout = QVBoxLayout(self)
        splitter = QSplitter(Qt.Horizontal)
        splitter.setHandleWidth(8)
        splitter.setChildrenCollapsible(False)
        splitter.setStyleSheet(
            "QSplitter::handle { background: #c8c8c8; }"
            "QSplitter::handle:hover { background: #8ab4dd; }")
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
        buttons.addWidget(new_btn)
        buttons.addWidget(del_btn)
        lv.addLayout(buttons)
        gen_btn = QPushButton("Gerar p/ trechos sem OSE")
        gen_btn.setToolTip("Cria uma OSE por rede para os trechos que "
                           "ainda não pertencem a nenhuma OSE.")
        gen_btn.clicked.connect(self._generate)
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

        # -------------------------------------------- parâmetros (meio)
        mid = QWidget()
        mv = QVBoxLayout(mid)
        params = QGroupBox("Parâmetros da OSE")
        form = QFormLayout(params)
        self.f_gauge = QDoubleSpinBox()
        self.f_gauge.setRange(0.5, 20.0)
        self.f_gauge.setDecimals(2)
        self.f_gauge.setSingleStep(0.5)
        self.f_gauge.setValue(3.0)
        self.f_gauge.setSuffix(" m")
        self.f_gauge.setToolTip(
            "Gabarito da régua/cruzeta. Redes profundas (ex.: 5 m) podem "
            "exigir régua maior nesta OSE específica.")
        self.f_gauge.valueChanged.connect(self._gauge_changed)
        form.addRow("Gabarito da régua:", self.f_gauge)
        mv.addWidget(params)
        mv.addWidget(QLabel("Trechos desta OSE\n(clique para "
                            "incluir/retirar):"))
        self.pipe_list = QListWidget()
        # o clique em QUALQUER ponto da linha alterna a marcação (sem o
        # flag UserCheckable, o Qt não alterna sozinho — evita o toggle
        # duplo ao clicar exatamente na caixinha)
        self.pipe_list.itemClicked.connect(self._toggle_pipe_item)
        mv.addWidget(self.pipe_list)
        splitter.addWidget(mid)

        # ---------------------------------------- prévia editável (direita)
        right = QVBoxLayout()
        right_w = QWidget()
        right_w.setLayout(right)
        hint = QLabel("Prévia da OSE — clique nos campos amarelados para "
                      "editar (rua, número, observações, responsáveis...). "
                      "A planilha reflete a última simulação.")
        hint.setWordWrap(True)
        right.addWidget(hint)
        self.preview = OsePreview()
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setWidget(self.preview)
        right.addWidget(scroll)
        splitter.addWidget(right_w)
        splitter.setSizes([230, 240, 800])
        self.splitter = splitter

        for widget in self.preview.edit_fields().values():
            widget.editingFinished.connect(self._preview_edited)
        self.preview.f_obs.textChanged.connect(self._obs_edited)

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
            self._on_select(0)
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
        if ose.status == "cancelada":
            name = f"✕ {name}  (CANCELADA)"
        return name

    def _next_number(self) -> str:
        """Número sequencial em relação à última OSE da lista."""
        if not self._project or not self._project.oses:
            return "1"
        last = self._project.oses[-1].number
        try:
            return str(int(last) + 1)
        except (TypeError, ValueError):
            return str(len(self._project.oses) + 1)

    def _on_select(self, row: int):
        self._save_current()
        if self._project and 0 <= row < len(self._project.oses):
            self._load_form(self._project.oses[row])
        else:
            self._load_form(None)

    def _load_form(self, ose: OseSheet | None):
        self._current = None    # evita gravações durante o carregamento
        self.f_gauge.blockSignals(True)
        self.f_gauge.setValue(ose.gauge_height if ose else 3.0)
        self.f_gauge.blockSignals(False)
        self.f_gauge.setEnabled(ose is not None)
        self.pipe_list.blockSignals(True)
        self.pipe_list.clear()
        if ose is not None and self._project:
            selected = set(ose.pipe_ids)
            for pipe in self._project.pipes:
                item = QListWidgetItem(
                    f"{pipe.name}  ({pipe.upstream} → {pipe.downstream})")
                item.setData(Qt.UserRole, pipe.id)
                item.setFlags(Qt.ItemIsEnabled | Qt.ItemIsSelectable)
                item.setCheckState(Qt.Checked if pipe.id in selected
                                   else Qt.Unchecked)
                self.pipe_list.addItem(item)
        self.pipe_list.blockSignals(False)
        self.pipe_list.setEnabled(ose is not None)
        if self._project:
            self.preview.load(self._project, ose)
        self._current = ose
        self._refresh_preview()

    def _save_current(self):
        ose = self._current
        if ose is None or self._project is None:
            return
        self.preview.save_into(ose)
        ose.gauge_height = self.f_gauge.value()
        pipe_ids = []
        for i in range(self.pipe_list.count()):
            item = self.pipe_list.item(i)
            if item.checkState() == Qt.Checked:
                pipe_ids.append(item.data(Qt.UserRole))
        ose.pipe_ids = pipe_ids
        row = self.ose_list.currentRow()
        if 0 <= row < len(self._project.oses) \
                and self._project.oses[row] is ose:
            label = self._ose_label(ose)
            item = self.ose_list.item(row)
            if item.text() != label:   # evita "piscar" o nome a cada clique
                item.setText(label)

    # ------------------------------------------------------------------
    def _new_ose(self):
        if self._project is None:
            return
        self._save_current()
        self._project.oses.append(OseSheet(
            number=self._next_number(),
            city=self._project.info.city))
        self.ose_list.addItem(self._ose_label(self._project.oses[-1]))
        self.ose_list.setCurrentRow(self.ose_list.count() - 1)

    def _remove_ose(self):
        from PySide6.QtWidgets import QMessageBox
        row = self.ose_list.currentRow()
        if self._project is None or row < 0:
            return
        ose = self._project.oses[row]
        box = QMessageBox(self)
        box.setWindowTitle("Remover OSE")
        box.setText(
            f"O que deseja fazer com a {self._ose_label(ose)}?\n\n"
            "Cancelar mantém a OSE no projeto (registro histórico, "
            "marcada como CANCELADA); excluir remove definitivamente.")
        cancel_ose = box.addButton("Marcar como CANCELADA",
                                   QMessageBox.AcceptRole)
        delete = box.addButton("Excluir definitivamente",
                               QMessageBox.DestructiveRole)
        back = box.addButton("Voltar", QMessageBox.RejectRole)
        box.setDefaultButton(cancel_ose)
        box.exec()
        if box.clickedButton() is back:
            return
        if box.clickedButton() is cancel_ose:
            self._save_current()
            ose.status = "cancelada"
            self.ose_list.item(row).setText(self._ose_label(ose))
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
    def _preview_edited(self):
        if self._current is None:
            return
        self.preview.save_into(self._current)
        row = self.ose_list.currentRow()
        if self._project and 0 <= row < len(self._project.oses) \
                and self._project.oses[row] is self._current:
            label = self._ose_label(self._current)
            item = self.ose_list.item(row)
            if item.text() != label:
                item.setText(label)

    def _obs_edited(self):
        if self._current is not None:
            self._current.observations = \
                self.preview.f_obs.toPlainText().strip()

    def _gauge_changed(self, value: float):
        if self._current is not None:
            self._current.gauge_height = value
            self._refresh_preview()

    def _toggle_pipe_item(self, item):
        if self._current is None or item is None:
            return
        item.setCheckState(Qt.Unchecked
                           if item.checkState() == Qt.Checked
                           else Qt.Checked)
        self._save_current()
        self._refresh_preview()

    def _refresh_preview(self):
        if self._project is None or self._current is None:
            self.preview.table.setRowCount(0)
            return
        self.preview.fill_table(self._project, self.result_provider(),
                                self._current)
