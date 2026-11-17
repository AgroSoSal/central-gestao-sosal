"""Extrai para stdout um cenário/cache de regressão da aba OTB.

Uso: python scripts/extract-otb-reference.py /caminho/Gestao.xlsx
Requer openpyxl. Não altera nem copia a planilha.
AVISO: o stdout contém números empresariais e não deve ir para logs públicos.
"""

import json
import sys
from datetime import datetime

from openpyxl import load_workbook
from openpyxl.utils import column_index_from_string


def main(path: str):
    workbook = load_workbook(path, read_only=True, data_only=True)
    sheet = workbook["OTB"]
    header = next(sheet.iter_rows(min_row=7, max_row=7, max_col=4, values_only=True))
    budget = list(sheet.iter_rows(min_row=21, max_row=21, max_col=4, values_only=True))[0]
    total_need = next(sheet.iter_rows(min_row=22, max_row=22, max_col=4, values_only=True))
    buyer_share = next(sheet.iter_rows(min_row=24, max_row=24, max_col=18, values_only=True))[17]
    rows = list(sheet.iter_rows(min_row=48, max_row=173, max_col=72, values_only=True))
    col = lambda item: column_index_from_string(item) - 1
    cell = lambda row, column: row[col(column)]
    monthly_columns = [
        ["S", "T", "W", "R", "AV"],
        ["AB", "AC", "AF", "AA", "AW"],
        ["AK", "AL", "AO", "AJ", "AX"],
    ]

    subgroups = []
    expected = {}
    for index, row in enumerate(rows[:-1], start=48):
        kind = cell(row, "C")
        if kind not in ("S", "P", "M", "N"):
            continue

        name = str(cell(row, "B"))
        subgroups.append({
            "line": name.split("/")[0].strip(),
            "name": name,
            "kind": kind,
            "openingStock": cell(row, "I") or 0,
            "priorOrders": cell(row, "J") or 0,
            "forecastCost": [cell(row, c) or 0 for c in ("Q", "Z", "AI")],
            "targetStock": [
                cell(row, "K") or 0,
                (cell(row, "BR") or 0) * (cell(row, "AS") or 0),
                (cell(row, "BS") or 0) * (cell(row, "AT") or 0),
            ],
            "curveAShare": cell(row, "H") or 0,
            "alreadyRecorded": [cell(row, c) or 0 for c in ("V", "AE", "AN")],
            "tiedSalesApproved": [cell(row, c) or 0 for c in ("U", "AD", "AM")],
            "excess": [cell(row, c) or 0 for c in ("AV", "AW", "AX")],
        })
        expected[name] = [{
            "need": cell(row, columns[0]) or 0,
            "released": cell(row, columns[1]) or 0,
            "freeBalance": cell(row, columns[2]) or 0,
            "openingStock": cell(row, columns[3]) or 0,
            "excess": cell(row, columns[4]) or 0,
        } for columns in monthly_columns]

    mp = rows[-1]
    result = {
        "input": {
            "source": "Gestão Zacarini 2.2.24 — fotografia de homologação",
            "baseDate": "2026-11-07",
            "months": [
                f"{header[1].year + (header[1].month - 1 + i) // 12:04d}-{(header[1].month - 1 + i) % 12 + 1:02d}-01"
                for i in range(3)
            ],
            "cashCaps": [budget[i] for i in (1, 2, 3)],
            "mpNeeds": [cell(mp, c) for c in ("S", "AB", "AK")],
            "buyerShare": buyer_share,
            "subgroups": subgroups,
        },
        "expected": {
            "totalNeed": [total_need[i] for i in (1, 2, 3)],
            "rows": expected,
        },
    }
    print(json.dumps(result, ensure_ascii=False, allow_nan=False))
    workbook.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Informe o caminho da planilha XLSX.")
    main(sys.argv[1])
