"""Abas de entrada da rede: Nós (PVs) e Trechos."""

from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (QComboBox, QHBoxLayout, QLabel, QPushButton,
                               QTableWidget, QTableWidgetItem, QVBoxLayout,
                               QWidget)

from ..core import fmt
from ..core.models import NODE_TYPES, Node, Pipe, Project


def _num(item: QTableWidgetItem | None, default: float = 0.0) -> float:
    if item is None:
        return default
    return fmt.parse(item.text(), default)


def _text(item: QTableWidgetItem | None) -> str:
    return item.text().strip() if item else ""


class _TableTab(QWidget):
    """Base: tabela com botões adicionar/remover linha."""

    columns: list[str] = []
    help_text: str = ""

    def __init__(self, parent=None):
        super().__init__(parent)
        layout = QVBoxLayout(self)
        if self.help_text:
            hint = QLabel(self.help_text)
            hint.setWordWrap(True)
            layout.addWidget(hint)
        self.table = QTableWidget(0, len(self.columns))
        self.table.setHorizontalHeaderLabels(self.columns)
        self.table.horizontalHeader().setStretchLastSection(True)
        self.table.setAlternatingRowColors(True)
        layout.addWidget(self.table)
        buttons = QHBoxLayout()
        add = QPushButton("Adicionar linha")
        add.clicked.connect(self.add_row)
        rem = QPushButton("Remover selecionada(s)")
        rem.clicked.connect(self.remove_rows)
        buttons.addWidget(add)
        buttons.addWidget(rem)
        buttons.addStretch(1)
        layout.addLayout(buttons)

    def add_row(self):
        self.table.insertRow(self.table.rowCount())

    def remove_rows(self):
        rows = sorted({i.row() for i in self.table.selectedIndexes()},
                      reverse=True)
        for row in rows:
            self.table.removeRow(row)

    def _set(self, row: int, col: int, value, decimals: int = 3):
        if isinstance(value, float):
            value = fmt.fmt_edit(value, decimals)
        item = QTableWidgetItem(str(value))
        item.setTextAlignment(Qt.AlignCenter)
        self.table.setItem(row, col, item)


class NodesTab(_TableTab):
    """Aba — nós da rede (PVs, TILs, caixas, elevatórias...)."""

    columns = ["Nome", "Tipo", "Coordenada N (m)", "Coordenada E (m)",
               "Cota Terreno (m)", "Q Pontual Ini (l/s)",
               "Q Pontual Fim (l/s)", "Rede"]
    help_text = ("Cadastre os PVs e demais estruturas. As coordenadas são "
                 "opcionais: quando informadas, a extensão dos trechos pode "
                 "ser calculada automaticamente.")

    def add_row(self):
        row = self.table.rowCount()
        self.table.insertRow(row)
        self._set(row, 0, f"PV-{row + 1:02d}")
        combo = QComboBox()
        combo.addItems(NODE_TYPES)
        self.table.setCellWidget(row, 1, combo)

    def load_from(self, project: Project):
        self.table.setRowCount(0)
        for node in project.nodes:
            row = self.table.rowCount()
            self.table.insertRow(row)
            self._set(row, 0, node.name)
            # preserva o id estável através do ciclo load -> apply
            self.table.item(row, 0).setData(Qt.UserRole, node.id)
            combo = QComboBox()
            combo.addItems(NODE_TYPES)
            if node.node_type in NODE_TYPES:
                combo.setCurrentText(node.node_type)
            self.table.setCellWidget(row, 1, combo)
            self._set(row, 2, node.coord_n)
            self._set(row, 3, node.coord_e)
            self._set(row, 4, node.ground_elev)
            self._set(row, 5, node.q_point_start)
            self._set(row, 6, node.q_point_end)
            self._set(row, 7, node.network)

    def apply_to(self, project: Project):
        # Atualiza os objetos EXISTENTES em vez de recriá-los: a planta e
        # o desfazer guardam referências a eles (identidade preservada).
        existing = {n.id: n for n in project.nodes}
        nodes: list[Node] = []
        for row in range(self.table.rowCount()):
            name = _text(self.table.item(row, 0))
            if not name:
                continue
            combo = self.table.cellWidget(row, 1)
            node_type = combo.currentText() if combo else "PV"
            item0 = self.table.item(row, 0)
            stable_id = item0.data(Qt.UserRole) if item0 else None
            node = existing.get(stable_id)
            if node is None:
                node = Node(name=name,
                            **({"id": stable_id} if stable_id else {}))
            node.name = name
            node.node_type = node_type
            node.coord_n = _num(self.table.item(row, 2))
            node.coord_e = _num(self.table.item(row, 3))
            node.ground_elev = _num(self.table.item(row, 4))
            node.q_point_start = _num(self.table.item(row, 5))
            node.q_point_end = _num(self.table.item(row, 6))
            node.network = _text(self.table.item(row, 7))
            nodes.append(node)
        project.nodes = nodes


