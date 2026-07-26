import openpyxl
import pyxlsb

def inspect_pm():
    wb = openpyxl.load_workbook(r'C:\Users\Quinta do Arrobe\Desktop\DOWNLOADS CHROME\drive-download-20260725T123638Z-1-001\PL-MAN-01 PLANO MANUTENÇÃO_2026.xlsx', data_only=True)
    sheet = wb['PM']
    header = [cell for cell in next(sheet.iter_rows(min_row=1, max_row=1, values_only=True)) if cell is not None]
    print('=== COLUNAS DO PLANO DE MANUTENÇÃO (PM) ===')
    for i, col in enumerate(header, 1):
        print(f'{i}. {col}')

def inspect_ur():
    wb = pyxlsb.open_workbook(r'C:\Users\Quinta do Arrobe\Desktop\DOWNLOADS CHROME\drive-download-20260725T123638Z-1-001\FR-MAN-09 MANUTENÇÃO_05_01_2026_8.xlsb')
    with wb.get_sheet('UR') as sheet:
        rows = list(sheet.rows())
        header = [cell.v for cell in rows[0] if cell.v is not None]
        print('\n=== COLUNAS DO HISTÓRICO / UR ===')
        for i, col in enumerate(header, 1):
            print(f'{i}. {col}')

if __name__ == '__main__':
    inspect_pm()
    inspect_ur()
