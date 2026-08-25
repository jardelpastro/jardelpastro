"""Aba Perfil: desenho do perfil longitudinal com lâmina d'água.

Sempre de montante (esquerda) para jusante (direita). Mostra terreno,
tubo (geratriz inferior e superior), a lâmina calculada de fim de plano
preenchida em azul dentro do tubo, PVs com cotas e rótulos por trecho.
"""

from __future__ import annotations

from PySide6.QtCore import Qt, QPointF
from PySide6.QtGui import QBrush, QColor, QFont, QPainter, QPen, QPolygonF
from PySide6.QtWidgets import (QComboBox, QDoubleSpinBox, QGraphicsScene,
                               QGraphicsSimpleTextItem, QGraphicsView,
                               QHBoxLayout, QLabel, QVBoxLayout, QWidget)

from ..core import fmt
from ..core.models import Project
from ..core.profile import (ProfilePath, build_geometry, build_ose_paths,
                            build_paths)
from ..core.simulation import SimulationResult

_GROUND = QColor("#8a5a2b")
_PIPE = QColor("#222222")
_WATER = QColor(41, 128, 185, 150)
_PV = QColor("#555555")
_TEXT = QColor("#333333")


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
    SX = 4.0        # px por metro (horizontal)

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
        controls.addWidget(QLabel("Exagero vertical:"))
        self.exaggeration = QDoubleSpinBox()
        self.exaggeration.setRange(1.0, 50.0)
        self.exaggeration.setValue(10.0)
        self.exaggeration.setSingleStep(1.0)
        self.exaggeration.valueChanged.connect(self._redraw)
        controls.addWidget(self.exaggeration)
        layout.addLayout(controls)

        self.hint = QLabel("Rode a simulação para desenhar o perfil. "
                           "Azul = lâmina d'água calculada (fim de plano). "
                           "Use a roda do mouse para zoom e arraste para "
                           "mover.")
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

    # ------------------------------------------------------------------
    def _text(self, text: str, x: float, y: float, size: int = 8,
              bold: bool = False, angle: float = 0.0):
        item = QGraphicsSimpleTextItem(text)
        font = QFont()
        font.setPointSize(size)
        font.setBold(bold)
        item.setFont(font)
        item.setBrush(QBrush(_TEXT))
        item.setPos(x, y)
        if angle:
            item.setRotation(angle)
        self.scene.addItem(item)
        return item

    def _redraw(self, *_):
        self.scene.clear()
        idx = self.path_combo.currentIndex()
        if not self._paths or idx < 0 or idx >= len(self._paths):
            return
        path = self._paths[idx]
        segments = build_geometry(path)
        if not segments:
            return
        ex = self.exaggeration.value()
        sx = self.SX
        sy = sx * ex

        elev_max = max(max(s.ground0, s.ground1) for s in segments)

        def X(x):
            return x * sx

        def Y(elev):
            return (elev_max - elev) * sy

        pen_ground = QPen(_GROUND, 2)
        pen_ground.setCosmetic(True)
        pen_pipe = QPen(_PIPE, 1.5)
        pen_pipe.setCosmetic(True)
        pen_pv = QPen(_PV, 1, Qt.DashLine)
        pen_pv.setCosmetic(True)

        for s in segments:
            # lâmina d'água (preenchida entre geratriz inferior e N.A.)
            water = QPolygonF([
                QPointF(X(s.x0), Y(s.water0)),
                QPointF(X(s.x1), Y(s.water1)),
                QPointF(X(s.x1), Y(s.invert1)),
                QPointF(X(s.x0), Y(s.invert0)),
            ])
            self.scene.addPolygon(water, QPen(Qt.NoPen), QBrush(_WATER))
            # tubo
            self.scene.addLine(X(s.x0), Y(s.invert0), X(s.x1), Y(s.invert1),
                               pen_pipe)
            self.scene.addLine(X(s.x0), Y(s.crown0), X(s.x1), Y(s.crown1),
                               pen_pipe)
            # terreno
            self.scene.addLine(X(s.x0), Y(s.ground0), X(s.x1), Y(s.ground1),
                               pen_ground)
            # rótulo do trecho
            r = s.pipe
            label = (f"{r.pipe}  DN {r.diameter_mm}  "
                     f"I={fmt.fmt(r.slope, 4)} m/m  "
                     f"y/D={fmt.fmt(r.yd_end, 2)}  "
                     f"V={fmt.fmt(r.v_end, 2)} m/s")
            xm = (s.x0 + s.x1) / 2
            self._text(label, X(xm) - 60,
                       Y(min(s.invert0, s.invert1)) + 14, size=7)

        # PVs (verticais do terreno até a geratriz inferior)
        for s in segments:
            self._pv_marker(s.x0, s.ground0, s.invert0, s.pipe.upstream,
                            X, Y, pen_pv)
        last = segments[-1]
        self._pv_marker(last.x1, last.ground1, last.invert1,
                        last.pipe.downstream, X, Y, pen_pv)

        # régua de estaqueamento no rodapé
        total = path.length
        y_base = max(Y(min(s.invert0, s.invert1) )for s in segments) + 40
        self.scene.addLine(X(0), y_base, X(total), y_base,
                           QPen(_PV, 1))
        xt = 0.0
        while xt <= total + 1e-6:
            self.scene.addLine(X(xt), y_base - 3, X(xt), y_base + 3,
                               QPen(_PV, 1))
            self._text(fmt.fmt(xt, 0), X(xt) - 8, y_base + 6, size=7)
            xt += 20.0

        self._text(f"PERFIL — {path.label}   "
                   f"(exagero vertical {ex:g}x)", X(0), -40, size=12,
                   bold=True)
        rect = self.scene.itemsBoundingRect().adjusted(-40, -30, 40, 30)
        self.scene.setSceneRect(rect)
        self.view.user_zoomed = False
        self.view.fit_scene()

    def _pv_marker(self, x, ground, invert, name, X, Y, pen):
        self.scene.addLine(X(x), Y(ground), X(x), Y(invert), pen)
        self._text(name, X(x) - 12, Y(ground) - 28, size=8, bold=True)
        self._text(f"CT {fmt.fmt(ground, 3)}", X(x) - 20, Y(ground) - 16,
                   size=7)
        self._text(f"CF {fmt.fmt(invert, 3)}", X(x) + 4, Y(invert) + 2,
                   size=7)
