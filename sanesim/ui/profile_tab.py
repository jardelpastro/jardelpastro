"""Aba Perfil: perfil longitudinal com lâmina d'água, grid e bandas.

Sempre de montante (esquerda) para jusante (direita). Escalas de desenho
independentes (padrão H 1:1000, V 1:100), grid com linhas mestras (100 m
na horizontal, 5 m na vertical) e secundárias mais fracas, e bandas de
dados sob o perfil (estilo Civil 3D) com ticks a cada estaca de 20 m,
textos centralizados e tratamento de sobreposição.
"""

from __future__ import annotations

from PySide6.QtCore import Qt, QPointF
from PySide6.QtGui import QBrush, QColor, QFont, QPainter, QPen, QPolygonF
from PySide6.QtWidgets import (QComboBox, QFormLayout, QGraphicsScene,
                               QGraphicsSimpleTextItem, QGraphicsView,
                               QHBoxLayout, QLabel, QSpinBox, QVBoxLayout,
                               QWidget)

from ..core import fmt
from ..core.models import Project
from ..core.profile import (ProfilePath, ProfileSegment, build_geometry,
                            build_ose_paths, build_paths)
from ..core.simulation import SimulationResult

_GROUND = QColor("#8a5a2b")
_PIPE = QColor("#222222")
_WATER = QColor(41, 128, 185, 150)
_PV = QColor("#777777")
_TEXT = QColor("#333333")
_GRID_MASTER = QColor(120, 120, 120, 90)
_GRID_MINOR = QColor(150, 150, 150, 45)
_BAND_FRAME = QColor(90, 90, 90)

STATION_STEP = 20.0     # passo das bandas de cotas (m)
GRID_MINOR_H = 20.0     # grid secundário horizontal (m de distância)
GRID_MASTER_H = 100.0   # grid mestre horizontal
GRID_MINOR_V = 1.0      # grid secundário vertical (m de cota)
GRID_MASTER_V = 5.0     # grid mestre vertical
BANDS_GAP = 48.0        # afastamento entre o gráfico e as bandas (px)
TICK = 5.0              # comprimento dos ticks das bandas (px)


class _ProfileView(QGraphicsView):
    def __init__(self, scene):
        super().__init__(scene)
        self.setRenderHint(QPainter.Antialiasing)
        self.setDragMode(QGraphicsView.ScrollHandDrag)
        self.user_zoomed = False

    def wheelEvent(self, event):
        self.user_zoomed = True
        factor = 1.15 if event.angleDelta().y() > 0 else 1 / 1.15
        self.scale(factor, factor)

    def fit_scene(self):
        rect = self.scene().sceneRect()
        if rect.isValid():
            self.fitInView(rect, Qt.KeepAspectRatio)

    def resizeEvent(self, event):
        super().resizeEvent(event)
        if not self.user_zoomed:
            self.fit_scene()

    def showEvent(self, event):
        super().showEvent(event)
        if not self.user_zoomed:
            self.fit_scene()