class PipesTab(_TableTab):
    """Aba — trechos (tubulações) da rede."""

    columns = ["Nome", "Nó Montante", "Nó Jusante", "Extensão (m)",
               "Material", "DN (mm)", "Declividade (m/m)", "Zona",
               "Situação", "Rede"]
    help_text = ("Extensão 0 = calcular pelas coordenadas dos nós. "
                 "DN 0 = dimensionar automaticamente. Declividade 0 = "
                 "calcular (terreno / mínima da norma / tensão trativa). "
                 "Material vazio = material padrão da aba Método de Cálculo. "
                 "Zona vazia = zona global; use a chave cadastrada na aba "
                 "Critérios de Projeto (ex.: Z1).")

    def __init__(self, parent=None):
        self._catalog = []
        super().__init__(parent)

    def _material_combo(self, key: str = "") -> QComboBox:
        combo = QComboBox()
        combo.addItem("(padrão)", "")
        for m in self._catalog:
            combo.addItem(m.name, m.key)
        idx = combo.findData(key)
        combo.setCurrentIndex(max(0, idx))
        return combo

    def add_row(self):
        row = self.table.rowCount()
        self.table.insertRow(row)
        self._set(row, 0, f"T{row + 1}")
        self.table.setCellWidget(row, 4, self._material_combo())
        self._set(row, 3, 0)
        self._set(row, 5, 0)
        self._set(row, 6, 0)
        self._set(row, 8, "Rede Projetada")

    def load_from(self, project: Project):
        self._catalog = project.catalog
        self.table.setRowCount(0)
        for pipe in project.pipes:
            row = self.table.rowCount()
            self.table.insertRow(row)
            self._set(row, 0, pipe.name)
            self.table.item(row, 0).setData(Qt.UserRole, pipe.id)
            self._set(row, 1, pipe.upstream)
            self._set(row, 2, pipe.downstream)
            self._set(row, 3, pipe.length)
            self.table.setCellWidget(row, 4,
                                     self._material_combo(pipe.material))
            self._set(row, 5, pipe.diameter_mm)
            self._set(row, 6, pipe.slope, decimals=5)
            self._set(row, 7, pipe.zone)
            self._set(row, 8, pipe.status)
            self._set(row, 9, pipe.network)

    def apply_to(self, project: Project):
        self._catalog = project.catalog
        existing = {p.id: p for p in project.pipes}
        pipes: list[Pipe] = []
        for row in range(self.table.rowCount()):
            name = _text(self.table.item(row, 0))
            up = _text(self.table.item(row, 1))
            down = _text(self.table.item(row, 2))
            if not (name and up and down):
                continue
            combo = self.table.cellWidget(row, 4)
            material = combo.currentData() if combo else ""
            item0 = self.table.item(row, 0)
            stable_id = item0.data(Qt.UserRole) if item0 else None
            pipe = existing.get(stable_id)
            if pipe is None:
                pipe = Pipe(name=name, upstream=up, downstream=down,
                            **({"id": stable_id} if stable_id else {}))
            pipe.name = name
            pipe.upstream = up
            pipe.downstream = down
            pipe.length = _num(self.table.item(row, 3))
            pipe.material = material or ""
            pipe.diameter_mm = int(_num(self.table.item(row, 5)))
            pipe.slope = _num(self.table.item(row, 6))
            pipe.zone = _text(self.table.item(row, 7))
            pipe.status = _text(self.table.item(row, 8)) or "Rede Projetada"
            pipe.network = _text(self.table.item(row, 9))
            pipes.append(pipe)
        project.pipes = pipes


