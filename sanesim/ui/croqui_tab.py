"""Croqui da OSE (folha 2): planta da OSE enquadrada em folha de projeto.

- Folha série A (A4/A3/A2, paisagem) com margem, carimbo (logo, empresa,
  projeto, OSE, escala aproximada, data) e seta de norte.
- Malha de coordenadas discreta enquadrada na folha, com rótulos pequenos.
- Trechos da OSE com rótulos padronizados, centralizados e alinhados à
  seta de fluxo: nome+OSE e material/DN acima; extensão e declividade
  abaixo.
- PVs com bloco de informações (N, E, CT, GI de chegada(s), GI de saída,
  profundidade — e vazões máximas na EEE), ligado por leader e
  ARRASTÁVEL com o mouse.
- Restante da rede (outras OSEs) em cinza, com PVs, nomes e informações
  em texto menor.
"""

from __future__ import annotations

import datetime as _dt
import math

from PySide6.QtCore import Qt, QPointF, QRectF
from PySide6.QtGui import (QBrush, QColor, QFont, QImage, QPageLayout,
                           QPageSize, QPainter, QPainterPath, QPdfWriter,
                           QPen, QPolygonF)
from PySide6.QtWidgets import (QComboBox, QFileDialog, QGraphicsItem,
                               QGraphicsItemGroup, QGraphicsLineItem,
                               QGraphicsScene, QGraphicsSimpleTextItem,
                               QGraphicsView, QHBoxLayout, QLabel,
                               QMessageBox, QPushButton, QVBoxLayout,
                               QWidget)

from ..core import fmt
from ..core.materials import find_material
from ..core.models import OseSheet, Project
from ..core.simulation import SimulationResult

_PIPE = QColor("#1f6fb2")
_GHOST = QColor(130, 138, 152, 150)
_TEXT = QColor("#1E2742")
_MUTED = QColor("#4a5470")
_GRID = QColor(60, 80, 120, 36)
_SHEET_RATIO = 1.41421356
NICE_SCALES = [100, 200, 250, 500, 750, 1000, 1250, 1500, 2000, 2500,
               5000, 7500, 10000, 20000]


class _CroquiView(QGraphicsView):
    def __init__(self, scene):
        super().__init__(scene)
        self.setRenderHint(QPainter.Antialiasing)
        self.setDragMode(QGraphicsView.ScrollHandDrag)
        self.setTransformationAnchor(QGraphicsView.AnchorUnderMouse)
        self.fit_requested = lambda: None

    def wheelEvent(self, event):
        factor = 1.15 if event.angleDelta().y() > 0 else 1 / 1.15
        self.scale(factor, factor)

    def mouseDoubleClickEvent(self, event):
        if event.button() == Qt.MiddleButton:
            self.fit_requested()
            event.accept()
            return
        super().mouseDoubleClickEvent(event)


class _InfoBlock(QGraphicsItemGroup):
    """Bloco de informações do PV: arrastável, com leader até o nó."""

    def __init__(self, anchor: QPointF, leader: QGraphicsLineItem,
                 on_moved=None):
        super().__init__()
        self.anchor = anchor
        self.leader = leader
        self.on_moved = on_moved
        self.setFlag(QGraphicsItem.ItemIsMovable)
        self.setFlag(QGraphicsItem.ItemIsSelectable)
        self.setFlag(QGraphicsItem.ItemSendsScenePositionChanges)
        self.setZValue(6)

    def update_leader(self):
        rect = self.sceneBoundingRect()
        # o leader chega no meio da borda mais próxima do nó
        target = QPointF(
            rect.left() if self.anchor.x() < rect.center().x()
            else rect.right(),
            min(max(self.anchor.y(), rect.top()), rect.bottom()))
        dist = math.hypot(target.x() - self.anchor.x(),
                          target.y() - self.anchor.y())
        self.leader.setVisible(dist > 6.0)
        self.leader.setLine(self.anchor.x(), self.anchor.y(),
                            target.x(), target.y())

    def itemChange(self, change, value):
        if change == QGraphicsItem.ItemScenePositionHasChanged:
            self.update_leader()
            if self.on_moved is not None:
                self.on_moved(self.pos())
        return super().itemChange(change, value)


