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

from PySide6.QtCore import Qt, QPointF, QRectF, QSize
from PySide6.QtGui import (QBrush, QColor, QFont, QIcon, QPainter,
                           QPainterPath, QPen, QPixmap, QPolygonF,
                           QTransform)
from PySide6.QtWidgets import (QButtonGroup, QColorDialog, QComboBox,
                               QDialog, QDialogButtonBox, QDoubleSpinBox,
                               QFormLayout, QFrame, QGraphicsItem,
                               QGraphicsLineItem, QGraphicsPathItem,
                               QGraphicsScene, QGraphicsSimpleTextItem,
                               QGraphicsView, QGroupBox, QHBoxLayout,
                               QLabel, QLineEdit, QMenu, QPushButton,
                               QSpinBox, QSplitter, QToolButton,
                               QVBoxLayout, QWidget)

from dataclasses import asdict

from ..core import fmt
from ..core.models import NODE_TYPES, Node, OseSheet, Pipe, Project
from ..core.simulation import SimulationResult


class _UndoStack:
    """Desfazer/refazer por snapshots do estado editável da rede.

    Guarda apenas nós, trechos e OSEs (o que o editor altera) — terreno e
    fundo ficam fora para não pesar. Snapshots idênticos são descartados.
    """

    LIMIT = 60

    def __init__(self):
        self.undo_states: list[dict] = []
        self.redo_states: list[dict] = []

    @staticmethod
    def capture(project: Project) -> dict:
        return {
            "nodes": [asdict(n) for n in project.nodes],
            "pipes": [asdict(p) for p in project.pipes],
            "oses": [asdict(o) for o in project.oses],
        }

    @staticmethod
    def restore(project: Project, state: dict):
        project.nodes = [Node(**d) for d in state["nodes"]]
        project.pipes = [Pipe(**d) for d in state["pipes"]]
        project.oses = [OseSheet(**d) for d in state["oses"]]

    def push(self, state: dict):
        if self.undo_states and self.undo_states[-1] == state:
            return
        self.undo_states.append(state)
        if len(self.undo_states) > self.LIMIT:
            self.undo_states.pop(0)
        self.redo_states.clear()

    def drop_if_unchanged(self, project: Project):
        """Remove o último snapshot se nada mudou (clique sem arrasto)."""
        if self.undo_states and self.undo_states[-1] == \
                self.capture(project):
            self.undo_states.pop()

    def undo(self, project: Project) -> bool:
        if not self.undo_states:
            return False
        self.redo_states.append(self.capture(project))
        self.restore(project, self.undo_states.pop())
        return True

    def redo(self, project: Project) -> bool:
        if not self.redo_states:
            return False
        self.undo_states.append(self.capture(project))
        self.restore(project, self.redo_states.pop())
        return True

NODE_RADIUS = 4.0        # raio do símbolo do PV (m de desenho)
# cores padrão por tipo de nó (PV branco; elevatória no rosinha padrão)
_NODE_COLORS = {
    "PV": QColor("#ffffff"), "TIL": QColor("#d9ead3"),
    "TL": QColor("#d9ead3"), "CP": QColor("#fff2cc"),
    "TQ": QColor("#f9cb9c"), "EEE": QColor("#ea9999"),
    "Lançamento": QColor("#cfe2f3"),
}
_PIPE_OK = QColor("#1f6fb2")
_PIPE_VIOL = QColor("#cc0000")
_SELECT = QColor("#ff8c00")
_ICON_FG = QColor("#333333")
_GRID = QColor(0, 0, 0, 22)
_GRID_TEXT = QColor(0, 0, 0, 70)


def _node_path(node_type: str, r: float = NODE_RADIUS) -> QPainterPath:
    """Símbolo do nó em planta: círculo (padrão) ou triângulo (EEE)."""
    path = QPainterPath()
    if node_type == "EEE":
        path.moveTo(0.0, -1.35 * r)
        path.lineTo(1.25 * r, r)
        path.lineTo(-1.25 * r, r)
        path.closeSubpath()
    else:
        path.addEllipse(-r, -r, 2 * r, 2 * r)
    return path


def _make_icon(kind: str) -> QIcon:
    """Ícones da barra de ferramentas, desenhados programaticamente."""
    pix = QPixmap(24, 24)
    pix.fill(Qt.transparent)
    p = QPainter(pix)
    p.setRenderHint(QPainter.Antialiasing)
    pen = QPen(_ICON_FG, 1.6)
    p.setPen(pen)
    if kind == "select":                       # seta de cursor
        poly = QPolygonF([QPointF(6, 3), QPointF(6, 19), QPointF(10.5, 14.5),
                          QPointF(13.5, 20.5), QPointF(16, 19.2),
                          QPointF(13, 13.3), QPointF(19, 13)])
        p.setBrush(QBrush(_ICON_FG))
        p.drawPolygon(poly)
    elif kind == "pan":                        # mãozinha
        p.setBrush(QBrush(QColor("#f6dcb8")))
        pen.setWidthF(1.2)
        p.setPen(pen)
        # dedos
        for i, (x, top) in enumerate([(8, 6.5), (11, 4.5), (14, 5),
                                      (17, 7)]):
            p.drawRoundedRect(QRectF(x - 1.2, top, 2.6, 9), 1.2, 1.2)
        # polegar
        p.drawRoundedRect(QRectF(4.2, 11, 2.8, 6.5), 1.3, 1.3)
        # palma
        p.drawRoundedRect(QRectF(6.4, 11.5, 12, 8.5), 3.5, 3.5)
    elif kind == "node":                       # PV (círculo)
        p.setBrush(QBrush(QColor("#ffffff")))
        p.drawEllipse(QRectF(5, 5, 14, 14))
        p.drawPoint(QPointF(12, 12))
    elif kind == "pipe":                       # trecho com seta de fluxo
        p.drawLine(QPointF(4, 19), QPointF(20, 5))
        p.setBrush(QBrush(_ICON_FG))
        p.drawPolygon(QPolygonF([QPointF(20, 5), QPointF(13.5, 7.5),
                                 QPointF(17.5, 11.5)]))
        p.setBrush(QBrush(QColor("#ffffff")))
        p.drawEllipse(QRectF(1.5, 16.5, 5, 5))
    elif kind == "fit":                        # lupa (ajustar zoom)
        p.drawEllipse(QRectF(4, 4, 11, 11))
        pen.setWidthF(2.2)
        p.setPen(pen)
        p.drawLine(QPointF(14, 14), QPointF(20, 20))
    elif kind in ("undo", "redo"):             # setas curvas
        p.setBrush(Qt.NoBrush)
        pen.setWidthF(2.0)
        p.setPen(pen)
        rect = QRectF(5, 7, 14, 14)
        if kind == "undo":
            p.drawArc(rect, 30 * 16, 180 * 16)
            p.setBrush(QBrush(_ICON_FG))
            p.setPen(Qt.NoPen)
            p.drawPolygon(QPolygonF([QPointF(5, 10), QPointF(11, 8),
                                     QPointF(7, 15)]))
        else:
            p.drawArc(rect, -30 * 16, 180 * 16)
            p.setBrush(QBrush(_ICON_FG))
            p.setPen(Qt.NoPen)
            p.drawPolygon(QPolygonF([QPointF(19, 10), QPointF(13, 8),
                                     QPointF(17, 15)]))
    elif kind == "colors":                     # paleta de cores
        p.setBrush(QBrush(QColor("#ffffff")))
        p.drawEllipse(QRectF(3, 4, 18, 16))
        p.setPen(Qt.NoPen)
        for color, (x, y) in [("#cc3333", (7, 8)), ("#3366cc", (12, 6.5)),
                              ("#33aa55", (16, 9)), ("#e6b422", (9.5, 13))]:
            p.setBrush(QBrush(QColor(color)))
            p.drawEllipse(QRectF(x, y, 3.4, 3.4))
    p.end()
    return QIcon(pix)


