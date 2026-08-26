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
from PySide6.QtWidgets import (QComboBox, QFileDialog, QGraphicsScene,
                               QGraphicsSimpleTextItem, QGraphicsView,
                               QHBoxLayout, QLabel, QMessageBox,
                               QPushButton, QVBoxLayout, QWidget)

from ..core import fmt
from ..core.materials import find_material
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
        top.addWidget(QLabel("OSE:"))
        self.ose_combo = QComboBox()
        self.ose_combo.setMinimumWidth(260)
        self.ose_combo.currentIndexChanged.connect(self._combo_changed)
        top.addWidget(self.ose_combo)
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

        # camadas de contexto: fundo (arruamento) e curvas de nível
        bg_pen = QPen(QColor(120, 120, 120, 80), 0)
        bg_pen.setCosmetic(True)
        for line in project.background_lines:
            if len(line) < 2:
                continue
            path = QPainterPath(QPointF(line[0][0], -line[0][1]))
            for vertex in line[1:]:
                path.lineTo(vertex[0], -vertex[1])
            item = self.scene.addPath(path, bg_pen)
            item.setZValue(-3)
        for e, n, height, rotation, content in project.background_texts:
            label = QGraphicsSimpleTextItem(str(content))
            font = QFont()
            font.setPointSizeF(max(0.5, float(height)))
            label.setFont(font)
            label.setBrush(QBrush(QColor(120, 120, 120, 130)))
            label.setPos(float(e), -float(n) - float(height) * 1.4)
            if rotation:
                label.setRotation(-float(rotation))
            label.setZValue(-3)
            self.scene.addItem(label)
        terrain_pen = QPen(QColor(160, 120, 60, 70), 0)
        terrain_pen.setCosmetic(True)
        for line in project.terrain_lines:
            if len(line) < 2:
                continue
            path = QPainterPath(QPointF(line[0][0], -line[0][1]))
            for vertex in line[1:]:
                path.lineTo(vertex[0], -vertex[1])
            item = self.scene.addPath(path, terrain_pen)
            item.setZValue(-2)

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
            # rótulo: nome, material, DN, extensão (e declividade simulada)
            r = results.get(pipe.name)
            mat = find_material(project.catalog,
                                pipe.material
                                or project.options.default_material)
            mat_name = mat.name.split("(")[0].strip() if mat else ""
            if r:
                label = (f"{pipe.name}  {mat_name}  DN {r.diameter_mm}  "
                         f"L={fmt.fmt(r.length, 2)} m  "
                         f"I={fmt.fmt(r.slope, 4)}")
            else:
                dn = f"DN {pipe.diameter_mm}  " if pipe.diameter_mm else ""
                label = (f"{pipe.name}  {mat_name}  {dn}"
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
            info_lines = []
            if node.ground_elev:
                info_lines.append(f"CT {fmt.fmt(node.ground_elev, 3)}")
            info_lines.append(f"E {fmt.fmt(node.coord_e, 2)}")
            info_lines.append(f"N {fmt.fmt(node.coord_n, 2)}")
            for k, text in enumerate(info_lines):
                sub = QGraphicsSimpleTextItem(text)
                font = QFont()
                font.setPointSizeF(3.0)
                sub.setFont(font)
                sub.setBrush(QBrush(QColor("#4a5470")))
                sub.setPos(x + 4.5, y - 5.5 + k * 4.2)
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
