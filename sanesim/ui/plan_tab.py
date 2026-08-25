"""Aba Planta: editor gráfico da rede (beta).

Interações com o mouse:
- Modo Selecionar: clique esquerdo seleciona (o painel lateral mostra as
  propriedades e os resultados da simulação); arrastar um PV move-o e
  atualiza as coordenadas; Delete exclui a seleção.
- Modo Inserir PV: cada clique cria um nó (tipo escolhido no combo).
- Modo Inserir Trecho: clique no nó de montante e depois no de jusante.
- Botão direito em qualquer elemento: menu com Propriedades / Excluir.
- Roda do mouse: zoom; botão do meio ou modo Pan: mover a vista.

A planta edita os MESMOS objetos do projeto usados pelas tabelas, OSEs e
perfil (ids estáveis): qualquer alteração aqui reflete lá e vice-versa.
"""

from __future__ import annotations

import math

from PySide6.QtCore import Qt, QPointF, QRectF
from PySide6.QtGui import (QBrush, QColor, QFont, QPainter, QPen,
                           QPolygonF)
from PySide6.QtWidgets import (QButtonGroup, QComboBox, QDoubleSpinBox,
                               QFormLayout, QGraphicsEllipseItem,
                               QGraphicsItem, QGraphicsLineItem,
                               QGraphicsScene, QGraphicsSimpleTextItem,
                               QGraphicsView, QGroupBox, QHBoxLayout,
                               QLabel, QLineEdit, QMenu, QPushButton,
                               QSpinBox, QSplitter, QToolButton,
                               QVBoxLayout, QWidget)

from ..core import fmt
from ..core.models import NODE_TYPES, Node, Pipe, Project
from ..core.simulation import SimulationResult

NODE_RADIUS = 4.0        # raio do símbolo do PV (m de desenho)
_NODE_COLORS = {
    "PV": QColor("#ffffff"), "TIL": QColor("#d9ead3"),
    "TL": QColor("#d9ead3"), "CP": QColor("#fff2cc"),
    "TQ": QColor("#f9cb9c"), "EEE": QColor("#ea9999"),
    "Lançamento": QColor("#cfe2f3"),
}
_PIPE_OK = QColor("#1f6fb2")
_PIPE_VIOL = QColor("#cc0000")
_SELECT = QColor("#ff8c00")


class NodeItem(QGraphicsEllipseItem):
    def __init__(self, node: Node, tab: "PlanTab"):
        r = NODE_RADIUS
        super().__init__(-r, -r, 2 * r, 2 * r)
        self.node = node
        self.tab = tab
        self.setPos(node.coord_e, -node.coord_n)
        self.setFlag(QGraphicsItem.ItemIsMovable)
        self.setFlag(QGraphicsItem.ItemIsSelectable)
        self.setFlag(QGraphicsItem.ItemSendsScenePositionChanges)
        self.setZValue(2)
        self.setBrush(QBrush(_NODE_COLORS.get(node.node_type,
                                              QColor("#ffffff"))))
        self.setPen(QPen(QColor("#222222"), 0.8))
        self.label = QGraphicsSimpleTextItem(node.name, self)
        font = QFont()
        font.setPointSizeF(4.5)
        font.setBold(True)
        self.label.setFont(font)
        self.label.setPos(r * 0.9, -r * 2.4)

    def refresh(self):
        self.label.setText(self.node.name)
        self.setBrush(QBrush(_NODE_COLORS.get(self.node.node_type,
                                              QColor("#ffffff"))))
        self.setPos(self.node.coord_e, -self.node.coord_n)

    def itemChange(self, change, value):
        if change == QGraphicsItem.ItemScenePositionHasChanged:
            self.node.coord_e = self.pos().x()
            self.node.coord_n = -self.pos().y()
            self.tab.update_pipes_of(self.node.name)
        return super().itemChange(change, value)

    def mouseReleaseEvent(self, event):
        super().mouseReleaseEvent(event)
        self.tab.notify_network_changed(reload_scene=False)

    def contextMenuEvent(self, event):
        self.tab.show_node_menu(self, event.screenPos())


