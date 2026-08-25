"""Ponto de entrada do SaneSim (interface gráfica).

Uso:
    python main.py [projeto.json]
"""

import sys

from PySide6.QtWidgets import QApplication

from sanesim.core.models import Project
from sanesim.ui.main_window import MainWindow


def main() -> int:
    app = QApplication(sys.argv)
    app.setApplicationName("SaneSim")
    window = MainWindow()
    if len(sys.argv) > 1:
        window.project = Project.load(sys.argv[1])
        window._load_all()
    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
