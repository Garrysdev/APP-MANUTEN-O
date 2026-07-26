import pyxlsb
import openpyxl

def extract_tecnicos():
    tecnicos_set = set()
    
    # 1. xlsb UR
    f2 = r'C:\Users\Quinta do Arrobe\Desktop\DOWNLOADS CHROME\drive-download-20260725T123638Z-1-001\FR-MAN-09 MANUTENÇÃO_05_01_2026_8.xlsb'
    wb2 = pyxlsb.open_workbook(f2)
    with wb2.get_sheet('UR') as s:
        rows = list(s.rows())
        for r in range(2, len(rows)):
            row = rows[r]
            if len(row) > 8 and row[8].v:
                val = str(row[8].v).strip()
                if val:
                    for t in val.replace('+', '/').replace(',', '/').replace(' e ', '/').split('/'):
                        if t.strip():
                            tecnicos_set.add(t.strip())
                            
    with wb2.get_sheet('PROJECTOS_UR') as s:
        rows = list(s.rows())
        for r in range(2, len(rows)):
            row = rows[r]
            if len(row) > 7 and row[7].v:
                val = str(row[7].v).strip()
                if val:
                    for t in val.replace('+', '/').replace(',', '/').replace(' e ', '/').split('/'):
                        if t.strip():
                            tecnicos_set.add(t.strip())

    print("=== TÉCNICOS ENCONTRADOS NO EXCEL ===")
    for t in sorted(tecnicos_set):
        print(f"- {t}")

if __name__ == '__main__':
    extract_tecnicos()
