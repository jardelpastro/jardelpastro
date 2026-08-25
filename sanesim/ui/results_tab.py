"""Aba de resultados: planilha no padrão do memorial (2 linhas por trecho)."""

from __future__ import annotations

from PySide6.QtGui import QBrush, QColor
from PySide6.QtWidgets import (QLabel, QTableWidget, QTableWidgetItem,
                               QVBoxLayout, QWidget)

from ..core.simulation import SimulationResult

_VIOL_BG = QColor("#ffc7ce")
_VIOL_FG = QColor("#9c0006")

HEADERS = ["Rede", "Trecho", "PV Ini\nPV Fim", "Ext.\n(m)",
           "Cont.Lin\n(l/s/km)", "Cont.Trecho\n(l/s)", "Q Pont.\n(l/s)",
           "Q Mont.\n(l/s)", "Q Jus.\n(l/s)", "DN\n(mm)", "Decliv.\n(m/m)",
           "Cota Ter.\n(m)", "Cota GI\n(m)", "Recobr.\n(m)",
           "Prof.Vala\n(m)", "y/D", "V\n(m/s)", "σ (Pa)\nVc (m/s)",
           "n", "Larg.Vala\n(m)", "Observações"]


class ResultsTab(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        layout = QVBoxLayout(self)
        self.summary = QLabel("Rode a simulação para ver os resultados "
                              "(F5 ou botão ▶ na barra de ferramentas).")
        self.summary.setWordWrap(True)
        layout.addWidget(self.summary)
        self.table = QTableWidget(0, len(HEADERS))
        self.table.setHorizontalHeaderLabels(HEADERS)
        self.table.setAlternatingRowColors(True)
        self.table.setEditTriggers(QTableWidget.NoEditTriggers)
        layout.addWidget(self.table)

    def _set(self, row: int, col: int, value, violated: bool = False):
        item = QTableWidgetItem("" if value is None else str(value))
        if violated:
            item.setBackground(QBrush(_VIOL_BG))
            item.setForeground(QBrush(_VIOL_FG))
        self.table.setItem(row, col, item)

    def show_result(self, result: SimulationResult):
        self.table.setRowCount(0)
        n_viol = sum(1 for r in result.pipes if r.violations)
        txt = (f"Rede simulada: {len(result.pipes)} trechos, "
               f"{result.total_length_m:.1f} m. Taxa linear "
               f"(c/ infiltração): {result.rate_start:.3f} / "
               f"{result.rate_end:.3f} l/s.km (ini/fim).")
        if n_viol:
            txt += (f"  ⚠ {n_viol} trecho(s) com violação de critério "
                    "(destacados em vermelho).")
        else:
            txt += "  ✔ Todos os critérios atendidos."
        self.summary.setText(txt)

        def f(value, dec=2):
            return f"{value:.{dec}f}"

        for r in result.pipes:
            v = bool(r.violations)
            row = self.table.rowCount()
            self.table.insertRow(row)
            self._set(row, 0, r.network, v)
            self._set(row, 1, r.pipe, v)
            self._set(row, 2, r.upstream, v)
            self._set(row, 3, f(r.length), v)
            self._set(row, 4, f(r.rate_start), v)
            self._set(row, 5, f(r.q_reach_start, 3), v)
            self._set(row, 6, f(r.q_point), v)
            self._set(row, 7, f(r.q_up_start, 3), v)
            self._set(row, 8, f(r.q_down_start, 3), v)
            self._set(row, 9, r.diameter_mm, v)
            self._set(row, 10, f(r.slope, 4), v)
            self._set(row, 11, f(r.ground_up, 3), v)
            self._set(row, 12, f(r.invert_up, 3), v)
            self._set(row, 13, f(r.cover_up, 3), v)
            self._set(row, 14, f(r.depth_up, 3), v)
            self._set(row, 15, f(r.yd_start), v)
            self._set(row, 16, f(r.v_start), v)
            self._set(row, 17, f(r.tractive_pa), v)
            self._set(row, 18, f(r.n_manning, 3), v)
            self._set(row, 19, f(r.trench_width), v)
            self._set(row, 20, "; ".join(r.violations), v)
            row = self.table.rowCount()
            self.table.insertRow(row)
            self._set(row, 2, r.downstream, v)
            self._set(row, 4, f(r.rate_end), v)
            self._set(row, 5, f(r.q_reach_end, 3), v)
            self._set(row, 7, f(r.q_up_end, 3), v)
            self._set(row, 8, f(r.q_down_end, 3), v)
            self._set(row, 11, f(r.ground_down, 3), v)
            self._set(row, 12, f(r.invert_down, 3), v)
            self._set(row, 13, f(r.cover_down, 3), v)
            self._set(row, 14, f(r.depth_down, 3), v)
            self._set(row, 15, f(r.yd_end), v)
            self._set(row, 16, f(r.v_end), v)
            self._set(row, 17, f(r.v_critical), v)
        self.table.resizeColumnsToContents()