class ProfileTab(QWidget):
    PX_PER_MM = 4.0     # resolução do desenho (px por mm de papel)

    def __init__(self, parent=None):
        super().__init__(parent)
        self._result: SimulationResult | None = None
        self._project: Project | None = None
        self._paths: list[ProfilePath] = []

        layout = QVBoxLayout(self)
        controls = QHBoxLayout()
        controls.addWidget(QLabel("Caminho (montante → jusante):"))
        self.path_combo = QComboBox()
        self.path_combo.currentIndexChanged.connect(self._redraw)
        controls.addWidget(self.path_combo, stretch=1)

        scales = QFormLayout()
        scales.setContentsMargins(0, 0, 0, 0)
        self.scale_h = QSpinBox()
        self.scale_h.setRange(50, 100000)
        self.scale_h.setValue(1000)
        self.scale_h.setSingleStep(250)
        self.scale_h.setPrefix("1:")
        self.scale_h.valueChanged.connect(self._redraw)
        self.scale_v = QSpinBox()
        self.scale_v.setRange(10, 10000)
        self.scale_v.setValue(100)
        self.scale_v.setSingleStep(25)
        self.scale_v.setPrefix("1:")
        self.scale_v.valueChanged.connect(self._redraw)
        scales.addRow("Escala horizontal:", self.scale_h)
        scales.addRow("Escala vertical:", self.scale_v)
        controls.addLayout(scales)
        layout.addLayout(controls)

        self.hint = QLabel("Rode a simulação para desenhar o perfil. "
                           "Azul = lâmina d'água calculada (fim de plano). "
                           "Roda do mouse = zoom; arrastar = mover.")
        self.hint.setWordWrap(True)
        layout.addWidget(self.hint)

        self.scene = QGraphicsScene()
        self.view = _ProfileView(self.scene)
        layout.addWidget(self.view, stretch=1)

    # ------------------------------------------------------------------
    def show_result(self, project: Project, result: SimulationResult):
        self._project = project
        self._result = result
        self._paths = build_ose_paths(project, result) + build_paths(result)
        self.path_combo.blockSignals(True)
        self.path_combo.clear()
        for path in self._paths:
            self.path_combo.addItem(path.label)
        self.path_combo.blockSignals(False)
        if self._paths:
            self.path_combo.setCurrentIndex(0)
        self._redraw()

    # ---------------------------------------------------------- helpers
    def _make_text(self, text: str, size: float,
                   bold: bool = False) -> QGraphicsSimpleTextItem:
        item = QGraphicsSimpleTextItem(text)
        font = QFont()
        font.setPointSizeF(size)
        font.setBold(bold)
        item.setFont(font)
        item.setBrush(QBrush(_TEXT))
        return item

    def _text(self, text: str, x: float, y: float, size: float = 8,
              bold: bool = False, center_x: bool = False,
              center_y: bool = False) -> QGraphicsSimpleTextItem:
        item = self._make_text(text, size, bold)
        br = item.boundingRect()
        px = x - br.width() / 2.0 if center_x else x
        py = y - br.height() / 2.0 if center_y else y
        item.setPos(px, py)
        self.scene.addItem(item)
        return item

    def _rotated_texts(self, entries, X, y0: float, y1: float,
                       size: float = 6.5):
        """Textos verticais centralizados na banda, sem sobreposição.

        entries: lista de (x_m, texto, âncora) ordenada por x, âncora em
        {"center", "left", "right"} — "left" coloca o texto para dentro
        (à esquerda da linha), usado no fechamento do perfil.
        """
        placed = []
        for x_m, text, anchor in entries:
            item = self._make_text(text, size)
            item.setRotation(-90)
            br = item.boundingRect()
            h = br.height()          # extensão horizontal após a rotação
            if anchor == "left":
                left = X(x_m) - h - 2.0
            elif anchor == "right":
                left = X(x_m) + 2.0
            else:
                left = X(x_m) - h / 2.0
            placed.append([left, h, item, br])
        # afasta sobreposições: o da esquerda vai mais para a esquerda e
        # o da direita mais para a direita
        for _ in range(6):
            moved = False
            for a, b in zip(placed, placed[1:]):
                overlap = (a[0] + a[1] + 1.5) - b[0]
                if overlap > 0:
                    a[0] -= overlap / 2.0
                    b[0] += overlap / 2.0
                    moved = True
            if not moved:
                break
        mid = (y0 + y1) / 2.0
        for left, _h, item, br in placed:
            item.setPos(left, mid + br.width() / 2.0)
            self.scene.addItem(item)

    @staticmethod
    def _interp(segments: list[ProfileSegment], x: float):
        """(terreno, geratriz inferior) interpolados na posição x."""
        for s in segments:
            if s.x0 - 1e-6 <= x <= s.x1 + 1e-6 and s.x1 > s.x0:
                f = (x - s.x0) / (s.x1 - s.x0)
                return (s.ground0 + (s.ground1 - s.ground0) * f,
                        s.invert0 + (s.invert1 - s.invert0) * f)
        s = segments[-1]
        return s.ground1, s.invert1

    def _stations(self, total: float) -> list[float]:
        xs = []
        x = 0.0
        while x <= total + 1e-6:
            xs.append(min(x, total))
            x += STATION_STEP
        return xs

    def _pv_xs(self, segments) -> list[float]:
        xs = [s.x0 for s in segments]
        xs.append(segments[-1].x1)
        return xs

    # ------------------------------------------------------------ redraw
    def _redraw(self, *_):
        self.scene.clear()
        idx = self.path_combo.currentIndex()
        if not self._paths or idx < 0 or idx >= len(self._paths):
            return
        path = self._paths[idx]
        segments = build_geometry(path)
        if not segments:
            return

        sx = self.PX_PER_MM * 1000.0 / self.scale_h.value()
        sy = self.PX_PER_MM * 1000.0 / self.scale_v.value()
        total = path.length

        elev_top = max(max(s.ground0, s.ground1) for s in segments)
        elev_bot = min(min(s.invert0, s.invert1) for s in segments)
        grid_top = (int(elev_top / GRID_MASTER_V) + 1) * GRID_MASTER_V
        grid_bot = int(elev_bot / GRID_MASTER_V) * GRID_MASTER_V
        if grid_bot > elev_bot - 0.5:
            grid_bot -= GRID_MASTER_V

        def X(x):
            return x * sx

        def Y(elev):
            return (grid_top - elev) * sy

        y_grid_top = Y(grid_top)
        y_grid_bot = Y(grid_bot)

        # ---------------------------------------------------------- grid
        pen_minor = QPen(_GRID_MINOR, 0)
        pen_minor.setCosmetic(True)
        pen_minor.setStyle(Qt.DashLine)
        pen_master = QPen(_GRID_MASTER, 0)
        pen_master.setCosmetic(True)
        pen_border = QPen(_BAND_FRAME, 0)
        pen_border.setCosmetic(True)

        e = grid_bot
        while e <= grid_top + 1e-6:
            master = abs(e / GRID_MASTER_V - round(e / GRID_MASTER_V)) < 1e-6
            self.scene.addLine(X(0), Y(e), X(total), Y(e),
                               pen_master if master else pen_minor)
            if master:
                item = self._make_text(fmt.fmt(e, 2), 7)
                br = item.boundingRect()
                item.setPos(X(0) - br.width() - 8, Y(e) - br.height() / 2)
                self.scene.addItem(item)
                item = self._make_text(fmt.fmt(e, 2), 7)
                item.setPos(X(total) + 8, Y(e) - item.boundingRect().height() / 2)
                self.scene.addItem(item)
            e += GRID_MINOR_V
        x = 0.0
        while x <= total + 1e-6:
            master = abs(x / GRID_MASTER_H - round(x / GRID_MASTER_H)) < 1e-6
            self.scene.addLine(X(x), y_grid_top, X(x), y_grid_bot,
                               pen_master if master else pen_minor)
            if master:
                self._text(fmt.fmt(x, 0), X(x), y_grid_top - 14,
                           size=7, center_x=True)
            x += GRID_MINOR_H
        # fechamento do gráfico nas duas extremidades (esquerda e direita)
        self.scene.addLine(X(0), y_grid_top, X(0), y_grid_bot, pen_border)
        self.scene.addLine(X(total), y_grid_top, X(total), y_grid_bot,
                           pen_border)

        # ------------------------------------------------------- perfil
        pen_ground = QPen(_GROUND, 2)
        pen_ground.setCosmetic(True)
        pen_pipe = QPen(_PIPE, 1.5)
        pen_pipe.setCosmetic(True)

        for s in segments:
            water = QPolygonF([
                QPointF(X(s.x0), Y(s.water0)),
                QPointF(X(s.x1), Y(s.water1)),
                QPointF(X(s.x1), Y(s.invert1)),
                QPointF(X(s.x0), Y(s.invert0)),
            ])
            self.scene.addPolygon(water, QPen(Qt.NoPen), QBrush(_WATER))
            self.scene.addLine(X(s.x0), Y(s.invert0), X(s.x1), Y(s.invert1),
                               pen_pipe)
            self.scene.addLine(X(s.x0), Y(s.crown0), X(s.x1), Y(s.crown1),
                               pen_pipe)
            self.scene.addLine(X(s.x0), Y(s.ground0), X(s.x1), Y(s.ground1),
                               pen_ground)

        pv_positions = [(s.x0, s.ground0, s.pipe.upstream) for s in segments]
        pv_positions.append((segments[-1].x1, segments[-1].ground1,
                             segments[-1].pipe.downstream))
        for x_pv, ground, name in pv_positions:
            self._text(name, X(x_pv), Y(ground) - 16, size=8, bold=True,
                       center_x=True)

        # ------------------------------------------- eixo X e bandas
        cx = X(total) / 2
        self._text("Distância (m)", cx, y_grid_bot + BANDS_GAP / 2,
                   size=8, bold=True, center_x=True, center_y=True)

        band_top = y_grid_bot + BANDS_GAP
        band_defs = [
            ("Distâncias (m)", 62, self._band_distances),
            ("Cota terreno (m)", 56, self._band_ground),
            ("Cota coletor GI (m)", 56, self._band_invert),
            ("Profundidade (m)", 56, self._band_depth),
            ("Declividade (m/m)", 24, self._band_slope),
            ("Material / Vazão", 24, self._band_material),
        ]
        stations = self._stations(total)
        y0 = band_top
        for label, height, renderer in band_defs:
            y1 = y0 + height
            self.scene.addRect(X(0), y0, X(total), height, pen_border)
            item = self._make_text(label, 7, bold=True)
            br = item.boundingRect()
            item.setPos(X(0) - br.width() - 10,
                        (y0 + y1) / 2 - br.height() / 2)
            self.scene.addItem(item)
            # ticks nas estacas de 20 em 20 m (topo e base da banda)
            for x_st in stations:
                self.scene.addLine(X(x_st), y0, X(x_st), y0 + TICK,
                                   pen_border)
                self.scene.addLine(X(x_st), y1 - TICK, X(x_st), y1,
                                   pen_border)
            renderer(segments, X, y0, y1, total)
            y0 = y1
        bands_bottom = y0

        # linhas de chamada dos PVs (atravessam perfil e bandas)
        pen_pv = QPen(_PV, 0, Qt.DashLine)
        pen_pv.setCosmetic(True)
        for x_pv, ground, _name in pv_positions:
            self.scene.addLine(X(x_pv), Y(ground), X(x_pv), bands_bottom,
                               pen_pv)

        # ------------------------------------------------ títulos e eixos
        self._text(f"PERFIL — {path.label}", cx, y_grid_top - 64,
                   size=13, bold=True, center_x=True)
        self._text(f"Escala horizontal 1:{self.scale_h.value()} — "
                   f"vertical 1:{self.scale_v.value()}",
                   cx, y_grid_top - 40, size=8, center_x=True)
        for x_axis, offset in ((X(0), -84.0), (X(total), 66.0)):
            item = self._make_text("Cota (m)", 8, bold=True)
            item.setRotation(-90)
            br = item.boundingRect()
            item.setPos(x_axis + offset,
                        (y_grid_top + y_grid_bot) / 2 + br.width() / 2)
            self.scene.addItem(item)

        rect = self.scene.itemsBoundingRect().adjusted(-30, -20, 30, 20)
        self.scene.setSceneRect(rect)
        self.view.user_zoomed = False
        self.view.fit_scene()

    # -------------------------------------------------- conteúdo das bandas
    def _band_distances(self, segments, X, y0, y1, total):
        # distância entre PVs: horizontal, centralizada no vão e na banda
        for s in segments:
            self._text(fmt.fmt(s.x1 - s.x0, 2), X((s.x0 + s.x1) / 2),
                       (y0 + y1) / 2, size=7, center_x=True, center_y=True)
        # distância acumulada: vertical, no alinhamento de cada PV; o
        # último texto vai para dentro (à esquerda da linha de fechamento)
        pv_xs = self._pv_xs(segments)
        entries = []
        for i, x_pv in enumerate(pv_xs):
            anchor = ("right" if i == 0
                      else "left" if i == len(pv_xs) - 1 else "center")
            entries.append((x_pv, fmt.fmt(x_pv, 2), anchor))
        self._rotated_texts(entries, X, y0, y1)

    def _values_band(self, segments, X, y0, y1, total, value_fn):
        pv_xs = self._pv_xs(segments)
        entries = []
        for x in self._stations(total):
            if any(abs(x - x_pv) < 6.0 for x_pv in pv_xs):
                continue
            entries.append((x, fmt.fmt(value_fn(x), 3), "center"))
        for i, x_pv in enumerate(pv_xs):
            anchor = ("right" if i == 0
                      else "left" if i == len(pv_xs) - 1 else "center")
            entries.append((x_pv, fmt.fmt(value_fn(x_pv), 3), anchor))
        entries.sort(key=lambda t: t[0])
        self._rotated_texts(entries, X, y0, y1)

    def _band_ground(self, segments, X, y0, y1, total):
        self._values_band(segments, X, y0, y1, total,
                          lambda x: self._interp(segments, x)[0])

    def _band_invert(self, segments, X, y0, y1, total):
        self._values_band(segments, X, y0, y1, total,
                          lambda x: self._interp(segments, x)[1])

    def _band_depth(self, segments, X, y0, y1, total):
        def depth(x):
            ground, invert = self._interp(segments, x)
            return ground - invert
        self._values_band(segments, X, y0, y1, total, depth)

    def _band_slope(self, segments, X, y0, y1, total):
        for s in segments:
            self._text(f"I = {fmt.fmt(s.pipe.slope, 4)}",
                       X((s.x0 + s.x1) / 2), (y0 + y1) / 2,
                       size=7, center_x=True, center_y=True)

    def _band_material(self, segments, X, y0, y1, total):
        for s in segments:
            r = s.pipe
            mat = r.material.split("(")[0].strip()
            self._text(f"{mat}  DN {r.diameter_mm} — "
                       f"Qf = {fmt.fmt(r.q_down_end, 2)} l/s",
                       X((s.x0 + s.x1) / 2), (y0 + y1) / 2,
                       size=6.5, center_x=True, center_y=True)
