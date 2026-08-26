"""Croqui da OSE (folha 2, v1): planta apenas dos trechos da OSE.

Mostra a rede da OSE selecionada com PVs, rótulos, setas de fluxo e o
contexto (restante da rede esmaecido + fundo), com cabeçalho de
identificação. Exporta PNG/PDF. Evoluirá para o layout completo da
folha 2 do modelo (carimbo, escala gráfica, norte).
"""

from __future__ import annotations

import math

from PySide6.QtCore import Qt, QPointF, QRectF
from PySide6.QtGui import (QBrush, QColor, QFont, QImage, QPageLayout,
                           QPageSize, QPainter, QPainterPath, QPdfWriter,
                           QPen, QPolygonF)
from PySide6.QtWidgets import (QFileDialog, QGraphicsScene,
                               QGraphicsSimpleTextItem, QGraphicsView,
                               QHBoxLayout, QLabel, QMessageBox,
                               QPushButton, QVBoxLayout, QWidget)

from ..core import fmt
from ..core.models import OseSheet, Project
from ..core.ose import ose_pipe_results
from ..core.simulation import SimulationResult

_PIPE = QColor("#1f6fb2")
_GHOST = QColor(120, 130, 150, 60)
_TEXT = QColor("#1E2742")


class _CroquiView(QGraphicsView):
    def __init__(self, scene):
        super().__init__(scene)
        self.setRenderHint(QPainter.Antialiasing)
        self.setDragMode(QGraphicsView.ScrollHandDrag)

    def wheelEvent(self, event):
        factor = 1.15 if event.angleDelta().y() > 0 else 1 / 1.15
        self.scale(factor, factor)


class CroquiTab(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self._project: Project | None = None
        self._ose: OseSheet | None = None
        self._result: SimulationResult | None = None

        layout = QVBoxLayout(self)
        top = QHBoxLayout()
        self.header = QLabel("Selecione uma OSE na aba Planilha.")
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
        layout.addWidget(self.view, stretch=1)

    # ------------------------------------------------------------------
    def show_ose(self, project: Project, ose: OseSheet | None,
                 result: SimulationResult | None):
        self._project, self._ose, self._result = project, ose, result
        self.scene.clear()
        if ose is None:
            self.header.setText("Selecione uma OSE na aba Planilha.")
            return
        city = ose.city or project.info.city
        status = "  —  CANCELADA" if ose.status == "cancelada" else ""
        self.header.setText(
            f"CROQUI — OSE {ose.number or 's/n'}{status}  |  "
            f"{ose.street or '(rua não informada)'}  |  {city}")

        pipe_ids = set(ose.pipe_ids)
        results = ({r.pipe: r for r in result.pipes} if result else {})

        # contexto: restante da rede esmaecido
        ghost_pen = QPen(_GHOST, 1.0)
        for pipe in self._project.pipes:
            if pipe.id in pipe_ids:
                continue
            up = project.node_by_name(pipe.upstream)
            down = project.node_by_name(pipe.downstream)
            if up and down:
                self.scene.addLine(up.coord_e, -up.coord_n,
                                   down.coord_e, -down.coord_n, ghost_pen)

        pen = QPen(_PIPE, 2.0)
        node_names: set[str] = set()
        for pipe in self._project.pipes:
            if pipe.id not in pipe_ids:
                continue
            up = project.node_by_name(pipe.upstream)
            down = project.node_by_name(pipe.downstream)
            if not (up and down):
                continue
            node_names.update((up.name, down.name))
            x1, y1 = up.coord_e, -up.coord_n
            x2, y2 = down.coord_e, -down.coord_n
            self.scene.addLine(x1, y1, x2, y2, pen)
            # seta de fluxo
            ang = math.atan2(y2 - y1, x2 - x1)
            ax, ay = x1 + (x2 - x1) * 0.55, y1 + (y2 - y1) * 0.55
            size = 6.0
            poly = QPolygonF([
                QPointF(ax, ay),
                QPointF(ax - size * math.cos(ang - 0.45),
                        ay - size * math.sin(ang - 0.45)),
                QPointF(ax - size * math.cos(ang + 0.45),
                        ay - size * math.sin(ang + 0.45))])
            self.scene.addPolygon(poly, QPen(Qt.NoPen), QBrush(_PIPE))
            # rótulo: nome, DN e extensão (declividade se simulado)
            r = results.get(pipe.name)
            label = pipe.name
            if r:
                label = (f"{pipe.name}  DN {r.diameter_mm}  "
                         f"L={fmt.fmt(r.length, 2)} m  "
                         f"I={fmt.fmt(r.slope, 4)}")
            else:
                label = (f"{pipe.name}  "
                         f"L={fmt.fmt(project.pipe_length(pipe), 2)} m")
            item = QGraphicsSimpleTextItem(label)
            font = QFont()
            font.setPointSizeF(4.0)
            item.setFont(font)
            item.setBrush(QBrush(_TEXT))
            deg = math.degrees(ang)
            if deg > 90:
                deg -= 180
            elif deg < -90:
                deg += 180
            item.setRotation(deg)
            item.setPos((x1 + x2) / 2, (y1 + y2) / 2 + 2.0)
            self.scene.addItem(item)

        for name in node_names:
            node = project.node_by_name(name)
            if node is None:
                continue
            x, y = node.coord_e, -node.coord_n
            path = QPainterPath()
            if node.node_type == "EEE":
                path.moveTo(x, y - 5.5)
                path.lineTo(x + 5.0, y + 4.0)
                path.lineTo(x - 5.0, y + 4.0)
                path.closeSubpath()
            else:
                path.addEllipse(x - 4.0, y - 4.0, 8.0, 8.0)
            self.scene.addPath(path, QPen(QColor("#222222"), 1.0),
                               QBrush(Qt.white))
            item = QGraphicsSimpleTextItem(node.name)
            font = QFont()
            font.setPointSizeF(4.5)
            font.setBold(True)
            item.setFont(font)
            item.setBrush(QBrush(_TEXT))
            item.setPos(x + 4.5, y - 11.0)
            self.scene.addItem(item)
            if node.ground_elev:
                sub = QGraphicsSimpleTextItem(
                    f"CT {fmt.fmt(node.ground_elev, 3)}")
                font = QFont()
                font.setPointSizeF(3.2)
                sub.setFont(font)
                sub.setBrush(QBrush(QColor("#4a5470")))
                sub.setPos(x + 4.5, y - 5.5)
                self.scene.addItem(sub)

        rect = self.scene.itemsBoundingRect().adjusted(-30, -30, 30, 30)
        self.scene.setSceneRect(rect)
        self.view.fitInView(rect, Qt.KeepAspectRatio)

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
            image = QImage(int(rect.width() * 3), int(rect.height() * 3),
                           QImage.Format_ARGB32)
            image.fill(Qt.white)
            painter = QPainter(image)
            painter.setRenderHint(QPainter.Antialiasing)
            self.scene.render(painter, QRectF(image.rect()), rect)
            painter.end()
            image.save(path)
        else:
            writer = QPdfWriter(path)
            writer.setPageSize(QPageSize(QPageSize.A3))
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