class PipeItem(QGraphicsLineItem):
    def __init__(self, pipe: Pipe, tab: "PlanTab"):
        super().__init__()
        self.pipe = pipe
        self.tab = tab
        self.setFlag(QGraphicsItem.ItemIsSelectable)
        self.setZValue(1)
        self.arrow = QGraphicsSimpleTextItem("", self)
        self.label = QGraphicsSimpleTextItem(pipe.name, self)
        font = QFont()
        font.setPointSizeF(4.0)
        self.label.setFont(font)
        self.arrow_poly: QPolygonF | None = None
        self.violated = False
        self.update_geometry()

    def update_geometry(self):
        up = self.tab.project.node_by_name(self.pipe.upstream)
        down = self.tab.project.node_by_name(self.pipe.downstream)
        if not (up and down):
            return
        x1, y1 = up.coord_e, -up.coord_n
        x2, y2 = down.coord_e, -down.coord_n
        self.setLine(x1, y1, x2, y2)
        color = _PIPE_VIOL if self.violated else _PIPE_OK
        pen = QPen(color, 1.6)
        pen.setCosmetic(False)
        self.setPen(pen)
        # rótulo no meio, deslocado da linha
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        self.label.setPos(mx + 2.5, my + 2.5)
        # seta de fluxo a 60% do vão
        ax = x1 + (x2 - x1) * 0.6
        ay = y1 + (y2 - y1) * 0.6
        ang = math.atan2(y2 - y1, x2 - x1)
        size = 4.0
        self.arrow_poly = QPolygonF([
            QPointF(ax, ay),
            QPointF(ax - size * math.cos(ang - 0.45),
                    ay - size * math.sin(ang - 0.45)),
            QPointF(ax - size * math.cos(ang + 0.45),
                    ay - size * math.sin(ang + 0.45)),
        ])
        self.update()

    def refresh(self):
        self.label.setText(self.pipe.name)
        self.update_geometry()

    def paint(self, painter, option, widget=None):
        super().paint(painter, option, widget)
        if self.arrow_poly is not None:
            color = _SELECT if self.isSelected() else \
                (_PIPE_VIOL if self.violated else _PIPE_OK)
            painter.setBrush(QBrush(color))
            painter.setPen(Qt.NoPen)
            painter.drawPolygon(self.arrow_poly)

    def contextMenuEvent(self, event):
        self.tab.show_pipe_menu(self, event.screenPos())


class PlanScene(QGraphicsScene):
    def __init__(self, tab: "PlanTab"):
        super().__init__()
        self.tab = tab

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            mode = self.tab.mode
            if mode == "add_node":
                self.tab.add_node_at(event.scenePos())
                event.accept()
                return
            if mode == "add_pipe":
                item = self.itemAt(event.scenePos(), self.views()[0].transform())
                while item is not None and not isinstance(item, NodeItem):
                    item = item.parentItem()
                self.tab.pick_pipe_node(item)
                event.accept()
                return
        super().mousePressEvent(event)


class PlanView(QGraphicsView):
    def __init__(self, scene):
        super().__init__(scene)
        self.setRenderHint(QPainter.Antialiasing)
        self.setDragMode(QGraphicsView.RubberBandDrag)
        self.setTransformationAnchor(QGraphicsView.AnchorUnderMouse)

    def wheelEvent(self, event):
        factor = 1.15 if event.angleDelta().y() > 0 else 1 / 1.15
        self.scale(factor, factor)

    def drawBackground(self, painter, rect: QRectF):
        super().drawBackground(painter, rect)
        painter.fillRect(rect, QColor("#fbfbf8"))
        pen = QPen(QColor(0, 0, 0, 18), 0)
        pen.setCosmetic(True)
        painter.setPen(pen)
        step = 100.0
        x = math.floor(rect.left() / step) * step
        while x < rect.right():
            painter.drawLine(QPointF(x, rect.top()),
                             QPointF(x, rect.bottom()))
            x += step
        y = math.floor(rect.top() / step) * step
        while y < rect.bottom():
            painter.drawLine(QPointF(rect.left(), y),
                             QPointF(rect.right(), y))
            y += step