class NodeItem(QGraphicsPathItem):
    def __init__(self, node: Node, tab: "PlanTab"):
        super().__init__(_node_path(node.node_type))
        self.node = node
        self.tab = tab
        self.setPos(node.coord_e, -node.coord_n)
        self.setFlag(QGraphicsItem.ItemIsMovable)
        self.setFlag(QGraphicsItem.ItemIsSelectable)
        self.setFlag(QGraphicsItem.ItemSendsScenePositionChanges)
        self.setZValue(2)
        self.setPen(QPen(QColor("#222222"), 0.8))
        self.label = QGraphicsSimpleTextItem(node.name, self)
        font = QFont()
        font.setPointSizeF(4.5)
        font.setBold(True)
        self.label.setFont(font)
        self.label.setPos(NODE_RADIUS * 0.9, -NODE_RADIUS * 2.4)
        self.refresh()

    def fill_color(self) -> QColor:
        if self.node.color:
            return QColor(self.node.color)
        return _NODE_COLORS.get(self.node.node_type, QColor("#ffffff"))

    def refresh(self):
        self.label.setText(self.node.name)
        self.setPath(_node_path(self.node.node_type))
        self.setBrush(QBrush(self.fill_color()))
        self.setPos(self.node.coord_e, -self.node.coord_n)

    def itemChange(self, change, value):
        if change == QGraphicsItem.ItemScenePositionHasChanged:
            self.node.coord_e = self.pos().x()
            self.node.coord_n = -self.pos().y()
            self.tab.update_pipes_of(self.node.name)
            # coordenadas/extensões no painel acompanham o arrasto
            self.tab.live_update(self.node)
        return super().itemChange(change, value)

    def mousePressEvent(self, event):
        # snapshot no início do arrasto (descartado se nada mudar)
        self._press_pos = self.pos()
        self.tab.checkpoint()
        super().mousePressEvent(event)

    def mouseReleaseEvent(self, event):
        super().mouseReleaseEvent(event)
        moved = (self.pos() - getattr(self, "_press_pos",
                                      self.pos())).manhattanLength() > 1e-9
        self.tab.undo_stack.drop_if_unchanged(self.tab.project)
        self.tab._node_drag_finished(self, moved)

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

    def base_color(self) -> QColor:
        """Cor do trecho: violação > cor individual > cor da rede > padrão."""
        if self.violated:
            return _PIPE_VIOL
        if self.pipe.color:
            return QColor(self.pipe.color)
        net_color = self.tab.project.network_colors.get(
            self.pipe.network or "")
        if net_color:
            return QColor(net_color)
        return _PIPE_OK

    def update_geometry(self):
        up = self.tab.project.node_by_name(self.pipe.upstream)
        down = self.tab.project.node_by_name(self.pipe.downstream)
        if not (up and down):
            return
        x1, y1 = up.coord_e, -up.coord_n
        x2, y2 = down.coord_e, -down.coord_n
        self.setLine(x1, y1, x2, y2)
        pen = QPen(self.base_color(), 1.6)
        pen.setCosmetic(False)
        self.setPen(pen)
        # rótulo no meio, deslocado da linha
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        self.label.setPos(mx + 2.5, my + 2.5)
        # seta de fluxo a 60% do vão
        ax = x1 + (x2 - x1) * 0.6
        ay = y1 + (y2 - y1) * 0.6
        ang = math.atan2(y2 - y1, x2 - x1)
        size = 8.0
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
            color = _SELECT if self.isSelected() else self.base_color()
            painter.setBrush(QBrush(color))
            painter.setPen(Qt.NoPen)
            painter.drawPolygon(self.arrow_poly)

    def contextMenuEvent(self, event):
        self.tab.show_pipe_menu(self, event.screenPos(), event.scenePos())


