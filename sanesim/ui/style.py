"""Identidade visual do SaneSim (paleta Pastro Engenharia).

Azul-marinho profundo + turquesa, fundo claro e cartões brancos —
aplicado via QSS global, com ícone de janela desenhado em código.
"""

from __future__ import annotations

from PySide6.QtCore import QPointF, QRectF, Qt
from PySide6.QtGui import (QBrush, QColor, QIcon, QLinearGradient, QPainter,
                           QPainterPath, QPen, QPixmap)

NAVY = "#1B2B5B"          # azul-marinho da marca
NAVY_DARK = "#132049"
TEAL = "#2FB8A9"          # turquesa da gota
TEAL_DARK = "#1E9A8C"
TEAL_LIGHT = "#7BD8CD"
BG = "#F2F5F9"            # fundo geral
CARD = "#FFFFFF"
TEXT = "#1E2742"
MUTED = "#5A6580"

STYLE = f"""
QMainWindow, QDialog {{
    background: {BG};
}}
QToolBar {{
    background: {NAVY};
    border: none;
    padding: 3px 6px;
    spacing: 4px;
}}
QToolBar QToolButton, QToolBar QPushButton {{
    color: white;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    padding: 5px 10px;
    font-weight: 600;
}}
QToolBar QToolButton:hover, QToolBar QPushButton:hover {{
    background: {NAVY_DARK};
    border-color: {TEAL};
}}
QToolBar QToolButton:checked {{
    background: {TEAL_DARK};
}}
QToolBar QComboBox {{
    padding: 3px 6px;
    border-radius: 4px;
}}
QStatusBar {{
    background: {NAVY};
    color: white;
}}
QTabWidget::pane {{
    border: 1px solid #d5dce8;
    background: {CARD};
    border-radius: 4px;
}}
QTabBar::tab {{
    background: #e4e9f2;
    color: {TEXT};
    padding: 7px 16px;
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
    margin-right: 2px;
    font-weight: 600;
}}
QTabBar::tab:selected {{
    background: {CARD};
    color: {NAVY};
    border-bottom: 3px solid {TEAL};
}}
QTabBar::tab:hover:!selected {{
    background: #eef2f8;
}}
QGroupBox {{
    background: {CARD};
    border: 1px solid #d5dce8;
    border-radius: 6px;
    margin-top: 12px;
    padding-top: 6px;
    font-weight: 700;
    color: {NAVY};
}}
QGroupBox::title {{
    subcontrol-origin: margin;
    left: 10px;
    padding: 0 4px;
}}
QTableWidget, QTableView {{
    background: {CARD};
    alternate-background-color: #f2f7fa;
    gridline-color: #dde4ee;
    selection-background-color: {TEAL_LIGHT};
    selection-color: {TEXT};
    border: 1px solid #d5dce8;
    border-radius: 4px;
}}
QHeaderView::section {{
    background: {NAVY};
    color: white;
    padding: 5px;
    border: none;
    border-right: 1px solid {NAVY_DARK};
    font-weight: 600;
}}
QTableCornerButton::section {{
    background: {NAVY};
    border: none;
}}
QListWidget {{
    background: {CARD};
    border: 1px solid #d5dce8;
    border-radius: 4px;
}}
QListWidget::item:selected {{
    background: {TEAL_LIGHT};
    color: {TEXT};
}}
QPushButton {{
    background: {NAVY};
    color: white;
    border: none;
    border-radius: 5px;
    padding: 6px 14px;
    font-weight: 600;
}}
QPushButton:hover {{
    background: {TEAL_DARK};
}}
QPushButton:pressed {{
    background: {NAVY_DARK};
}}
QPushButton:disabled {{
    background: #b9c2d4;
}}
QLineEdit, QPlainTextEdit, QSpinBox, QDoubleSpinBox, QComboBox {{
    background: white;
    border: 1px solid #c7d0e0;
    border-radius: 4px;
    padding: 3px 6px;
    selection-background-color: {TEAL_LIGHT};
}}
QLineEdit:focus, QPlainTextEdit:focus, QSpinBox:focus,
QDoubleSpinBox:focus, QComboBox:focus {{
    border-color: {TEAL};
}}
/* botões dos spin boxes: área clicável larga e setas visíveis (sem
   isso o estilo global encolhia os botões e o cursor virava I-beam) */
QSpinBox::up-button, QDoubleSpinBox::up-button,
QSpinBox::down-button, QDoubleSpinBox::down-button {{
    subcontrol-origin: border;
    width: 20px;
    background: #e4e9f2;
    border-left: 1px solid #c7d0e0;
}}
QSpinBox::up-button, QDoubleSpinBox::up-button {{
    subcontrol-position: top right;
    border-top-right-radius: 4px;
}}
QSpinBox::down-button, QDoubleSpinBox::down-button {{
    subcontrol-position: bottom right;
    border-bottom-right-radius: 4px;
}}
QSpinBox::up-button:hover, QDoubleSpinBox::up-button:hover,
QSpinBox::down-button:hover, QDoubleSpinBox::down-button:hover {{
    background: {TEAL_LIGHT};
}}
QSpinBox::up-arrow, QDoubleSpinBox::up-arrow {{
    width: 0; height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-bottom: 6px solid {NAVY};
}}
QSpinBox::down-arrow, QDoubleSpinBox::down-arrow {{
    width: 0; height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 6px solid {NAVY};
}}
/* caixas de seleção: vazia quando desmarcada, preenchida quando marcada */
QCheckBox::indicator, QGroupBox::indicator,
QListWidget::indicator, QTableWidget::indicator,
QTreeView::indicator, QListView::indicator {{
    width: 15px;
    height: 15px;
    border: 2px solid #8a97b0;
    border-radius: 3px;
    background: white;
}}
QCheckBox::indicator:checked, QGroupBox::indicator:checked,
QListWidget::indicator:checked, QTableWidget::indicator:checked,
QTreeView::indicator:checked, QListView::indicator:checked {{
    background: {TEAL};
    border-color: {TEAL_DARK};
}}
QCheckBox::indicator:hover, QListWidget::indicator:hover {{
    border-color: {TEAL};
}}
QSplitter::handle {{
    background: #ccd5e3;
}}
QSplitter::handle:hover {{
    background: {TEAL};
}}
QLabel[role="hint"] {{
    color: #55617e;
}}
"""