class PlanTab(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.project: Project = Project()
        self.result_provider = lambda: None
        self.network_changed = lambda: None   # definido pela MainWindow
        self.mode = "select"
        self._pipe_first: NodeItem | None = None
        self._node_items: dict[str, NodeItem] = {}   # por id
        self._pipe_items: dict[str, PipeItem] = {}   # por id

        layout = QVBoxLayout(self)
        toolbar = QHBoxLayout()
        self.mode_group = QButtonGroup(self)

        def mode_button(text, mode, tip):
            btn = QToolButton()
            btn.setText(text)
            btn.setCheckable(True)
            btn.setToolTip(tip)
            btn.clicked.connect(lambda: self.set_mode(mode))
            self.mode_group.addButton(btn)
            toolbar.addWidget(btn)
            return btn

        self.btn_select = mode_button(
            "Selecionar", "select",
            "Clique para selecionar; arraste PVs para movê-los.")
        self.btn_pan = mode_button("Pan", "pan", "Arraste para mover a vista.")
        self.btn_add_node = mode_button(
            "Inserir PV", "add_node",
            "Clique na planta para criar um nó do tipo escolhido ao lado.")
        self.node_type_combo = QComboBox()
        self.node_type_combo.addItems(NODE_TYPES)
        toolbar.addWidget(self.node_type_combo)
        self.btn_add_pipe = mode_button(
            "Inserir Trecho", "add_pipe",
            "Clique no nó de montante e depois no de jusante.")
        self.btn_select.setChecked(True)
        fit = QPushButton("Ajustar zoom")
        fit.clicked.connect(self.fit_view)
        toolbar.addWidget(fit)
        toolbar.addStretch(1)
        self.status = QLabel("")
        toolbar.addWidget(self.status)
        layout.addLayout(toolbar)

        splitter = QSplitter(Qt.Horizontal)
        splitter.setHandleWidth(8)
        splitter.setStyleSheet(
            "QSplitter::handle { background: #c8c8c8; }"
            "QSplitter::handle:hover { background: #8ab4dd; }")
        self.scene = PlanScene(self)
        self.view = PlanView(self.scene)
        splitter.addWidget(self.view)
        splitter.addWidget(self._build_side_panel())
        splitter.setSizes([1000, 320])
        layout.addWidget(splitter, stretch=1)

        self.scene.selectionChanged.connect(self._selection_changed)

    # ------------------------------------------------------- painel lateral
    def _build_side_panel(self) -> QWidget:
        panel = QWidget()
        v = QVBoxLayout(panel)
        self.sel_title = QLabel("Nada selecionado")
        font = self.sel_title.font()
        font.setBold(True)
        self.sel_title.setFont(font)
        v.addWidget(self.sel_title)

        # --- formulário de nó
        self.node_box = QGroupBox("Propriedades do nó")
        form = QFormLayout(self.node_box)
        self.n_name = QLineEdit()
        self.n_type = QComboBox()
        self.n_type.addItems(NODE_TYPES)
        self.n_coord_n = QLineEdit()
        self.n_coord_e = QLineEdit()
        self.n_ground = QLineEdit()
        self.n_qini = QLineEdit()
        self.n_qfim = QLineEdit()
        self.n_network = QLineEdit()
        form.addRow("Nome:", self.n_name)
        form.addRow("Tipo:", self.n_type)
        form.addRow("Coordenada N (m):", self.n_coord_n)
        form.addRow("Coordenada E (m):", self.n_coord_e)
        form.addRow("Cota terreno (m):", self.n_ground)
        form.addRow("Q pontual ini (l/s):", self.n_qini)
        form.addRow("Q pontual fim (l/s):", self.n_qfim)
        form.addRow("Rede:", self.n_network)
        v.addWidget(self.node_box)

        # --- formulário de trecho
        self.pipe_box = QGroupBox("Propriedades do trecho")
        form = QFormLayout(self.pipe_box)
        self.p_name = QLineEdit()
        self.p_updown = QLabel("-")
        self.p_length = QLabel("-")
        self.p_material = QComboBox()
        self.p_dn = QSpinBox()
        self.p_dn.setRange(0, 3000)
        self.p_dn.setSpecialValueText("automático")
        self.p_slope = QDoubleSpinBox()
        self.p_slope.setRange(0.0, 2.0)
        self.p_slope.setDecimals(5)
        self.p_slope.setSingleStep(0.001)
        self.p_slope.setSpecialValueText("automática")
        self.p_zone = QLineEdit()
        self.p_network = QLineEdit()
        form.addRow("Nome:", self.p_name)
        form.addRow("Mont. → Jus.:", self.p_updown)
        form.addRow("Extensão:", self.p_length)
        form.addRow("Material:", self.p_material)
        form.addRow("DN (mm):", self.p_dn)
        form.addRow("Declividade (m/m):", self.p_slope)
        form.addRow("Zona:", self.p_zone)
        form.addRow("Rede:", self.p_network)
        v.addWidget(self.pipe_box)

        apply_btn = QPushButton("Aplicar alterações")
        apply_btn.clicked.connect(self.apply_panel)
        v.addWidget(apply_btn)

        self.results_box = QGroupBox("Resultados da simulação")
        self.results_form = QFormLayout(self.results_box)
        v.addWidget(self.results_box)
        v.addStretch(1)
        self.node_box.hide()
        self.pipe_box.hide()
        self.results_box.hide()
        return panel

    # ------------------------------------------------------------- estado
    def set_mode(self, mode: str):
        self.mode = mode
        self._pipe_first = None
        if mode == "pan":
            self.view.setDragMode(QGraphicsView.ScrollHandDrag)
        else:
            self.view.setDragMode(QGraphicsView.RubberBandDrag)
        movable = mode == "select"
        for item in self._node_items.values():
            item.setFlag(QGraphicsItem.ItemIsMovable, movable)
        hints = {
            "select": "Clique para selecionar; arraste PVs para mover.",
            "pan": "Arraste para mover a vista.",
            "add_node": "Clique na planta para inserir o nó.",
            "add_pipe": "Clique no nó de MONTANTE.",
        }
        self.status.setText(hints.get(mode, ""))

    def load_from(self, project: Project):
        self.project = project
        self.scene.blockSignals(True)
        self.scene.clear()
        self._node_items = {}
        self._pipe_items = {}
        for node in project.nodes:
            item = NodeItem(node, self)
            self.scene.addItem(item)
            self._node_items[node.id] = item
        for pipe in project.pipes:
            item = PipeItem(pipe, self)
            self.scene.addItem(item)
            self._pipe_items[pipe.id] = item
        self.scene.blockSignals(False)
        self.set_mode(self.mode)
        self.fit_view()

    def show_result(self, project: Project, result: SimulationResult):
        by_name = {r.pipe: r for r in result.pipes}
        for item in self._pipe_items.values():
            r = by_name.get(item.pipe.name)
            item.violated = bool(r and r.violations)
            dn = f" DN{r.diameter_mm}" if r else ""
            item.label.setText(f"{item.pipe.name}{dn}")
            item.update_geometry()
        self._selection_changed()

    def fit_view(self):
        rect = self.scene.itemsBoundingRect().adjusted(-50, -50, 50, 50)
        if rect.isValid():
            self.scene.setSceneRect(rect)
            self.view.fitInView(rect, Qt.KeepAspectRatio)

    # -------------------------------------------------------- edição gráfica
    def _next_name(self, prefix: str, existing: set[str]) -> str:
        i = 1
        while f"{prefix}{i:02d}" in existing:
            i += 1
        return f"{prefix}{i:02d}"

    def add_node_at(self, pos: QPointF):
        names = {n.name for n in self.project.nodes}
        node_type = self.node_type_combo.currentText()
        prefix = "PV-" if node_type == "PV" else f"{node_type}-"
        node = Node(
            name=self._next_name(prefix, names),
            node_type=node_type,
            coord_e=round(pos.x(), 2),
            coord_n=round(-pos.y(), 2),
        )
        self.project.nodes.append(node)
        item = NodeItem(node, self)
        item.setFlag(QGraphicsItem.ItemIsMovable, False)
        self.scene.addItem(item)
        self._node_items[node.id] = item
        self.status.setText(f"Nó {node.name} criado — informe a cota do "
                            "terreno nas propriedades.")
        self.notify_network_changed(reload_scene=False)

    def pick_pipe_node(self, item: NodeItem | None):
        if item is None:
            self._pipe_first = None
            self.status.setText("Clique no nó de MONTANTE.")
            return
        if self._pipe_first is None:
            self._pipe_first = item
            self.status.setText(
                f"Montante: {item.node.name}. Clique no nó de JUSANTE.")
            return
        if item is self._pipe_first:
            return
        names = {p.name for p in self.project.pipes}
        i = 1
        while f"T{i}" in names:
            i += 1
        pipe = Pipe(name=f"T{i}", upstream=self._pipe_first.node.name,
                    downstream=item.node.name,
                    network=self._pipe_first.node.network)
        self.project.pipes.append(pipe)
        pitem = PipeItem(pipe, self)
        self.scene.addItem(pitem)
        self._pipe_items[pipe.id] = pitem
        self.status.setText(f"Trecho {pipe.name} criado "
                            f"({pipe.upstream} → {pipe.downstream}). "
                            "Clique no próximo nó de MONTANTE.")
        self._pipe_first = None
        self.notify_network_changed(reload_scene=False)

    def update_pipes_of(self, node_name: str):
        for item in self._pipe_items.values():
            if node_name in (item.pipe.upstream, item.pipe.downstream):
                item.update_geometry()

    def notify_network_changed(self, reload_scene: bool = True):
        self.network_changed()
        if reload_scene:
            self.load_from(self.project)

    # ------------------------------------------------------- menus de contexto
    def show_node_menu(self, item: NodeItem, screen_pos):
        menu = QMenu()
        act_prop = menu.addAction("Propriedades…")
        act_del = menu.addAction("Excluir nó (e trechos ligados)")
        chosen = menu.exec(screen_pos)
        if chosen == act_prop:
            item.setSelected(True)
            self.n_name.setFocus()
        elif chosen == act_del:
            self.delete_node(item.node)

    def show_pipe_menu(self, item: PipeItem, screen_pos):
        menu = QMenu()
        act_prop = menu.addAction("Propriedades…")
        act_invert = menu.addAction("Inverter sentido (mont ↔ jus)")
        act_del = menu.addAction("Excluir trecho")
        chosen = menu.exec(screen_pos)
        if chosen == act_prop:
            item.setSelected(True)
            self.p_name.setFocus()
        elif chosen == act_invert:
            item.pipe.upstream, item.pipe.downstream = \
                item.pipe.downstream, item.pipe.upstream
            item.update_geometry()
            self.notify_network_changed(reload_scene=False)
        elif chosen == act_del:
            self.delete_pipe(item.pipe)

    def delete_node(self, node: Node):
        self.project.pipes = [p for p in self.project.pipes
                              if node.name not in (p.upstream, p.downstream)]
        self.project.nodes = [n for n in self.project.nodes
                              if n.id != node.id]
        self.notify_network_changed(reload_scene=True)

    def delete_pipe(self, pipe: Pipe):
        self.project.pipes = [p for p in self.project.pipes
                              if p.id != pipe.id]
        self.notify_network_changed(reload_scene=True)

    def keyPressEvent(self, event):
        if event.key() == Qt.Key_Delete:
            for item in list(self.scene.selectedItems()):
                if isinstance(item, NodeItem):
                    self.delete_node(item.node)
                elif isinstance(item, PipeItem):
                    self.delete_pipe(item.pipe)
            return
        super().keyPressEvent(event)

    # -------------------------------------------------------- painel lateral
    def _clear_results(self):
        while self.results_form.rowCount():
            self.results_form.removeRow(0)

    def _selection_changed(self):
        try:
            items = self.scene.selectedItems()
        except RuntimeError:
            return   # cena já destruída (fechamento da janela)
        node_item = next((i for i in items if isinstance(i, NodeItem)), None)
        pipe_item = next((i for i in items if isinstance(i, PipeItem)), None)
        self._clear_results()
        if node_item is not None:
            node = node_item.node
            self.sel_title.setText(f"Nó: {node.name}")
            self.node_box.show()
            self.pipe_box.hide()
            self.n_name.setText(node.name)
            self.n_type.setCurrentText(node.node_type)
            self.n_coord_n.setText(fmt.fmt_edit(node.coord_n, 2))
            self.n_coord_e.setText(fmt.fmt_edit(node.coord_e, 2))
            self.n_ground.setText(fmt.fmt_edit(node.ground_elev))
            self.n_qini.setText(fmt.fmt_edit(node.q_point_start, 2))
            self.n_qfim.setText(fmt.fmt_edit(node.q_point_end, 2))
            self.n_network.setText(node.network)
            self._show_node_results(node)
        elif pipe_item is not None:
            pipe = pipe_item.pipe
            self.sel_title.setText(f"Trecho: {pipe.name}")
            self.pipe_box.show()
            self.node_box.hide()
            self.p_name.setText(pipe.name)
            self.p_updown.setText(f"{pipe.upstream} → {pipe.downstream}")
            self.p_length.setText(
                f"{fmt.fmt(self.project.pipe_length(pipe), 2)} m"
                + ("" if pipe.length > 0 else " (por coordenadas)"))
            self.p_material.clear()
            self.p_material.addItem("(padrão)", "")
            for m in self.project.catalog:
                self.p_material.addItem(m.name, m.key)
            idx = self.p_material.findData(pipe.material)
            self.p_material.setCurrentIndex(max(0, idx))
            self.p_dn.setValue(pipe.diameter_mm)
            self.p_slope.setValue(pipe.slope)
            self.p_zone.setText(pipe.zone)
            self.p_network.setText(pipe.network)
            self._show_pipe_results(pipe)
        else:
            self.sel_title.setText("Nada selecionado")
            self.node_box.hide()
            self.pipe_box.hide()
            self.results_box.hide()

    def _show_pipe_results(self, pipe: Pipe):
        result = self.result_provider()
        if result is None:
            self.results_box.hide()
            return
        r = next((x for x in result.pipes if x.pipe == pipe.name), None)
        if r is None:
            self.results_box.hide()
            return
        rows = [
            ("DN adotado:", f"{r.diameter_mm} mm"),
            ("Declividade:", f"{fmt.fmt(r.slope, 4)} m/m"),
            ("Q ini / fim:", f"{fmt.fmt(r.q_down_start, 2)} / "
                             f"{fmt.fmt(r.q_down_end, 2)} l/s"),
            ("Lâmina y/D ini / fim:", f"{fmt.fmt(r.yd_start, 2)} / "
                                      f"{fmt.fmt(r.yd_end, 2)}"),
            ("Velocidade ini / fim:", f"{fmt.fmt(r.v_start, 2)} / "
                                      f"{fmt.fmt(r.v_end, 2)} m/s"),
            ("Tensão trativa:", f"{fmt.fmt(r.tractive_pa, 2)} Pa"),
            ("Cota GI mont / jus:", f"{fmt.fmt(r.invert_up, 3)} / "
                                    f"{fmt.fmt(r.invert_down, 3)}"),
            ("Recobrimento mont / jus:", f"{fmt.fmt(r.cover_up, 2)} / "
                                         f"{fmt.fmt(r.cover_down, 2)} m"),
        ]
        for label, value in rows:
            self.results_form.addRow(label, QLabel(value))
        if r.violations:
            viol = QLabel("⚠ " + "\n⚠ ".join(r.violations))
            viol.setWordWrap(True)
            viol.setStyleSheet("color: #cc0000;")
            self.results_form.addRow(viol)
        self.results_box.show()

    def _show_node_results(self, node: Node):
        result = self.result_provider()
        if result is None:
            self.results_box.hide()
            return
        rows = []
        for r in result.pipes:
            if r.upstream == node.name:
                rows.append((f"Saída {r.pipe} — cota GI:",
                             f"{fmt.fmt(r.invert_up, 3)} m "
                             f"(prof. {fmt.fmt(r.depth_up, 2)} m)"))
            if r.downstream == node.name:
                rows.append((f"Chegada {r.pipe} — cota GI:",
                             f"{fmt.fmt(r.invert_down, 3)} m "
                             f"(prof. {fmt.fmt(r.depth_down, 2)} m)"))
        if not rows:
            self.results_box.hide()
            return
        for label, value in rows:
            self.results_form.addRow(label, QLabel(value))
        self.results_box.show()

    def apply_panel(self):
        items = self.scene.selectedItems()
        node_item = next((i for i in items if isinstance(i, NodeItem)), None)
        pipe_item = next((i for i in items if isinstance(i, PipeItem)), None)
        if node_item is not None:
            node = node_item.node
            old_name = node.name
            new_name = self.n_name.text().strip() or old_name
            node.name = new_name
            node.node_type = self.n_type.currentText()
            node.coord_n = fmt.parse(self.n_coord_n.text(), node.coord_n)
            node.coord_e = fmt.parse(self.n_coord_e.text(), node.coord_e)
            node.ground_elev = fmt.parse(self.n_ground.text(),
                                         node.ground_elev)
            node.q_point_start = fmt.parse(self.n_qini.text())
            node.q_point_end = fmt.parse(self.n_qfim.text())
            node.network = self.n_network.text().strip()
            if new_name != old_name:
                # os trechos referenciam o nó pelo nome: renomeia junto
                for p in self.project.pipes:
                    if p.upstream == old_name:
                        p.upstream = new_name
                    if p.downstream == old_name:
                        p.downstream = new_name
            node_item.refresh()
            self.update_pipes_of(new_name)
        elif pipe_item is not None:
            pipe = pipe_item.pipe
            pipe.name = self.p_name.text().strip() or pipe.name
            pipe.material = self.p_material.currentData() or ""
            pipe.diameter_mm = self.p_dn.value()
            pipe.slope = self.p_slope.value()
            pipe.zone = self.p_zone.text().strip()
            pipe.network = self.p_network.text().strip()
            pipe_item.refresh()
        else:
            return
        self.notify_network_changed(reload_scene=False)
        self.status.setText("Alterações aplicadas.")