class PlanScene(QGraphicsScene):
    def __init__(self, tab: "PlanTab"):
        super().__init__()
        self.tab = tab

    def mousePressEvent(self, event):
        mode = self.tab.mode
        if mode == "draw":
            if event.button() == Qt.LeftButton:
                self.tab.draw_click(event.scenePos())
                event.accept()
                return
            if event.button() == Qt.RightButton:
                self.tab.draw_type_menu(event.screenPos())
                event.accept()
                return
        elif event.button() == Qt.LeftButton:
            if mode == "add_node":
                self.tab.add_node_at(event.scenePos())
                event.accept()
                return
            if mode == "add_pipe":
                item = self.tab.node_item_near(event.scenePos())
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
        self._mid_panning = False
        self._pan_start = None

    def wheelEvent(self, event):
        factor = 1.15 if event.angleDelta().y() > 0 else 1 / 1.15
        self.scale(factor, factor)

    # botão do meio (rodinha pressionada) funciona como pan em qualquer modo
    def mousePressEvent(self, event):
        if event.button() == Qt.MiddleButton:
            self._mid_panning = True
            self._pan_start = event.position().toPoint()
            self.setCursor(Qt.ClosedHandCursor)
            event.accept()
            return
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event):
        if self._mid_panning and self._pan_start is not None:
            delta = event.position().toPoint() - self._pan_start
            self._pan_start = event.position().toPoint()
            self.horizontalScrollBar().setValue(
                self.horizontalScrollBar().value() - delta.x())
            self.verticalScrollBar().setValue(
                self.verticalScrollBar().value() - delta.y())
            event.accept()
            return
        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.MiddleButton and self._mid_panning:
            self._mid_panning = False
            self.unsetCursor()
            event.accept()
            return
        super().mouseReleaseEvent(event)

    def _grid_step(self) -> float:
        """Passo do grid adaptado ao zoom (espaçamento >= ~80 px)."""
        scale = self.transform().m11() or 1e-9
        for step in (1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000,
                     10000, 20000, 50000):
            if step * scale >= 80.0:
                return float(step)
        return 100000.0

    def drawBackground(self, painter, rect: QRectF):
        super().drawBackground(painter, rect)
        painter.fillRect(rect, QColor("#fbfbf8"))
        step = self._grid_step()
        pen = QPen(_GRID, 0)
        pen.setCosmetic(True)
        painter.setPen(pen)
        xs, ys = [], []
        x = math.floor(rect.left() / step) * step
        while x < rect.right():
            painter.drawLine(QPointF(x, rect.top()),
                             QPointF(x, rect.bottom()))
            xs.append(x)
            x += step
        y = math.floor(rect.top() / step) * step
        while y < rect.bottom():
            painter.drawLine(QPointF(rect.left(), y),
                             QPointF(rect.right(), y))
            ys.append(y)
            y += step

        # rótulos discretos das coordenadas (E nas verticais, N nas
        # horizontais), desenhados em tamanho fixo de tela
        painter.save()
        painter.setWorldTransform(QTransform())
        font = QFont()
        font.setPointSizeF(7.0)
        painter.setFont(font)
        painter.setPen(QPen(_GRID_TEXT, 0))
        decimals = 0 if step >= 1 else 2
        for x in xs:
            device = self.mapFromScene(QPointF(x, rect.top()))
            painter.drawText(device.x() + 3, 12,
                             f"E {fmt.fmt(x, decimals)}")
        for y in ys:
            device = self.mapFromScene(QPointF(rect.left(), y))
            painter.drawText(3, device.y() - 3,
                             f"N {fmt.fmt(-y, decimals)}")
        painter.restore()


