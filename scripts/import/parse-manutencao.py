# -*- coding: utf-8 -*-
"""
Parser dos Excel de manutencao da RG -> JSON limpo para o importador Node.

Entradas (em scripts/import/source/):
  - FRMAN09-cadastro-intervencoes.xlsb  (folha CADASTRO_UR)  -> assets.json
  - PLMAN01-plano-manutencao-2026.xlsx   (folha PM)           -> plans.json

Trata: encoding correto (unicode via libs), linhas-cabecalho de seccao, celulas
de erro, campos em branco. Liga planos a equipamentos por TAG.

Executar:  python scripts/import/parse-manutencao.py
"""
import os, re, json, sys

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, "source")
XLSB = os.path.join(SRC, "FRMAN09-cadastro-intervencoes.xlsb")
XLSX = os.path.join(SRC, "PLMAN01-plano-manutencao-2026.xlsx")


def clean(v):
    """Normaliza uma celula -> str limpa ou None. Filtra erros (0x..) e vazios."""
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    # celulas de erro do Excel aparecem como '0x7', '0x17', etc.
    if re.fullmatch(r"0x[0-9a-fA-F]+", s):
        return None
    # numeros inteiros vindos como float ("80.0" -> "80")
    if re.fullmatch(r"-?\d+\.0", s):
        s = s[:-2]
    return s


def norm_cat(v):
    s = (clean(v) or "").upper()
    return s if s in ("A", "B", "C") else None


CAT_TO_CRIT = {"A": "vermelho", "B": "amarelo", "C": "verde"}


def normalize_periodicidade(raw):
    """raw (ex.: 'BIANUAL-STP') -> (periodicidade, executor, legal, label)."""
    label = clean(raw)
    s = (label or "").upper()
    executor = "externo" if "STP" in s else "interno"
    legal = "LEGAL" in s
    base = s
    for suf in ("-STP", " STP", "-LEGAL", " LEGAL", "-ANO PAR", "-ANO IMPAR"):
        base = base.replace(suf, "")
    base = base.strip()
    if base.startswith("SEMANAL"):
        p = "semanal"
    elif base.startswith("MENSAL"):
        p = "mensal"
    elif base.startswith("TRIMESTRAL"):
        p = "trimestral"
    elif base.startswith("BIANUAL"):
        p = "bianual"
    elif base.startswith("BIENAL"):
        p = "bienal"
    elif base.startswith("TRIANUAL"):
        p = "trianual"
    elif base.startswith("ANUAL"):
        p = "anual"
    elif "HORAS" in base or "CONDI" in base:
        p = "horas"
    elif "ANOS" in base:  # "5 ANOS" e afins -> multi-ano, aproxima a bienal (label preservado)
        p = "bienal"
    else:  # FICHA REGISTO, PLANO, legal isolado, '?', etc.
        p = "pontual"
    return p, executor, legal, label


# ─────────────────────────── CADASTRO (assets) ───────────────────────────────
def parse_cadastro():
    from pyxlsb import open_workbook
    wb = open_workbook(XLSB)
    assets = []
    seen = set()
    with wb.get_sheet("CADASTRO_UR") as sh:
        for i, row in enumerate(sh.rows()):
            if i == 0:
                continue  # cabecalho
            v = [c.v for c in row]
            def col(n):
                return clean(v[n]) if n < len(v) else None
            area = col(2)
            system = col(8)
            name = col(9)        # DESIGNACAO
            crit = norm_cat(v[11]) if len(v) > 11 else None
            tag = col(12)
            obs = col(13)         # OBS
            charac = col(14)      # CARACTERISTICAS
            manuf = col(15)       # FORNECEDOR / FABRICANTE
            obs2 = col(16)        # OBSERVACOES
            if not name:
                continue  # linha de hierarquia sem equipamento
            notes = " | ".join([x for x in (obs, obs2) if x]) or None
            key = (tag or "", name, area or "")
            if key in seen:
                continue
            seen.add(key)
            assets.append({
                "area": area, "tag": tag, "system": system, "name": name,
                "characteristics": charac, "manufacturer": manuf,
                "notes": notes, "criticidadeABC": crit,
            })
    return assets


# ─────────────────────────── PLANO (plans) ───────────────────────────────────
def parse_plano():
    import openpyxl
    wb = openpyxl.load_workbook(XLSX, data_only=True, read_only=True)
    ws = wb["PM"]
    plans = []
    for i, row in enumerate(ws.iter_rows(min_row=4, max_col=12, values_only=True)):
        v = list(row) + [None] * 12
        area = clean(v[0]); tag = clean(v[1]); system = clean(v[2])
        equip = clean(v[3]); acao = clean(v[4]); tipo = v[5]; mes = clean(v[6])
        cat = norm_cat(v[11])
        if not tag or not (acao or equip):
            continue  # linhas-seccao ("PLANO MANUTENCAO") / vazias
        p, executor, legal, label = normalize_periodicidade(tipo)
        title = acao or (equip or "Tarefa de plano")
        plans.append({
            "area": area, "tag": tag, "system": system, "equipamento": equip,
            "title": title, "acao": acao,
            "periodicidade": p, "periodicidadeLabel": label,
            "executor": executor, "legal": legal, "months": mes,
            "criticidade": CAT_TO_CRIT.get(cat or "", "verde"),
        })
    return plans


def main():
    for f in (XLSB, XLSX):
        if not os.path.exists(f):
            print(f"FALTA ficheiro: {f}", file=sys.stderr)
            sys.exit(1)
    assets = parse_cadastro()
    plans = parse_plano()

    with open(os.path.join(BASE, "assets.json"), "w", encoding="utf-8") as f:
        json.dump(assets, f, ensure_ascii=False, indent=1)
    with open(os.path.join(BASE, "plans.json"), "w", encoding="utf-8") as f:
        json.dump(plans, f, ensure_ascii=False, indent=1)

    # ── Resumo ──
    tags_assets = {a["tag"] for a in assets if a["tag"]}
    tags_plans = {p["tag"] for p in plans if p["tag"]}
    orfaos = sorted(tags_plans - tags_assets)
    per = {}
    for p in plans:
        per[p["periodicidade"]] = per.get(p["periodicidade"], 0) + 1
    print(f"ASSETS: {len(assets)}  (TAGs unicas: {len(tags_assets)})")
    print(f"PLANS : {len(plans)}  (TAGs com plano: {len(tags_plans)})")
    print(f"Periodicidades: {per}")
    print(f"Planos externos (-STP): {sum(1 for p in plans if p['executor']=='externo')}")
    print(f"Planos legais: {sum(1 for p in plans if p['legal'])}")
    print(f"TAGs com plano SEM equipamento no cadastro: {len(orfaos)}")
    if orfaos:
        print("  amostra:", orfaos[:15])


if __name__ == "__main__":
    main()
