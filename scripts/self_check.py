#!/usr/bin/env python3
"""Verificación mínima del diagrama autocontenido de la v2.0."""
from pathlib import Path
import sys

root = Path(__file__).resolve().parent.parent
path = root / "DIAGRAMA-REFACTOR-DINERO.html"

if not path.exists():
    print(f"FALTA: {path}")
    sys.exit(1)

html = path.read_text(encoding="utf-8")
required = [
    "savings_movements",
    "savings_plans",
    "get_member_available",
    "run_due_savings",
    "Inicio",
    "Gastos",
    "Ahorros",
    "Historial",
    "Miembros",
    "Hogar",
    "Un solo ledger",
]
missing = [token for token in required if token not in html]
if missing:
    print("FALTAN secciones/etiquetas:", ", ".join(missing))
    sys.exit(1)

if "<script" in html.lower():
    print("FALLA: el diagrama no debe incluir JavaScript")
    sys.exit(1)

if len(html) < 5000:
    print("FALLA: el diagrama parece incompleto")
    sys.exit(1)

print(f"OK: {path.name} ({len(html)} bytes), secciones y sin JS")