class CroquiTab(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self._project: Project | None = None
        self._ose: OseSheet | None = None
        self._result: SimulationResult | None = None
        # deslocamento (arrastado pelo usuário) dos blocos, por id de nó
        self._block_offsets: dict[str, QPointF] = {}

        layout = QVBoxLayout(self)
        top = QHBoxLayout()
        top.addWidget(QLabel("OSE:"))
        self.ose_combo = QComboBox()
        self.ose_combo.setMinimumWidth(240)
        self.ose_combo.currentIndexChanged.connect(self._combo_changed)
        top.addWidget(self.ose_combo)
        top.addWidget(QLabel("Folha:"))
        self.paper_combo = QComboBox()
        self.paper_combo.addItems(["A3", "A4", "A2", "A1"])
        self.paper_combo.currentIndexChanged.connect(self._redraw)
        top.addWidget(self.paper_combo)
        self.header = QLabel("Crie/selecione uma OSE.")
        self.header.setWordWrap(True)
        font = self.header.font()
        font.setBold(True)
        self.header.setFont(font)
        top.addWidget(self.header, stretch=1)
        export_btn = QPushButton("Exportar croqui…")
        export_btn.clicked.connect(self._export)
        top.addWidget(export_btn)
        layout.addLayout(top)
        self.scene = QGraphicsScene()
        self.view = _CroquiView(self.scene)
        self.view.fit_requested = self._fit
        layout.addWidget(self.view, stretch=1)

    # ------------------------------------------------------------------
    def set_context(self, project: Project, result: SimulationResult | None,
                    current_ose: OseSheet | None = None):
        """Popula o seletor de OSEs e mostra a OSE atual (se houver)."""
        self._project, self._result = project, result
        self.ose_combo.blockSignals(True)
        self.ose_combo.clear()
        for ose in project.oses:
            label = f"OSE {ose.number}" if ose.number else "OSE (sem nº)"
            if ose.street:
                label += f" — {ose.street}"
            if ose.status == "cancelada":
                label += "  (CANCELADA)"
            self.ose_combo.addItem(label, ose.id)
        target = current_ose or (project.oses[0] if project.oses else None)
        if target is not None:
            idx = self.ose_combo.findData(target.id)
            self.ose_combo.setCurrentIndex(max(0, idx))
        self.ose_combo.blockSignals(False)
        self.show_ose(project, target, result)

    def _combo_changed(self, _index: int):
        if self._project is None:
            return
        ose_id = self.ose_combo.currentData()
        ose = next((o for o in self._project.oses if o.id == ose_id), None)
        self.show_ose(self._project, ose, self._result)

    def show_ose(self, project: Project, ose: OseSheet | None,
                 result: SimulationResult | None):
        self._project, self._ose, self._result = project, ose, result
        self._redraw()

    def _fit(self):
        rect = self.scene.sceneRect()
        if rect.isValid():
            self.view.fitInView(rect, Qt.KeepAspectRatio)

    # ------------------------------------------------ helpers de desenho
    def _text_item(self, text: str, size: float, color: QColor,
                   bold: bool = False) -> QGraphicsSimpleTextItem:
        item = QGraphicsSimpleTextItem(text)
        font = QFont()
        font.setPointSizeF(size)
        font.setBold(bold)
        item.setFont(font)
        item.setBrush(QBrush(color))
        return item

    def _rotated_centered(self, text: str, center: QPointF, angle: float,
                          size: float, color: QColor, bold: bool = False):
        """Texto rotacionado com o CENTRO no ponto dado."""
        item = self._text_item(text, size, color, bold)
        br = item.boundingRect()
        item.setTransformOriginPoint(br.center())
        item.setRotation(angle)
        item.setPos(center.x() - br.center().x(),
                    center.y() - br.center().y())
        self.scene.addItem(item)
        return item

    @staticmethod
    def _readable(angle_deg: float) -> float:
        if angle_deg > 90:
            return angle_deg - 180
        if angle_deg < -90:
            return angle_deg + 180
        return angle_deg

    # ------------------------------------------------------------ redraw
    def _redraw(self, *_):
        self.scene.clear()
        project, ose, result = self._project, self._ose, self._result
        if project is None or ose is None:
            self.header.setText("Crie/selecione uma OSE.")
            return
        disp = project.display
        city = ose.city or project.info.city
        status = "  —  CANCELADA" if ose.status == "cancelada" else ""
        self.header.setText(
            f"CROQUI — OSE {ose.number or 's/n'}{status}  |  "
            f"{ose.street or '(rua não informada)'}  |  {city}")

        pipe_ids = set(ose.pipe_ids)
        results = ({r.pipe: r for r in result.pipes} if result else {})

        # ---------------- fundo (arruamento) e curvas de nível
        bg_pen = QPen(QColor(120, 120, 120, 70), 0)
        bg_pen.setCosmetic(True)
        for line in project.background_lines:
            if len(line) < 2:
                continue
            path = QPainterPath(QPointF(line[0][0], -line[0][1]))
            for vertex in line[1:]:
                path.lineTo(vertex[0], -vertex[1])
            item = self.scene.addPath(path, bg_pen)
            item.setZValue(-6)
        for e, n, height, rotation, content in project.background_texts:
            label = self._text_item(str(content), max(0.5, float(height)),
                                    QColor(120, 120, 120, 120))
            label.setPos(float(e), -float(n) - float(height) * 1.4)
            if rotation:
                label.setRotation(-float(rotation))
            label.setZValue(-6)
            self.scene.addItem(label)
        terrain_pen = QPen(QColor(160, 120, 60, 60), 0)
        terrain_pen.setCosmetic(True)
        for line in project.terrain_lines:
            if len(line) < 2:
                continue
            path = QPainterPath(QPointF(line[0][0], -line[0][1]))
            for vertex in line[1:]:
                path.lineTo(vertex[0], -vertex[1])
            item = self.scene.addPath(path, terrain_pen)
            item.setZValue(-5)

        # ---------------- trechos e nós
        selected_nodes: set[str] = set()
        ghost_nodes: set[str] = set()
        for pipe in project.pipes:
            selected = pipe.id in pipe_ids
            up = project.node_by_name(pipe.upstream)
            down = project.node_by_name(pipe.downstream)
            if not (up and down):
                continue
            (selected_nodes if selected else ghost_nodes).update(
                (up.name, down.name))
            self._draw_pipe(project, pipe, up, down, results, ose,
                            selected, disp)
        ghost_nodes -= selected_nodes

        for name in selected_nodes:
            self._draw_node(project, name, results, disp, ghost=False)
        for name in ghost_nodes:
            self._draw_node(project, name, results, disp, ghost=True)

        # ---------------- folha, malha, norte e carimbo
        sheet = self._draw_sheet()
        self.scene.setSceneRect(sheet)
        self._fit()

    # ------------------------------------------------------------ trecho
    def _draw_pipe(self, project, pipe, up, down, results, ose,
                   selected, disp):
        x1, y1 = up.coord_e, -up.coord_n
        x2, y2 = down.coord_e, -down.coord_n
        color = _PIPE if selected else _GHOST
        width = 2.0 if selected else 1.0
        self.scene.addLine(x1, y1, x2, y2, QPen(color, width))
        ang = math.atan2(y2 - y1, x2 - x1)
        # seta de fluxo no meio do vão
        ax, ay = (x1 + x2) / 2, (y1 + y2) / 2
        size = 6.0 if selected else 4.0
        poly = QPolygonF([
            QPointF(ax + size * 0.6 * math.cos(ang),
                    ay + size * 0.6 * math.sin(ang)),
            QPointF(ax - size * math.cos(ang - 0.45),
                    ay - size * math.sin(ang - 0.45)),
            QPointF(ax - size * math.cos(ang + 0.45),
                    ay - size * math.sin(ang + 0.45))])
        self.scene.addPolygon(poly, QPen(Qt.NoPen), QBrush(color))

        # rótulos padronizados, centralizados na seta de fluxo:
        #   acima: "T1 - OSE001" e "Material DN"
        #   abaixo: "L = xxx,xx m" e "i = 0,xxxxx m/m"
        r = results.get(pipe.name)
        mat = find_material(project.catalog,
                            pipe.material or project.options.default_material)
        mat_name = mat.name.split("(")[0].strip() if mat else ""
        dn = (r.diameter_mm if r else pipe.diameter_mm) or ""
        ose_of_pipe = ose if selected else self._ose_of(pipe.id)
        ose_tag = (f"OSE{ose_of_pipe.number}" if ose_of_pipe
                   and ose_of_pipe.number else "")
        line_a1 = f"{pipe.name}" + (f" - {ose_tag}" if ose_tag else "")
        line_a2 = f"{mat_name}" + (f"  DN {dn}" if dn else "")
        length = r.length if r else project.pipe_length(pipe)
        line_b1 = f"L = {fmt.fmt(length, 2)} m"
        line_b2 = (f"i = {fmt.fmt(r.slope, disp.slope_decimals)} m/m"
                   if r else "")

        deg = self._readable(math.degrees(ang))
        # perpendicular apontando para "cima" na tela
        ux, uy = math.cos(ang), math.sin(ang)
        px, py = -uy, ux
        if py > 0:
            px, py = -px, -py
        size_t = 3.4 if selected else 2.2
        color_t = _TEXT if selected else _GHOST
        gap = size_t * 1.7
        anchor = QPointF(ax, ay)

        def place(text, row, bold=False):
            if not text.strip():
                return
            center = QPointF(anchor.x() + px * gap * row,
                             anchor.y() + py * gap * row)
            self._rotated_centered(text, center, deg, size_t, color_t,
                                   bold=bold and selected)
        place(line_a1, 2.6, bold=True)
        place(line_a2, 1.4)
        place(line_b1, -1.4)
        place(line_b2, -2.6)

    def _ose_of(self, pipe_id: str):
        if self._project is None:
            return None
        for ose in self._project.oses:
            if pipe_id in ose.pipe_ids:
                return ose
        return None

    # -------------------------------------------------------------- nó
    def _draw_node(self, project, name, results, disp, ghost):
        node = project.node_by_name(name)
        if node is None:
            return
        x, y = node.coord_e, -node.coord_n
        scale_f = 1.0 if not ghost else 0.65
        color = QColor("#222222") if not ghost else _GHOST
        path = QPainterPath()
        r = 4.0 * scale_f
        if node.node_type == "EEE":
            path.moveTo(x, y - 1.35 * r)
            path.lineTo(x + 1.25 * r, y + r)
            path.lineTo(x - 1.25 * r, y + r)
            path.closeSubpath()
        else:
            path.addEllipse(x - r, y - r, 2 * r, 2 * r)
        item = self.scene.addPath(path, QPen(color, 1.0 * scale_f),
                                  QBrush(Qt.white if not ghost
                                         else QColor(245, 245, 245)))
        item.setZValue(2)

        # nome do nó
        name_item = self._text_item(node.name, 4.5 * scale_f,
                                    _TEXT if not ghost else _GHOST,
                                    bold=not ghost)
        name_item.setPos(x + r * 1.2, y - r * 2.8)
        name_item.setZValue(3)
        self.scene.addItem(name_item)

        # bloco de informações
        lines = [
            f"N: {fmt.fmt(node.coord_n, disp.coord_decimals)}",
            f"E: {fmt.fmt(node.coord_e, disp.coord_decimals)}",
        ]
        if node.ground_elev:
            lines.append(
                f"CT: {fmt.fmt(node.ground_elev, disp.elev_decimals)}")
        display_name = node.name
        if self._result is not None:
            display_name = self._result.renamed.get(node.name, node.name)
        arrivals = [rr for rr in results.values()
                    if rr.downstream == display_name]
        outlets = [rr for rr in results.values()
                   if rr.upstream == display_name]
        if node.node_type == "EEE" and arrivals:
            q_ini = sum(rr.q_down_start for rr in arrivals)
            q_fim = sum(rr.q_down_end for rr in arrivals)
            lines.append(f"Q máx: {fmt.fmt(q_ini, disp.flow_decimals)} / "
                         f"{fmt.fmt(q_fim, disp.flow_decimals)} l/s")
        for rr in arrivals:
            lines.append(f"GI ch. {rr.pipe}: "
                         f"{fmt.fmt(rr.invert_down, disp.elev_decimals)}")
        for rr in outlets:
            lines.append(f"GI sa. {rr.pipe}: "
                         f"{fmt.fmt(rr.invert_up, disp.elev_decimals)}")
        depths = ([rr.depth_down for rr in arrivals]
                  + [rr.depth_up for rr in outlets])
        if depths:
            lines.append(
                f"Prof.: {fmt.fmt(max(depths), disp.depth_decimals)} m")

        if ghost:
            # informações estáticas, pequenas e em cinza
            ty = y + 2.0
            for line in lines:
                sub = self._text_item(line, 2.2, _GHOST)
                sub.setPos(x + r * 1.4, ty)
                sub.setZValue(2)
                self.scene.addItem(sub)
                ty += 3.2
            return

        # bloco arrastável com leader (afastado do PV e das tubulações)
        leader = QGraphicsLineItem()
        leader_pen = QPen(_MUTED, 0.5)
        leader.setPen(leader_pen)
        leader.setZValue(4)
        self.scene.addItem(leader)
        block = _InfoBlock(
            QPointF(x, y), leader,
            on_moved=lambda pos, nid=node.id:
                self._block_offsets.__setitem__(
                    nid, QPointF(pos.x() - x, pos.y() - y)))
        ty = 0.0
        for line in lines:
            sub = self._text_item(line, 3.0, _MUTED)
            sub.setPos(0.0, ty)
            block.addToGroup(sub)
            ty += 4.4
        offset = self._block_offsets.get(node.id, QPointF(r + 8.0, 1.0))
        self.scene.addItem(block)
        block.setPos(x + offset.x(), y + offset.y())
        block.update_leader()

    # ------------------------------------------- folha, malha e carimbo
    def _draw_sheet(self) -> QRectF:
        raw = self.scene.itemsBoundingRect()
        # a folga do conteúdo escala com o tamanho da rede: em redes
        # grandes, a margem fixa deixava o carimbo sobre o desenho
        est_w = max(raw.width(), raw.height() * _SHEET_RATIO, 200.0)
        pad = max(25.0, est_w * 0.02)
        bounds = raw.adjusted(-pad, -pad, pad, pad)
        carimbo_h = max(30.0, bounds.height() * 0.14)
        gap = carimbo_h * 0.35 + pad     # respiro entre desenho e carimbo
        need_w, need_h = bounds.width(), bounds.height() + carimbo_h + gap
        if need_w / need_h >= _SHEET_RATIO:
            W, H = need_w, need_w / _SHEET_RATIO
        else:
            H, W = need_h, need_h * _SHEET_RATIO
        frame = QRectF(
            bounds.center().x() - W / 2,
            bounds.top() - (H - carimbo_h - gap - bounds.height()) / 2,
            W, H)
        pen = QPen(QColor("#333333"), 0)
        pen.setCosmetic(True)
        # papel branco atrás de tudo
        paper = self.scene.addRect(frame, pen, QBrush(Qt.white))
        paper.setZValue(-10)
        inner = frame.adjusted(W * 0.012, W * 0.012, -W * 0.012, -W * 0.012)
        self.scene.addRect(inner, pen)

        # escala aproximada: conteúdo (m) sobre a área útil do papel (mm)
        paper_mm = {"A4": 297.0, "A3": 420.0, "A2": 594.0,
                    "A1": 841.0}[self.paper_combo.currentText()]
        raw = W * 1000.0 / (paper_mm * 0.96)
        scale = next((s for s in NICE_SCALES if s >= raw), NICE_SCALES[-1])

        # malha de coordenadas enquadrada na folha, discreta
        grid_pen = QPen(_GRID, 0)
        grid_pen.setCosmetic(True)
        step = max(scale * 0.05, 10.0)          # ~5 cm de papel
        nice_steps = [10, 20, 25, 50, 100, 200, 250, 500, 1000]
        step = next((s for s in nice_steps if s >= step), nice_steps[-1])
        content = inner.adjusted(0, 0, 0, -carimbo_h)
        e0 = math.floor(content.left() / step) * step
        while e0 < content.right():
            if e0 > content.left():
                self.scene.addLine(e0, content.top(), e0, content.bottom(),
                                   grid_pen)
                lbl = self._text_item(f"E {fmt.fmt(e0, 0)}", W * 0.006,
                                      QColor(60, 80, 120, 110))
                lbl.setPos(e0 + 1, content.top() + 1)
                self.scene.addItem(lbl)
            e0 += step
        n0 = math.floor(content.top() / step) * step
        while n0 < content.bottom():
            if n0 > content.top():
                self.scene.addLine(content.left(), n0, content.right(), n0,
                                   grid_pen)
                lbl = self._text_item(f"N {fmt.fmt(-n0, 0)}", W * 0.006,
                                      QColor(60, 80, 120, 110))
                lbl.setPos(content.left() + 1, n0 + 1)
                self.scene.addItem(lbl)
            n0 += step

        # seta de norte (canto superior direito)
        nx = content.right() - W * 0.035
        ny = content.top() + W * 0.045
        h = W * 0.028
        arrow = QPolygonF([QPointF(nx, ny - h),
                           QPointF(nx - h * 0.35, ny + h * 0.45),
                           QPointF(nx, ny + h * 0.15),
                           QPointF(nx + h * 0.35, ny + h * 0.45)])
        self.scene.addPolygon(arrow, QPen(QColor("#333333"), 0),
                              QBrush(QColor("#333333")))
        n_lbl = self._text_item("N", W * 0.012, _TEXT, bold=True)
        br = n_lbl.boundingRect()
        n_lbl.setPos(nx - br.width() / 2, ny - h - br.height() - 1)
        self.scene.addItem(n_lbl)

        # carimbo (acima de tudo: nada do desenho pode ficar por cima)
        box = QRectF(inner.left(), inner.bottom() - carimbo_h,
                     inner.width(), carimbo_h)
        box_item = self.scene.addRect(box, pen, QBrush(Qt.white))
        box_item.setZValue(9)
        cols = [0.0, 0.30, 0.58, 0.80, 1.0]
        for c in cols[1:-1]:
            xline = box.left() + box.width() * c
            line_item = self.scene.addLine(xline, box.top(), xline,
                                           box.bottom(), pen)
            line_item.setZValue(10)
        project, ose = self._project, self._ose
        info = project.info
        pad = box.height() * 0.12
        base = W * 0.009

        def cell(col, lines, big_first=True):
            cx0 = box.left() + box.width() * cols[col] + pad
            ty = box.top() + pad
            for k, text in enumerate(lines):
                if not text:
                    continue
                size = base * (1.25 if (k == 0 and big_first) else 0.95)
                item = self._text_item(text, size, _TEXT,
                                       bold=(k == 0 and big_first))
                item.setPos(cx0, ty)
                item.setZValue(10)
                self.scene.addItem(item)
                ty += size * 2.0

        # mini-logo: gota no carimbo
        drop = QPainterPath(QPointF(0, -1.0))
        drop.cubicTo(QPointF(0.75, 0.1), QPointF(0.75, 0.85),
                     QPointF(0, 1.0))
        drop.cubicTo(QPointF(-0.75, 0.85), QPointF(-0.75, 0.1),
                     QPointF(0, -1.0))
        s = box.height() * 0.28
        drop_item = self.scene.addPath(
            drop, QPen(QColor("#1B2B5B"), 0.12),
            QBrush(QColor("#2FB8A9")))
        drop_item.setScale(s)
        drop_item.setZValue(10)
        drop_item.setPos(box.left() + pad + s,
                         box.top() + box.height() * 0.42)
        cell_x0 = box.left() + pad + s * 2.6
        item = self._text_item("PASTRO ENGENHARIA", base * 1.25, _TEXT,
                               bold=True)
        item.setPos(cell_x0, box.top() + pad)
        item.setZValue(10)
        self.scene.addItem(item)
        if info.designer:
            item = self._text_item(info.designer, base * 0.95, _TEXT)
            item.setPos(cell_x0, box.top() + pad + base * 2.6)
            item.setZValue(10)
            self.scene.addItem(item)

        cell(1, [project.title, info.system, ose.city or info.city],
             big_first=False)
        cell(2, [f"CROQUI — OSE {ose.number or 's/n'}",
                 ose.street, f"Escala aprox. 1:{scale}"])
        cell(3, [f"Formato {self.paper_combo.currentText()}",
                 f"Data: {_dt.date.today().strftime('%d/%m/%Y')}",
                 "Folha 2"])
        return frame

    # ------------------------------------------------------------------
    def _export(self):
        if self._ose is None:
            QMessageBox.information(self, "Croqui",
                                    "Selecione uma OSE primeiro.")
            return
        path, _ = QFileDialog.getSaveFileName(
            self, "Exportar croqui", f"croqui_ose_{self._ose.number}.pdf",
            "PDF (*.pdf);;Imagem PNG (*.png)")
        if not path:
            return
        rect = self.scene.sceneRect()
        if path.lower().endswith(".png"):
            image = QImage(int(rect.width() * 4), int(rect.height() * 4),
                           QImage.Format_ARGB32)
            image.fill(Qt.white)
            painter = QPainter(image)
            painter.setRenderHint(QPainter.Antialiasing)
            self.scene.render(painter, QRectF(image.rect()), rect)
            painter.end()
            image.save(path)
        else:
            writer = QPdfWriter(path)
            size = {"A4": QPageSize.A4, "A3": QPageSize.A3,
                    "A2": QPageSize.A2,
                    "A1": QPageSize.A1}[self.paper_combo.currentText()]
            writer.setPageSize(QPageSize(size))
            writer.setPageOrientation(QPageLayout.Landscape)
            writer.setResolution(300)
            painter = QPainter(writer)
            painter.setRenderHint(QPainter.Antialiasing)
            page = QRectF(0, 0, writer.width(), writer.height())
            ratio = min(page.width() / rect.width(),
                        page.height() / rect.height())
            target = QRectF(0, 0, rect.width() * ratio,
                            rect.height() * ratio)
            target.moveCenter(page.center())
            self.scene.render(painter, target, rect)
            painter.end()
        QMessageBox.information(self, "Croqui", f"Croqui exportado:\n{path}")
