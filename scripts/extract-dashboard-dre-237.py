"""Gera referência DRE orçada 2026 e 2027 da aba Orc_Dados da Zacarini.

O Excel é fonte apenas desta importação inicial; o ERP usa o Supabase.
Não importa os valores 'Realizado' antigos como se fossem fechamento atual.
"""

from collections import defaultdict
from decimal import Decimal
from pathlib import Path
import sys

from openpyxl import load_workbook


FILE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
    "/workspace/scratch/9eab8bf85279/referencia/Gestão Zacarini - Painel 2.3.7.xlsx"
)
EXPENSE_GROUPS = ("Logística", "Pessoal", "Administrativo", "Industrial", "Taxas", "Marketing")
METRICS = (
    ("receita_bruta", "Receita bruta", "R$"),
    ("receita_liquida", "Receita líquida", "R$"),
    ("cmv", "(-) CMV", "R$"),
    ("lucro_bruto", "Lucro bruto", "R$"),
    ("margem_bruta", "Margem bruta %", "razao"),
    ("despesas", "Total despesas", "R$"),
    ("ebitda", "EBITDA", "R$"),
    ("margem_ebitda", "Margem EBITDA %", "razao"),
    ("lucro_liquido", "Lucro líquido", "R$"),
)


def quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def cash_groups(raw):
    receita = raw.get("Receita",Decimal(0))
    liquida = receita + raw.get("Impostos",Decimal(0))
    cmv = raw.get("CMV",Decimal(0))
    bruto = liquida + cmv
    despesas = sum((raw.get(group,Decimal(0)) for group in EXPENSE_GROUPS),Decimal(0))
    ebitda = bruto + despesas
    lucro = ebitda + raw.get("Despesas financeiras",Decimal(0)) + raw.get("Outros tributos",Decimal(0))
    return {"receita_bruta":receita,"receita_liquida":liquida,"cmv":cmv,"lucro_bruto":bruto,
        "margem_bruta":bruto/receita if receita else Decimal(0),"despesas":despesas,
        "ebitda":ebitda,"margem_ebitda":ebitda/receita if receita else Decimal(0),
        "lucro_liquido":lucro}


def main():
    book = load_workbook(FILE,data_only=True,read_only=True)
    source = list(book["Orc_Dados"].iter_rows(values_only=True))
    if source[0][:4] != ("Ano","Grupo","Item","Tipo"):
        raise ValueError("Cabeçalho Orc_Dados alterado")
    grouped = defaultdict(lambda: defaultdict(Decimal))
    for row in source[1:]:
        if row[0] not in (2026,2027) or row[3] != "Projetado":
            continue
        for month in range(1,13):
            value = row[month+3]
            if not isinstance(value,(int,float)):
                raise ValueError(f"Orçado inválido {row[:4]} mês {month}")
            grouped[(row[0],month)][row[1]] += Decimal(str(value))

    september = cash_groups(grouped[(2026,9)])
    dre2026 = book["DRE 2026"]
    for code,cell in (("receita_bruta","D8"),("receita_liquida","D15"),("cmv","D16"),
        ("lucro_bruto","D17"),("despesas","D25"),("ebitda","D26"),("lucro_liquido","D30")):
        if abs(september[code] - Decimal(str(dre2026[cell].value))) > Decimal("0.02"):
            raise ValueError(f"DRE 2026!{cell} não reconcilia: {code}")
    january2027 = cash_groups(grouped[(2027,1)])
    if abs(january2027["receita_bruta"] - Decimal(str(book["Orçamento 2027"]["D7"].value))) > Decimal("0.02"):
        raise ValueError("Orçamento 2027!D7 não reconcilia")

    values = []
    for year in (2026,2027):
        for month in range(1,13):
            metrics = cash_groups(grouped[(year,month)])
            if metrics["receita_bruta"] <= 0:
                raise ValueError(f"Receita orçada ausente {year}-{month}")
            origin = f"{chr(68+month)}1"  # cabeçalho de JAN (E1) ... DEZ (P1)
            for code,label,unit in METRICS:
                values.append((f"dre_{code}",f"{year}-{month:02d}-01",label,metrics[code],unit,origin))

    print("-- DRE orçada da Zacarini 2.3.7; Orc_Dados (Ano/Tipo=Projetado).")
    print("-- Cálculo: bruta+impostos=líquida; líquida+CMV=lucro bruto; despesas seis grupos;")
    print("-- EBITDA=lucro bruto+despesas; lucro líquido=EBITDA+financeiras+outros tributos.")
    print("-- Referência gerencial; 'Realizado' do Excel NÃO é replicado como atual.")
    print("INSERT INTO public.compras_dashboard_config_237")
    print(" (codigo,grupo,dimensao,competencia,rotulo,valor,unidade,origem_aba,origem_celula,versao,situacao) VALUES")
    print(",\n".join(" ("+",".join([quote(code),quote("dre_orcado"),"NULL",quote(competence),
        quote(label),format(value,"f"),quote(unit),quote("Orc_Dados"),quote(origin),quote("2.3.7"),quote("referencia")])+")"
        for code,competence,label,value,unit,origin in values))
    print("ON CONFLICT (codigo,competencia) DO UPDATE SET")
    print(" grupo=excluded.grupo,rotulo=excluded.rotulo,valor=excluded.valor,")
    print(" unidade=excluded.unidade,origem_aba=excluded.origem_aba,origem_celula=excluded.origem_celula,")
    print(" versao=excluded.versao WHERE public.compras_dashboard_config_237.situacao='referencia';")


if __name__=="__main__":
    main()
