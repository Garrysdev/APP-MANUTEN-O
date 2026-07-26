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


# ─────────────────────────── UR (tasks_ur) ────────────────────────────────────
def parse_ur():
    from pyxlsb import open_workbook
    wb = open_workbook(XLSB)
    tasks = []
    with wb.get_sheet("UR") as sh:
        for i, row in enumerate(sh.rows()):
            if i < 2:
                continue
            v = [c.v for c in row]
            id_val = clean(v[0]) if len(v) > 0 else None
            sts_val = clean(v[2]) if len(v) > 2 else None
            area = clean(v[4]) if len(v) > 4 else None
            tag = clean(v[5]) if len(v) > 5 else None
            ti = clean(v[6]) if len(v) > 6 else None
            avaria = clean(v[7]) if len(v) > 7 else None
            tecnicos = clean(v[8]) if len(v) > 8 else None
            if not avaria and not tag:
                continue
            
            status = "pending"
            if sts_val:
                s_up = sts_val.upper()
                if "EM CURSO" in s_up: status = "in_progress"
                elif "CONCLU" in s_up: status = "done"
                elif "CANCEL" in s_up: status = "cancelled"
            
            tipo = "curativa"
            if ti:
                t_up = ti.upper()
                if "PI" in t_up: tipo = "inspecao"
                elif "PM" in t_up or "PREV" in t_up: tipo = "preventiva"

            tasks.append({
                "sourceId": id_val,
                "status": status,
                "rawStatus": sts_val,
                "area": area,
                "tag": tag,
                "tipo": tipo,
                "title": avaria or f"OT {id_val}",
                "technicians": tecnicos,
            })
    return tasks


# ─────────────────────────── PROJECTOS (tasks_projects) ──────────────────────
def parse_projectos():
    from pyxlsb import open_workbook
    wb = open_workbook(XLSB)
    projects = []
    with wb.get_sheet("PROJECTOS_UR") as sh:
        current_section = "PROJETOS URGENTES"
        for i, row in enumerate(sh.rows()):
            v = [c.v for c in row]
            col0 = clean(v[0]) if len(v) > 0 else None
            col7 = clean(v[7]) if len(v) > 7 else None
            if col0 and ("PROJECTOS" in col0.upper() or "PLANO" in col0.upper()):
                current_section = col0
                continue
            if i < 2:
                continue
            area = clean(v[3]) if len(v) > 3 else None
            tag = clean(v[4]) if len(v) > 4 else None
            ti = clean(v[5]) if len(v) > 5 else None
            avaria = col7
            tecnicos = clean(v[8]) if len(v) > 8 else None
            if not avaria and not tag:
                continue
            
            projects.append({
                "section": current_section,
                "area": area,
                "tag": tag,
                "tipo": "plano" if "PLANO" in (current_section or "").upper() else "curativa",
                "title": avaria or f"Projeto {tag}",
                "technicians": tecnicos,
            })
    return projects


def main():
    for f in (XLSB, XLSX):
        if not os.path.exists(f):
            print(f"FALTA ficheiro: {f}", file=sys.stderr)
            sys.exit(1)
    assets = parse_cadastro()
    plans = parse_plano()
    tasks_ur = parse_ur()
    tasks_projects = parse_projectos()

    with open(os.path.join(BASE, "assets.json"), "w", encoding="utf-8") as f:
        json.dump(assets, f, ensure_ascii=False, indent=1)
    with open(os.path.join(BASE, "plans.json"), "w", encoding="utf-8") as f:
        json.dump(plans, f, ensure_ascii=False, indent=1)
    with open(os.path.join(BASE, "tasks_ur.json"), "w", encoding="utf-8") as f:
        json.dump(tasks_ur, f, ensure_ascii=False, indent=1)
    with open(os.path.join(BASE, "tasks_projects.json"), "w", encoding="utf-8") as f:
        json.dump(tasks_projects, f, ensure_ascii=False, indent=1)

    print(f"ASSETS       : {len(assets)}")
    print(f"PLANS        : {len(plans)}")
    print(f"TASKS UR     : {len(tasks_ur)}")
    print(f"PROJECTS UR  : {len(tasks_projects)}")


if __name__ == "__main__":
    main()