class _ColorPicker(QWidget):
    """Botão de cor com opção de voltar ao padrão ('' = cor padrão)."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.color = ""
        lay = QHBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        self.btn = QPushButton()
        self.btn.setFixedSize(48, 22)
        self.btn.clicked.connect(self._pick)
        reset = QPushButton("Padrão")
        reset.setToolTip("Volta à cor padrão (por tipo ou por rede).")
        reset.clicked.connect(self._reset)
        lay.addWidget(self.btn)
        lay.addWidget(reset)
        lay.addStretch(1)
        self._update()

    def set_color(self, color: str):
        self.color = color or ""
        self._update()

    def _update(self):
        if self.color:
            self.btn.setStyleSheet(
                f"background: {self.color}; border: 1px solid #666;")
            self.btn.setText("")
        else:
            self.btn.setStyleSheet("")
            self.btn.setText("auto")

    def _pick(self):
        initial = QColor(self.color) if self.color else QColor("#1f6fb2")
        chosen = QColorDialog.getColor(initial, self, "Cor na planta")
        if chosen.isValid():
            self.color = chosen.name()
            self._update()

    def _reset(self):
        self.color = ""
        self._update()


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

        def mode_button(icon_kind, text, mode, tip):
            btn = QToolButton()
            btn.setIcon(_make_icon(icon_kind))
            btn.setIconSize(QSize(22, 22))
            btn.setText(text)
            btn.setToolButtonStyle(Qt.ToolButtonTextBesideIcon)
            btn.setCheckable(True)
            btn.setToolTip(tip)
            btn.clicked.connect(lambda: self.set_mode(mode))
            self.mode_group.addButton(btn)
            toolbar.addWidget(btn)
            return btn

        def separator():
            sep = QFrame()
            sep.setFrameShape(QFrame.VLine)
            sep.setFrameShadow(QFrame.Sunken)
            toolbar.addWidget(sep)

        # grupo desfazer/refazer
        self.undo_stack = _UndoStack()
        self.btn_undo = QToolButton()
        self.btn_undo.setIcon(_make_icon("undo"))
        self.btn_undo.setIconSize(QSize(22, 22))
        self.btn_undo.setToolTip("Desfazer (Ctrl+Z)")
        self.btn_undo.clicked.connect(self.undo)
        toolbar.addWidget(self.btn_undo)
        self.btn_redo = QToolButton()
        self.btn_redo.setIcon(_make_icon("redo"))
        self.btn_redo.setIconSize(QSize(22, 22))
        self.btn_redo.setToolTip("Refazer (Ctrl+Y)")
        self.btn_redo.clicked.connect(self.redo)
        toolbar.addWidget(self.btn_redo)
        separator()
        # grupo navegação/seleção
        self.btn_select = mode_button(
            "select", "Selecionar", "select",
            "Clique para selecionar; arraste PVs para movê-los.")
        self.btn_pan = mode_button(
            "pan", "Pan", "pan",
            "Arraste para mover a vista (o botão do meio do mouse também "
            "faz pan em qualquer modo).")
        separator()
        # grupo desenho (unificado: PV + trecho em sequência)
        self.btn_draw = mode_button(
            "pipe", "Desenhar rede", "draw",
            "Traçado contínuo: clique no vazio cria um PV (e o trecho "
            "ligando ao anterior); clique num PV existente conecta a ele; "
            "botão direito troca o tipo do nó (EEE encerra o traçado); "
            "ESC encerra a sequência.")
        self.node_type_combo = QComboBox()
        self.node_type_combo.addItems(NODE_TYPES)
        self.node_type_combo.setToolTip(
            "Tipo do próximo nó criado no traçado (botão direito também "
            "troca durante o desenho).")
        toolbar.addWidget(self.node_type_combo)
        separator()
        # grupo vista/aparência
        fit = QToolButton()
        fit.setIcon(_make_icon("fit"))
        fit.setIconSize(QSize(22, 22))
        fit.setText("Ajustar zoom")
        fit.setToolButtonStyle(Qt.ToolButtonTextBesideIcon)
        fit.clicked.connect(self.fit_view)
        toolbar.addWidget(fit)
        colors_btn = QToolButton()
        colors_btn.setIcon(_make_icon("colors"))
        colors_btn.setIconSize(QSize(22, 22))
        colors_btn.setText("Cores das redes…")
        colors_btn.setToolButtonStyle(Qt.ToolButtonTextBesideIcon)
        colors_btn.setToolTip(
            "Define uma cor de trecho por nome de rede (ex.: coletor de "
            "uma cor, interceptor de outra).")
        colors_btn.clicked.connect(self.edit_network_colors)
        toolbar.addWidget(colors_btn)
        terrain_btn = QToolButton()
        terrain_btn.setText("Terreno ▾")
        terrain_btn.setToolTip(
            "Curvas de nível / pontos cotados (DXF ou CSV) para "
            "interpolação automática das cotas dos PVs.")
        terrain_menu = QMenu(terrain_btn)
        terrain_menu.addAction("Carregar curvas de nível (DXF/CSV)…",
                               self.load_terrain)
        terrain_menu.addAction("Aplicar cotas do terreno aos nós",
                               self.apply_terrain_elevations)
        self.act_show_terrain = terrain_menu.addAction(
            "Mostrar curvas de nível")
        self.act_show_terrain.setCheckable(True)
        self.act_show_terrain.setChecked(True)
        self.act_show_terrain.toggled.connect(
            lambda _checked: self._draw_terrain())
        terrain_menu.addAction("Remover terreno do projeto",
                               self.clear_terrain)
        terrain_btn.setMenu(terrain_menu)
        terrain_btn.setPopupMode(QToolButton.InstantPopup)
        toolbar.addWidget(terrain_btn)
        bg_btn = QToolButton()
        bg_btn.setText("Fundo ▾")
        bg_btn.setToolTip(
            "Fundo da planta: DXF de arruamento/cadastro ou imagem "
            "georreferenciada (world file lido automaticamente).")
        bg_menu = QMenu(bg_btn)
        bg_menu.addAction("Carregar DXF de fundo (arruamento/cadastro)…",
                          self.load_background_dxf)
        bg_menu.addAction("Carregar imagem de fundo…",
                          self.load_background_image)
        self.act_show_background = bg_menu.addAction("Mostrar fundo")
        self.act_show_background.setCheckable(True)
        self.act_show_background.setChecked(True)
        self.act_show_background.toggled.connect(
            lambda _checked: self._draw_background())
        bg_menu.addAction("Remover fundo do projeto", self.clear_background)
        bg_btn.setMenu(bg_menu)
        bg_btn.setPopupMode(QToolButton.InstantPopup)
        toolbar.addWidget(bg_btn)
        dxf_btn = QToolButton()
        dxf_btn.setText("Exportar DXF…")
        dxf_btn.setToolTip(
            "Exporta a planta para CAD: rede (um layer por nome de rede, "
            "com as cores configuradas), PVs, textos, setas de fluxo e "
            "curvas de nível em 3D.")
        dxf_btn.clicked.connect(self.export_dxf)
        toolbar.addWidget(dxf_btn)

        self.btn_select.setChecked(True)
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

        from PySide6.QtGui import QKeySequence, QShortcut
        QShortcut(QKeySequence.Undo, self, activated=self.undo)
        QShortcut(QKeySequence.Redo, self, activated=self.redo)
        QShortcut(QKeySequence("Ctrl+Y"), self, activated=self.redo)
        self._update_undo_buttons()

    # ------------------------------------------------------ desfazer/refazer
    def checkpoint(self):
        """Grava o estado atual antes de uma alteração."""
        self.undo_stack.push(_UndoStack.capture(self.project))
        self._update_undo_buttons()

    def undo(self):
        if self.undo_stack.undo(self.project):
            self.notify_network_changed(reload_scene=True)
            self.status.setText("Desfeito.")
        self._update_undo_buttons()

    def redo(self):
        if self.undo_stack.redo(self.project):
            self.notify_network_changed(reload_scene=True)
            self.status.setText("Refeito.")
        self._update_undo_buttons()

    def _update_undo_buttons(self):
        self.btn_undo.setEnabled(bool(self.undo_stack.undo_states))
        self.btn_redo.setEnabled(bool(self.undo_stack.redo_states))

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
        self.n_color = _ColorPicker()
        form.addRow("Cor na planta:", self.n_color)
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
        self.p_color = _ColorPicker()
        form.addRow("Cor na planta:", self.p_color)
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
        self._draw_last = None      # último nó do traçado contínuo
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
            "draw": "Traçado: clique no vazio cria PV; num PV existente, "
                    "conecta. ESC encerra a sequência.",
            "add_node": "Clique na planta para inserir o nó.",
            "add_pipe": "Clique no nó de MONTANTE.",
        }
        self.status.setText(hints.get(mode, ""))

    # ------------------------------------------------ traçado contínuo
    def draw_click(self, pos: QPointF):
        """Um clique do modo Desenhar: cria/conecta e segue a sequência."""
        hit = self.node_item_near(pos)
        if hit is not None:
            node = hit.node
        else:
            node = None
        if self._draw_last is not None:
            # continuando o traçado: o nó de partida não pode ganhar uma
            # segunda saída
            if self._has_outlet(self._draw_last.name):
                self.status.setText(
                    f"⚠ {self._draw_last.name} já possui uma saída — cada "
                    "unidade tem uma única saída. Sequência encerrada.")
                self._draw_last = None
                return
        if node is None:
            self.add_node_at(pos)
            node = self.project.nodes[-1]
        if self._draw_last is not None and self._draw_last.name != node.name:
            if self._create_pipe(self._draw_last, node) is None:
                return
        if node.node_type == "EEE":
            # elevatória é o fim da linha: encerra o traçado
            self._draw_last = None
            self.exit_to_select(
                f"Traçado encerrado na elevatória {node.name}.")
            return
        self._draw_last = node
        self.status.setText(
            f"Traçando a partir de {node.name} — clique no próximo ponto "
            "(ESC encerra).")

    def exit_to_select(self, message: str = ""):
        """Volta ao modo Selecionar (após ESC, EEE ou simulação)."""
        self.set_mode("select")
        self.btn_select.setChecked(True)
        if message:
            self.status.setText(message)

    def _has_outlet(self, node_name: str) -> bool:
        return any(p.upstream == node_name for p in self.project.pipes)

    def draw_type_menu(self, screen_pos):
        """Botão direito durante o desenho: troca o tipo do próximo nó."""
        menu = QMenu()
        actions = {menu.addAction(t): t for t in NODE_TYPES}
        chosen = menu.exec(screen_pos)
        if chosen is not None:
            self.node_type_combo.setCurrentText(actions[chosen])
            self.status.setText(
                f"Próximo nó será do tipo {actions[chosen]}.")

    def _create_pipe(self, up_node: Node, down_node: Node) -> Pipe | None:
        if self._has_outlet(up_node.name):
            self.status.setText(
                f"⚠ {up_node.name} já possui uma saída — cada unidade tem "
                "uma única saída (não criado).")
            return None
        self.checkpoint()
        names = {p.name for p in self.project.pipes}
        i = 1
        while f"T{i}" in names:
            i += 1
        pipe = Pipe(name=f"T{i}", upstream=up_node.name,
                    downstream=down_node.name, network=up_node.network)
        self.project.pipes.append(pipe)
        pitem = PipeItem(pipe, self)
        self.scene.addItem(pitem)
        self._pipe_items[pipe.id] = pitem
        self.notify_network_changed(reload_scene=False)
        return pipe

    def live_update(self, node: Node):
        """Painel acompanha o arrasto: coordenadas e extensões ao vivo."""
        items = self.scene.selectedItems()
        for item in items:
            if isinstance(item, NodeItem) and item.node is node:
                self.n_coord_n.setText(fmt.fmt_edit(node.coord_n, 2))
                self.n_coord_e.setText(fmt.fmt_edit(node.coord_e, 2))
            elif isinstance(item, PipeItem) and node.name in (
                    item.pipe.upstream, item.pipe.downstream):
                self.p_length.setText(
                    f"{fmt.fmt(self.project.pipe_length(item.pipe), 2)} m"
                    + ("" if item.pipe.length > 0 else " (por coordenadas)"))

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
        self._terrain_items = []
        self._background_items = []
        self._draw_background()
        self._draw_terrain()
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

    def clear_result_markers(self):
        """Rede alterada: remove DN/violações herdados da simulação."""
        for item in self._pipe_items.values():
            item.violated = False
            item.label.setText(item.pipe.name)
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

    def _terrain_elevation(self, e: float, n: float) -> float | None:
        if not self.project.terrain_lines:
            return None
        from ..core.terrain import TerrainError, TerrainModel, lines_to_points
        try:
            model = TerrainModel(lines_to_points(self.project.terrain_lines))
            return round(model.elevation_at(e, n), 3)
        except TerrainError:
            return None

    def node_item_near(self, pos: QPointF,
                       radius_px: float = 18.0) -> NodeItem | None:
        """Nó mais próximo do clique dentro do raio de snap (em pixels)."""
        scale = self.view.transform().m11() or 1.0
        radius = radius_px / scale
        best, best_dist = None, radius
        for item in self._node_items.values():
            dist = math.hypot(item.pos().x() - pos.x(),
                              item.pos().y() - pos.y())
            if dist <= best_dist:
                best, best_dist = item, dist
        return best

    def add_node_at(self, pos: QPointF):
        self.checkpoint()
        names = {n.name for n in self.project.nodes}
        node_type = self.node_type_combo.currentText()
        prefix = "PV-" if node_type == "PV" else f"{node_type}-"
        e, n = round(pos.x(), 2), round(-pos.y(), 2)
        ground = self._terrain_elevation(e, n)
        node = Node(
            name=self._next_name(prefix, names),
            node_type=node_type,
            coord_e=e,
            coord_n=n,
            ground_elev=ground if ground is not None else 0.0,
        )
        self.project.nodes.append(node)
        item = NodeItem(node, self)
        item.setFlag(QGraphicsItem.ItemIsMovable, False)
        self.scene.addItem(item)
        self._node_items[node.id] = item
        if ground is not None:
            self.status.setText(
                f"Nó {node.name} criado — cota {fmt.fmt(ground, 3)} m "
                "interpolada do terreno.")
        else:
            self.status.setText(f"Nó {node.name} criado — informe a cota "
                                "do terreno nas propriedades.")
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
        pipe = self._create_pipe(self._pipe_first.node, item.node)
        if pipe is not None:
            self.status.setText(f"Trecho {pipe.name} criado "
                                f"({pipe.upstream} → {pipe.downstream}). "
                                "Clique no próximo nó de MONTANTE.")
        self._pipe_first = None

    def update_pipes_of(self, node_name: str):
        for item in self._pipe_items.values():
            if node_name in (item.pipe.upstream, item.pipe.downstream):
                item.update_geometry()

    def notify_network_changed(self, reload_scene: bool = True):
        self.network_changed()
        if reload_scene:
            self.load_from(self.project)
        self._update_undo_buttons()

    def _node_drag_finished(self, item: NodeItem, moved: bool):
        """Fim de um clique/arrasto em PV: só invalida se houve movimento.

        Clique simples (selecionar e ver propriedades) não altera nada e
        não pode descartar os resultados da simulação.
        """
        if moved:
            self.notify_network_changed(reload_scene=False)

    def refresh_geometry(self):
        """Sincroniza o desenho com o modelo (posições, nomes, cores)."""
        for item in self._node_items.values():
            item.refresh()
        for item in self._pipe_items.values():
            item.refresh()

    def export_dxf(self):
        from PySide6.QtWidgets import QFileDialog, QMessageBox
        from ..core.dxf_export import DxfExportError, export_plan_dxf
        path, _ = QFileDialog.getSaveFileName(
            self, "Exportar planta para DXF", "planta.dxf", "DXF (*.dxf)")
        if not path:
            return
        try:
            export_plan_dxf(self.project, self.result_provider(), path)
        except DxfExportError as exc:
            QMessageBox.warning(self, "DXF", str(exc))
            return
        except Exception as exc:
            QMessageBox.critical(self, "Erro ao exportar",
                                 f"Não foi possível gravar o DXF:\n{exc}")
            return
        self.status.setText(f"Planta exportada: {path}")

    # ------------------------------------------------------------ terreno
    def load_terrain(self):
        from PySide6.QtWidgets import QFileDialog, QMessageBox
        from ..core.terrain import TerrainError, load_csv, load_dxf
        path, _ = QFileDialog.getOpenFileName(
            self, "Carregar curvas de nível / pontos cotados", "",
            "Terreno (*.dxf *.csv *.txt);;DXF (*.dxf);;CSV (*.csv *.txt)")
        if not path:
            return
        try:
            if path.lower().endswith(".dxf"):
                lines = load_dxf(path)
            else:
                lines = load_csv(path)
        except TerrainError as exc:
            QMessageBox.warning(self, "Terreno", str(exc))
            return
        self.project.terrain_lines = [
            [[float(v[0]), float(v[1]), float(v[2])] for v in line]
            for line in lines]
        n_pts = sum(len(line) for line in lines)
        self.status.setText(
            f"Terreno carregado: {len(lines)} linha(s), {n_pts} pontos. "
            "Ative 'interpolar curvas de nível' na aba 3 ou use "
            "'Aplicar cotas do terreno aos nós'.")
        self._draw_terrain()
        self.fit_view()

    def apply_terrain_elevations(self):
        """Grava as cotas interpoladas no campo cota terreno dos nós."""
        from PySide6.QtWidgets import QMessageBox
        from ..core.terrain import TerrainError, TerrainModel, lines_to_points
        if not self.project.terrain_lines:
            QMessageBox.information(
                self, "Terreno", "Carregue as curvas de nível primeiro "
                "(Terreno > Carregar).")
            return
        try:
            terrain = TerrainModel(lines_to_points(self.project.terrain_lines))
        except TerrainError as exc:
            QMessageBox.warning(self, "Terreno", str(exc))
            return
        for node in self.project.nodes:
            node.ground_elev = round(
                terrain.elevation_at(node.coord_e, node.coord_n), 3)
        self.status.setText(
            f"Cotas de {len(self.project.nodes)} nó(s) atualizadas a "
            "partir do terreno.")
        self.notify_network_changed(reload_scene=False)

    def clear_terrain(self):
        self.project.terrain_lines = []
        self._draw_terrain()
        self.status.setText("Terreno removido do projeto.")

    def _draw_terrain(self):
        for item in getattr(self, "_terrain_items", []):
            try:
                self.scene.removeItem(item)
            except RuntimeError:
                pass
        self._terrain_items = []
        if not self.act_show_terrain.isChecked():
            return
        pen = QPen(QColor(160, 120, 60, 90), 0)
        pen.setCosmetic(True)
        font = QFont()
        font.setPointSizeF(3.5)
        for line in self.project.terrain_lines:
            if len(line) < 2:
                continue
            path = QPainterPath(QPointF(line[0][0], -line[0][1]))
            for vertex in line[1:]:
                path.lineTo(vertex[0], -vertex[1])
            item = self.scene.addPath(path, pen)
            item.setZValue(-1)
            self._terrain_items.append(item)
            # cota da curva junto ao primeiro vértice
            label = QGraphicsSimpleTextItem(fmt.fmt(line[0][2], 1))
            label.setFont(font)
            label.setBrush(QBrush(QColor(160, 120, 60, 140)))
            label.setPos(line[0][0] + 1.5, -line[0][1])
            label.setZValue(-1)
            self.scene.addItem(label)
            self._terrain_items.append(label)

    # ------------------------------------------------------------- fundo
    def load_background_dxf(self):
        from PySide6.QtWidgets import QFileDialog, QMessageBox
        from ..core.background import BackgroundError, load_dxf_background
        path, _ = QFileDialog.getOpenFileName(
            self, "Carregar DXF de fundo (arruamento/cadastro)", "",
            "DXF (*.dxf)")
        if not path:
            return
        try:
            lines, texts = load_dxf_background(path)
        except BackgroundError as exc:
            QMessageBox.warning(self, "Fundo", str(exc))
            return
        self.project.background_lines = lines
        self.project.background_texts = texts
        self.status.setText(
            f"Fundo carregado: {len(lines)} linha(s), {len(texts)} "
            "texto(s).")
        self._draw_background()
        self.fit_view()

    def load_background_image(self):
        from PySide6.QtGui import QPixmap
        from PySide6.QtWidgets import QFileDialog, QMessageBox
        from ..core.background import read_world_file
        path, _ = QFileDialog.getOpenFileName(
            self, "Carregar imagem de fundo", "",
            "Imagens (*.png *.jpg *.jpeg *.bmp *.tif *.tiff)")
        if not path:
            return
        if QPixmap(path).isNull():
            QMessageBox.warning(self, "Fundo",
                                "Não foi possível ler a imagem.")
            return
        bg = self.project.background_image
        world = read_world_file(path)
        if world is not None:
            bg.m_per_px, bg.origin_e, bg.origin_n = world
            self.status.setText(
                "World file encontrado: imagem georreferenciada "
                "automaticamente.")
        else:
            if not self._ask_image_placement(bg):
                return
        bg.path = path
        self._draw_background()
        self.fit_view()

    def _ask_image_placement(self, bg) -> bool:
        """Posicionamento manual quando a imagem não tem world file."""
        dialog = QDialog(self)
        dialog.setWindowTitle("Posicionar imagem de fundo")
        v = QVBoxLayout(dialog)
        hint = QLabel(
            "Imagem sem world file (.jgw/.pgw/.tfw). Informe a coordenada "
            "do canto SUPERIOR ESQUERDO e a resolução (metros por pixel).")
        hint.setWordWrap(True)
        v.addWidget(hint)
        form = QFormLayout()
        e_edit = QLineEdit(fmt.fmt_edit(bg.origin_e, 2))
        n_edit = QLineEdit(fmt.fmt_edit(bg.origin_n, 2))
        res_edit = QLineEdit(fmt.fmt_edit(bg.m_per_px, 4))
        form.addRow("E do canto sup. esquerdo (m):", e_edit)
        form.addRow("N do canto sup. esquerdo (m):", n_edit)
        form.addRow("Metros por pixel:", res_edit)
        v.addLayout(form)
        buttons = QDialogButtonBox(QDialogButtonBox.Ok
                                   | QDialogButtonBox.Cancel)
        buttons.accepted.connect(dialog.accept)
        buttons.rejected.connect(dialog.reject)
        v.addWidget(buttons)
        if dialog.exec() != QDialog.Accepted:
            return False
        bg.origin_e = fmt.parse(e_edit.text(), bg.origin_e)
        bg.origin_n = fmt.parse(n_edit.text(), bg.origin_n)
        bg.m_per_px = max(1e-6, fmt.parse(res_edit.text(), bg.m_per_px))
        return True

    def clear_background(self):
        self.project.background_lines = []
        self.project.background_texts = []
        self.project.background_image.path = ""
        self._draw_background()
        self.status.setText("Fundo removido do projeto.")

    def _draw_background(self):
        from PySide6.QtGui import QPixmap
        for item in getattr(self, "_background_items", []):
            try:
                self.scene.removeItem(item)
            except RuntimeError:
                pass
        self._background_items = []
        if not self.act_show_background.isChecked():
            return
        # imagem raster (abaixo de tudo)
        bg = self.project.background_image
        if bg.path:
            pixmap = QPixmap(bg.path)
            if pixmap.isNull():
                self.status.setText(
                    f"Imagem de fundo não encontrada: {bg.path}")
            else:
                item = self.scene.addPixmap(pixmap)
                item.setPos(bg.origin_e, -bg.origin_n)
                item.setScale(bg.m_per_px)
                item.setOpacity(bg.opacity)
                item.setZValue(-4)
                self._background_items.append(item)
        # DXF de fundo (linhas cinza + textos)
        pen = QPen(QColor(120, 120, 120, 110), 0)
        pen.setCosmetic(True)
        for line in self.project.background_lines:
            if len(line) < 2:
                continue
            path = QPainterPath(QPointF(line[0][0], -line[0][1]))
            for vertex in line[1:]:
                path.lineTo(vertex[0], -vertex[1])
            item = self.scene.addPath(path, pen)
            item.setZValue(-3)
            self._background_items.append(item)
        for e, n, height, rotation, content in self.project.background_texts:
            label = QGraphicsSimpleTextItem(str(content))
            font = QFont()
            font.setPointSizeF(max(0.5, float(height)))
            label.setFont(font)
            label.setBrush(QBrush(QColor(120, 120, 120, 150)))
            label.setPos(float(e), -float(n) - float(height) * 1.4)
            if rotation:
                label.setTransformOriginPoint(0, float(height) * 1.4)
                label.setRotation(-float(rotation))
            label.setZValue(-3)
            self.scene.addItem(label)
            self._background_items.append(label)

    def edit_network_colors(self):
        """Diálogo de cor por nome de rede (coletor, interceptor...)."""
        networks = sorted({p.network or "" for p in self.project.pipes})
        if not networks:
            networks = [""]
        dialog = QDialog(self)
        dialog.setWindowTitle("Cores das redes")
        v = QVBoxLayout(dialog)
        hint = QLabel("Cor dos trechos por nome de rede. 'auto' usa a cor "
                      "padrão. A cor individual de um trecho (propriedades) "
                      "tem prioridade sobre a da rede.")
        hint.setWordWrap(True)
        v.addWidget(hint)
        form = QFormLayout()
        pickers: dict[str, _ColorPicker] = {}
        for net in networks:
            picker = _ColorPicker()
            picker.set_color(self.project.network_colors.get(net, ""))
            pickers[net] = picker
            form.addRow(f"Rede '{net}':" if net else "(trechos sem rede):",
                        picker)
        v.addLayout(form)
        buttons = QDialogButtonBox(QDialogButtonBox.Ok
                                   | QDialogButtonBox.Cancel)
        buttons.accepted.connect(dialog.accept)
        buttons.rejected.connect(dialog.reject)
        v.addWidget(buttons)
        if dialog.exec() != QDialog.Accepted:
            return
        for net, picker in pickers.items():
            if picker.color:
                self.project.network_colors[net] = picker.color
            else:
                self.project.network_colors.pop(net, None)
        for item in self._pipe_items.values():
            item.update_geometry()

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

    def show_pipe_menu(self, item: PipeItem, screen_pos, scene_pos=None):
        menu = QMenu()
        act_prop = menu.addAction("Propriedades…")
        act_split = menu.addAction("Inserir PV neste ponto (dividir trecho)")
        act_invert = menu.addAction("Inverter sentido (mont ↔ jus)")
        act_del = menu.addAction("Excluir trecho")
        chosen = menu.exec(screen_pos)
        if chosen == act_prop:
            item.setSelected(True)
            self.p_name.setFocus()
        elif chosen == act_split and scene_pos is not None:
            self.split_pipe(item.pipe, scene_pos)
        elif chosen == act_invert:
            self.checkpoint()
            item.pipe.upstream, item.pipe.downstream = \
                item.pipe.downstream, item.pipe.upstream
            item.update_geometry()
            self.notify_network_changed(reload_scene=False)
        elif chosen == act_del:
            self.delete_pipe(item.pipe)

    def split_pipe(self, pipe: Pipe, scene_pos: QPointF):
        """Insere um PV sobre o trecho, dividindo-o em dois.

        O ponto clicado é projetado sobre o eixo do trecho; a cota do novo
        PV vem do terreno (se carregado) ou é interpolada entre os PVs de
        montante e jusante.
        """
        up = self.project.node_by_name(pipe.upstream)
        down = self.project.node_by_name(pipe.downstream)
        if not (up and down):
            return
        # projeção do clique sobre o segmento (coords de cena: y = -N)
        ax, ay = up.coord_e, -up.coord_n
        bx, by = down.coord_e, -down.coord_n
        dx, dy = bx - ax, by - ay
        length2 = dx * dx + dy * dy
        if length2 <= 1e-9:
            return
        frac = ((scene_pos.x() - ax) * dx + (scene_pos.y() - ay) * dy) \
            / length2
        frac = min(max(frac, 0.05), 0.95)   # nunca em cima dos PVs
        e = round(ax + dx * frac, 2)
        n = round(-(ay + dy * frac), 2)
        ground = self._terrain_elevation(e, n)
        if ground is None:
            ground = round(up.ground_elev
                           + (down.ground_elev - up.ground_elev) * frac, 3)

        self.checkpoint()
        names = {nd.name for nd in self.project.nodes}
        node = Node(name=self._next_name("PV-", names), node_type="PV",
                    coord_e=e, coord_n=n, ground_elev=ground,
                    network=pipe.network)
        self.project.nodes.append(node)
        # trecho original passa a terminar no novo PV; o novo trecho herda
        # as propriedades e segue até o jusante original
        pipe_names = {p.name for p in self.project.pipes}
        i = 1
        while f"T{i}" in pipe_names:
            i += 1
        new_pipe = Pipe(name=f"T{i}", upstream=node.name,
                        downstream=pipe.downstream, material=pipe.material,
                        diameter_mm=pipe.diameter_mm, slope=pipe.slope,
                        status=pipe.status, network=pipe.network,
                        zone=pipe.zone, color=pipe.color)
        pipe.downstream = node.name
        pipe.length = 0.0        # recalcula pelas coordenadas
        index = self.project.pipes.index(pipe)
        self.project.pipes.insert(index + 1, new_pipe)
        self.status.setText(
            f"Trecho dividido: {pipe.name} até {node.name} "
            f"(cota {fmt.fmt(ground, 3)} m) e {new_pipe.name} adiante.")
        self.notify_network_changed(reload_scene=True)

    def delete_node(self, node: Node):
        self.checkpoint()
        self.project.pipes = [p for p in self.project.pipes
                              if node.name not in (p.upstream, p.downstream)]
        self.project.nodes = [n for n in self.project.nodes
                              if n.id != node.id]
        self.notify_network_changed(reload_scene=True)

    def delete_pipe(self, pipe: Pipe):
        self.checkpoint()
        self.project.pipes = [p for p in self.project.pipes
                              if p.id != pipe.id]
        self.notify_network_changed(reload_scene=True)

    def keyPressEvent(self, event):
        if event.key() == Qt.Key_Escape and self.mode == "draw":
            self._draw_last = None
            self.exit_to_select("Traçado encerrado (modo Selecionar).")
            return
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
            self.n_color.set_color(node.color)
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
            self.p_color.set_color(pipe.color)
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
        arrivals = [r for r in result.pipes if r.downstream == node.name]
        outlets = [r for r in result.pipes if r.upstream == node.name]
        if not arrivals and not outlets:
            self.results_box.hide()
            return
        rows = []
        total_ini = total_fim = 0.0
        for r in arrivals:
            total_ini += r.q_down_start
            total_fim += r.q_down_end
            rows.append((
                f"Chegada {r.pipe}:",
                f"Q = {fmt.fmt(r.q_down_start, 2)} / "
                f"{fmt.fmt(r.q_down_end, 2)} l/s — "
                f"GI {fmt.fmt(r.invert_down, 3)} "
                f"(prof. {fmt.fmt(r.depth_down, 2)} m)"))
        if len(arrivals) > 1:
            rows.append(("Total de chegadas:",
                         f"Q = {fmt.fmt(total_ini, 2)} / "
                         f"{fmt.fmt(total_fim, 2)} l/s"))
        if node.q_point_start or node.q_point_end:
            rows.append(("Vazão pontual no nó:",
                         f"Q = {fmt.fmt(node.q_point_start, 2)} / "
                         f"{fmt.fmt(node.q_point_end, 2)} l/s"))
        for r in outlets:
            rows.append((
                f"Saída {r.pipe}:",
                f"Q = {fmt.fmt(r.q_up_start, 2)} / "
                f"{fmt.fmt(r.q_up_end, 2)} l/s — "
                f"GI {fmt.fmt(r.invert_up, 3)} "
                f"(prof. {fmt.fmt(r.depth_up, 2)} m)"))
        if len(arrivals) > 3:
            alerta = QLabel(f"⚠ {len(arrivals)} chegadas neste PV (usual: "
                            "até 3) — verifique conflito físico das "
                            "tubulações.")
            alerta.setWordWrap(True)
            alerta.setStyleSheet("color: #b36b00;")
            self.results_form.addRow(alerta)
        for label, value in rows:
            value_label = QLabel(value)
            value_label.setWordWrap(True)
            self.results_form.addRow(label, value_label)
        self.results_box.show()

    def apply_panel(self):
        items = self.scene.selectedItems()
        node_item = next((i for i in items if isinstance(i, NodeItem)), None)
        pipe_item = next((i for i in items if isinstance(i, PipeItem)), None)
        if node_item is not None or pipe_item is not None:
            self.checkpoint()
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
            node.color = self.n_color.color
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
            pipe.color = self.p_color.color
            pipe_item.refresh()
        else:
            return
        self.undo_stack.drop_if_unchanged(self.project)
        self.notify_network_changed(reload_scene=False)
        self.status.setText("Alterações aplicadas.")
