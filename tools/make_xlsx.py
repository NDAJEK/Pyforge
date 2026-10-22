#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 Excel 实训素材与参考答案（纯标准库，手写 OOXML）"""
import os, zipfile
from xml.sax.saxutils import escape

NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

DEPTS = ['销售一部', '销售二部', '销售三部']
PRODS = ['笔记本电脑', '显示器', '打印机']

# ---------- 构造数据（固定，可复现） ----------
def build_rows():
    rows = []
    for i in range(20):
        dept = DEPTS[i % 3]
        prod = PRODS[i % 3]
        qty = 6 + (i * 7) % 37
        price = 320 + (i * 137) % 1400
        rows.append({'no': i + 1, 'date': f'2026-{3 + i % 6:02d}-{1 + i % 27:02d}',
                     'dept': dept, 'prod': prod, 'qty': qty, 'price': price,
                     'amount': qty * price})
    return rows

ROWS = build_rows()
TOTAL = sum(r['amount'] for r in ROWS)
DEPT_SUM = {d: sum(r['amount'] for r in ROWS if r['dept'] == d) for d in DEPTS}


def col(i):
    s = ''
    while i > 0:
        i, rem = divmod(i - 1, 26)
        s = chr(65 + rem) + s
    return s


def cell(ref, value=None, formula=None, style=None, inline=None):
    s = f' s="{style}"' if style else ''
    if inline is not None:
        return f'<c r="{ref}"{s} t="inlineStr"><is><t>{escape(inline)}</t></is></c>'
    if formula is not None:
        v = '' if value is None else f'<v>{value}</v>'
        return f'<c r="{ref}"{s}><f>{escape(formula)}</f>{v}</c>'
    if value is None:
        return f'<c r="{ref}"{s}/>'
    return f'<c r="{ref}"{s}><v>{value}</v></c>'


def sheet_xml(body, extra=''):
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="{NS}" xmlns:r="{R}">
<dimension ref="A1:G21"/>
<sheetViews><sheetView workbookViewId="0">{extra}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<sheetData>{body}</sheetData>
</worksheet>'''


HEAD = ['序号', '日期', '部门', '产品', '数量', '单价', '金额']


def detail_sheet(rows, finished):
    out = ['<row r="1">' + ''.join(cell(col(i + 1) + '1', inline=h, style=2) for i, h in enumerate(HEAD)) + '</row>']
    for idx, r in enumerate(rows, start=2):
        c = [cell(f'A{idx}', r['no']),
             cell(f'B{idx}', inline=r['date']),
             cell(f'C{idx}', inline=r['dept']),
             cell(f'D{idx}', inline=r['prod']),
             cell(f'E{idx}', r['qty']),
             cell(f'F{idx}', r['price'])]
        if finished:
            c.append(cell(f'G{idx}', r['amount'], formula=f'E{idx}*F{idx}', style=1))
        else:
            c.append(cell(f'G{idx}'))
        out.append(f'<row r="{idx}">' + ''.join(c) + '</row>')
    return ''.join(out)


def summary_sheet(finished):
    out = ['<row r="1">' + cell('A1', inline='部门', style=2) + cell('B1', inline='销售额', style=2) + '</row>']
    for i, d in enumerate(DEPTS, start=2):
        if finished:
            f = f"SUMIF('销售明细'!$C$2:$C$21,A{i},'销售明细'!$G$2:$G$21)"
            out.append(f'<row r="{i}">' + cell(f'A{i}', inline=d) +
                       cell(f'B{i}', DEPT_SUM[d], formula=f, style=1) + '</row>')
        else:
            out.append(f'<row r="{i}">' + cell(f'A{i}', inline=d) + cell(f'B{i}') + '</row>')
    return ''.join(out)


CONTENT_TYPES = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>'''

RELS = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="{R}/officeDocument" Target="xl/workbook.xml"/>
</Relationships>'''

WB = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="{NS}" xmlns:r="{R}">
<sheets>
<sheet name="销售明细" sheetId="1" r:id="rId1"/>
<sheet name="部门汇总" sheetId="2" r:id="rId2"/>
</sheets>
</workbook>'''

WB_RELS = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="{R}/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="{R}/worksheet" Target="worksheets/sheet2.xml"/>
<Relationship Id="rId3" Type="{R}/styles" Target="styles.xml"/>
</Relationships>'''

STYLES = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="{NS}">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts>
<fonts count="2">
<font><sz val="11"/><name val="等线"/></font>
<font><b/><sz val="11"/><name val="等线"/></font>
</fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="常规" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>'''


def build(path, finished):
    rows = sorted(ROWS, key=lambda r: -r['amount']) if finished else ROWS
    s1 = sheet_xml(detail_sheet(rows, finished))
    if finished:
        # 冻结首行 + 自动筛选
        s1 = s1.replace('<sheetView workbookViewId="0"></sheetView>',
                        '<sheetView workbookViewId="0">'
                        '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
                        '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>'
                        '</sheetView>')
        s1 = s1.replace('<sheetData>', '<autoFilter ref="A1:G21"/><sheetData>')
    s2 = sheet_xml(summary_sheet(finished))

    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', CONTENT_TYPES)
        z.writestr('_rels/.rels', RELS)
        z.writestr('xl/workbook.xml', WB)
        z.writestr('xl/_rels/workbook.xml.rels', WB_RELS)
        z.writestr('xl/styles.xml', STYLES)
        z.writestr('xl/worksheets/sheet1.xml', s1)
        z.writestr('xl/worksheets/sheet2.xml', s2)
    print('生成', path, os.path.getsize(path), '字节')


if __name__ == '__main__':
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    d = os.path.join(base, 'office', 'task-02')
    os.makedirs(d, exist_ok=True)
    build(os.path.join(d, '销售数据-素材.xlsx'), False)
    build(os.path.join(d, '销售数据-参考答案.xlsx'), True)
    print('合计', TOTAL, '部门:', DEPT_SUM)