def app_icon() -> QIcon:
    """Gota sobre engrenagem, nas cores da marca (aproximação da logo)."""
    pix = QPixmap(64, 64)
    pix.fill(Qt.transparent)
    p = QPainter(pix)
    p.setRenderHint(QPainter.Antialiasing)
    navy = QColor(NAVY)
    # engrenagem: círculo com dentes
    p.setPen(QPen(navy, 6))
    p.setBrush(Qt.NoBrush)
    p.drawEllipse(QRectF(10, 12, 44, 44))
    import math
    for i in range(8):
        ang = math.radians(i * 45)
        x1 = 32 + 22 * math.cos(ang)
        y1 = 34 + 22 * math.sin(ang)
        x2 = 32 + 29 * math.cos(ang)
        y2 = 34 + 29 * math.sin(ang)
        p.drawLine(QPointF(x1, y1), QPointF(x2, y2))
    # gota
    drop = QPainterPath(QPointF(32, 6))
    drop.cubicTo(QPointF(46, 26), QPointF(46, 40), QPointF(32, 46))
    drop.cubicTo(QPointF(18, 40), QPointF(18, 26), QPointF(32, 6))
    p.setPen(QPen(navy, 4))
    p.setBrush(QBrush(Qt.white))
    p.drawPath(drop)
    # água dentro da gota (gradiente turquesa)
    grad = QLinearGradient(20, 30, 44, 46)
    grad.setColorAt(0, QColor(TEAL_LIGHT))
    grad.setColorAt(1, QColor(TEAL_DARK))
    water = QPainterPath(QPointF(21, 33))
    water.cubicTo(QPointF(28, 29), QPointF(36, 37), QPointF(43, 33))
    water.lineTo(QPointF(43, 38))
    water.cubicTo(QPointF(40, 44), QPointF(24, 44), QPointF(21, 38))
    water.closeSubpath()
    p.setPen(Qt.NoPen)
    p.setBrush(QBrush(grad))
    p.drawPath(water)
    p.end()
    return QIcon(pix)
