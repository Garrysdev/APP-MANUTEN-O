import openpyxl
import pyxlsb

def inspect():
    print('=== EXAMINANDO PL-MAN-01 (PM) ===')
    wb1 = openpyxl.load_workbook(r'C:\Users\Quinta do Arrobe\Desktop\DOWNLOADS CHROME\drive-download-20260725T123638Z-1-001\PL-MAN-01 PLANO MANUTENÇÃO_2026.xlsx', data_only=True)
    sheet1 = wb1['PM']
    for r in range(1, 6):
        row_vals = [cell for cell in next(sheet1.iter_rows(min_row=r, max_row=r, values_only=True))]
        non_empty = [(i+1, v) for i, v in enumerate(row_vals) if v is not None]
        print(f'Linha {r}: {non_empty[:12]}')

    print('\n=== EXAMINANDO FR-MAN-09 (UR) ===')
    wb2 = pyxlsb.open_workbook(r'C:\Users\Quinta do Arrobe\Desktop\DOWNLOADS CHROME\drive-download-20260725T123638Z-1-001\FR-MAN-09 MANUTENÇÃO_05_01_2026_8.xlsb')
    with wb2.get_sheet('UR') as sheet2:
        rows = list(sheet2.rows())
        for r in range(0, 6):
            row_vals = [cell.v for cell in rows[r]]
            non_empty = [(i+1, v) for i, v in enumerate(row_vals) if v is not None]
            print(f'Linha {r+1}: {non_empty[:12]}')

if __name__ == '__main__':
    inspect()