class MaterialsTab(QWidget):
    """Aba — catálogo de materiais e tubos.

    Mostra n mínimo/máximo de cada material (somente leitura) e permite
    editar o n adotado e a lista de DNs disponíveis.
    """

    def __init__(self, parent=None):
        super().__init__(parent)
        layout = QVBoxLayout(self)
        hint = QLabel(
            "Rugosidades de Manning por material: o valor adotado é "
            "editável dentro da faixa mín–máx. Os DNs são os comerciais "
            "de cada material (edite a lista separando por vírgula). "
            "Desmarque um material para excluí-lo do dimensionamento "
            "automático.")
        hint.setWordWrap(True)
        layout.addWidget(hint)
        self.table = QTableWidget(0, 7)
        self.table.setHorizontalHeaderLabels(
            ["Usar", "Material", "n mín", "n adotado", "n máx",
             "DNs disponíveis (mm)", "Observações"])
        self.table.horizontalHeader().setStretchLastSection(True)
        self.table.setAlternatingRowColors(True)
        layout.addWidget(self.table)
        restore = QPushButton("Restaurar valores padrão do catálogo")
        restore.clicked.connect(self._restore_defaults)
        row = QHBoxLayout()
        row.addWidget(restore)
        row.addStretch(1)
        layout.addLayout(row)
        self._project: Project | None = None

    def _restore_defaults(self):
        from ..core.materials import default_catalog
        if self._project is not None:
            self._project.catalog = default_catalog()
            self.load_from(self._project)

    def load_from(self, project: Project):
        self._project = project
        self.table.setRowCount(0)
        for m in project.catalog:
            row = self.table.rowCount()
            self.table.insertRow(row)
            use = QTableWidgetItem()
            use.setFlags(Qt.ItemIsUserCheckable | Qt.ItemIsEnabled)
            use.setCheckState(Qt.Checked if m.enabled else Qt.Unchecked)
            self.table.setItem(row, 0, use)
            name = QTableWidgetItem(m.name)
            name.setFlags(name.flags() & ~Qt.ItemIsEditable)
            self.table.setItem(row, 1, name)
            nmin = QTableWidgetItem(f"{m.n_min:.3f}")
            nmin.setFlags(nmin.flags() & ~Qt.ItemIsEditable)
            self.table.setItem(row, 2, nmin)
            self.table.setItem(row, 3, QTableWidgetItem(f"{m.n_default:.3f}"))
            nmax = QTableWidgetItem(f"{m.n_max:.3f}")
            nmax.setFlags(nmax.flags() & ~Qt.ItemIsEditable)
            self.table.setItem(row, 4, nmax)
            self.table.setItem(row, 5, QTableWidgetItem(
                ", ".join(str(d) for d in m.diameters_mm)))
            notes = QTableWidgetItem(m.notes)
            notes.setFlags(notes.flags() & ~Qt.ItemIsEditable)
            self.table.setItem(row, 6, notes)
        self.table.resizeColumnsToContents()

    def apply_to(self, project: Project):
        for row in range(min(self.table.rowCount(), len(project.catalog))):
            m = project.catalog[row]
            use = self.table.item(row, 0)
            m.enabled = bool(use and use.checkState() == Qt.Checked)
            n_item = self.table.item(row, 3)
            if n_item:
                try:
                    n = float(n_item.text().replace(",", "."))
                    m.n_default = min(max(n, m.n_min), m.n_max)
                except ValueError:
                    pass
            dn_item = self.table.item(row, 5)
            if dn_item:
                try:
                    dns = [int(float(x)) for x in
                           dn_item.text().replace(";", ",").split(",")
                           if x.strip()]
                    if dns:
                        m.diameters_mm = sorted(set(dns))
                except ValueError:
                    pass
