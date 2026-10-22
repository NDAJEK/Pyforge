#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成二级 Office 实训素材与参考答案（纯标准库，手写 OOXML）"""
import os, zipfile

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

TITLE = "员工手册"
BODY = [
    ("第一章  总则", "本手册适用于公司全体在职员工，用于明确基本行为准则与日常管理要求。"),
    ("", "员工入职时应认真阅读本手册，并在人事部门留档确认。手册内容会根据公司发展适时修订。"),
    ("第二章  考勤制度", "公司实行标准工时制，工作时间为上午九点至下午六点，午休一小时。"),
    ("", "员工应按时上下班，迟到或早退超过三十分钟的，按半天事假处理。"),
    ("", "因公外出需提前在系统中提交申请，由直属主管审批。"),
    ("第三章  请假流程", "请假须提前一个工作日在系统提交申请，说明事由与时长。"),
    ("", "病假需提供二级以上医院出具的病假证明，突发情况可事后补交。"),
    ("", "年假按工龄计算，入职满一年可享受五天带薪年假。"),
    ("第四章  保密要求", "员工对在工作中接触到的客户信息、技术资料负有保密义务。"),
    ("", "未经授权不得将公司资料带离办公场所，离职后保密义务继续有效。"),
    ("附录  联系方式", "人事部：分机 8001，邮箱 hr@example.com。"),
    ("", "行政部：分机 8002，负责办公用品申领与会议室预定。"),
]

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def run(text, bold=False, size=None, font=None, underline=False):
    rpr = ""
    if font:
        rpr += f'<w:rFonts w:ascii="{font}" w:hAnsi="{font}" w:eastAsia="{font}"/>'
    if bold:
        rpr += "<w:b/>"
    if underline:
        rpr += '<w:u w:val="single"/>'
    if size:
        rpr += f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>'
    rpr = f"<w:rPr>{rpr}</w:rPr>" if rpr else ""
    return f'<w:r>{rpr}<w:t xml:space="preserve">{esc(text)}</w:t></w:r>'

def para(text, style=None, center=False, bold=False, size=None, font=None,
         line=None, first_line_chars=None):
    ppr = ""
    if style:
        ppr += f'<w:pStyle w:val="{style}"/>'
    if center:
        ppr += '<w:jc w:val="center"/>'
    if line:
        ppr += f'<w:spacing w:line="{line}" w:lineRule="auto"/>'
    if first_line_chars:
        ppr += f'<w:ind w:firstLineChars="{first_line_chars}"/>'
    ppr = f"<w:pPr>{ppr}</w:pPr>" if ppr else ""
    return f"<w:p>{ppr}{run(text, bold, size, font)}</w:p>"

CONTENT_TYPES = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>'''

RELS = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="{R}/officeDocument" Target="word/document.xml"/>
</Relationships>'''

DOC_RELS = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="{R}/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="{R}/header" Target="header1.xml"/>
<Relationship Id="rId3" Type="{R}/footer" Target="footer1.xml"/>
</Relationships>'''

def styles_xml(font, size):
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="{W}">
<w:docDefaults>
  <w:rPrDefault><w:rPr>
    <w:rFonts w:ascii="{font}" w:hAnsi="{font}" w:eastAsia="{font}"/>
    <w:sz w:val="{size}"/><w:szCs w:val="{size}"/>
  </w:rPr></w:rPrDefault>
  <w:pPrDefault><w:pPr><w:spacing w:after="0"/></w:pPr></w:pPrDefault>
</w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1">
  <w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
  <w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr>
  <w:rPr><w:b/><w:sz w:val="32"/></w:rPr>
</w:style>
</w:styles>'''

HEADER = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="{W}"><w:p><w:pPr><w:jc w:val="right"/></w:pPr>{run("员工手册", size=18)}</w:p></w:hdr>'''

FOOTER = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="{W}"><w:p><w:pPr><w:jc w:val="center"/></w:pPr>
<w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple>
</w:p></w:ftr>'''

def build(path, formatted):
    if formatted:
        parts = [para(TITLE, style="Heading1", center=True)]
        for head, text in BODY:
            if head:
                parts.append(para(head, bold=True, font="宋体", size=24,
                                  line=360, first_line_chars=200 if False else None))
                parts.append(para(text, font="宋体", size=24, line=360, first_line_chars=200))
            else:
                parts.append(para(text, font="宋体", size=24, line=360, first_line_chars=200))
        sect = f'''<w:sectPr>
<w:headerReference w:type="default" r:id="rId2"/>
<w:footerReference w:type="default" r:id="rId3"/>
<w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800" w:header="851" w:footer="992" w:gutter="0"/>
</w:sectPr>'''
        font, size = "宋体", 24
    else:
        parts = [para(TITLE)]
        for head, text in BODY:
            if head:
                parts.append(para(head))
            parts.append(para(text))
        # 素材故意用 B5 纸 + 2cm 边距，让「页面设置」必须动手改
        sect = f'''<w:sectPr>
<w:pgSz w:w="9979" w:h="14175"/>
<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="851" w:footer="992" w:gutter="0"/>
</w:sectPr>'''
        font, size = "等线", 22

    doc = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="{W}" xmlns:r="{R}"><w:body>{''.join(parts)}{sect}</w:body></w:document>'''

    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", CONTENT_TYPES)
        z.writestr("_rels/.rels", RELS)
        if formatted:
            z.writestr("word/_rels/document.xml.rels", DOC_RELS)
        else:
            z.writestr("word/_rels/document.xml.rels", f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="{R}/styles" Target="styles.xml"/>
</Relationships>''')
        z.writestr("word/document.xml", doc)
        z.writestr("word/styles.xml", styles_xml(font, size))
        if formatted:
            z.writestr("word/header1.xml", HEADER)
            z.writestr("word/footer1.xml", FOOTER)
    print("生成", path, os.path.getsize(path), "字节")

if __name__ == "__main__":
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    d = os.path.join(base, "office", "task-01")
    os.makedirs(d, exist_ok=True)
    build(os.path.join(d, "员工手册-素材.docx"), False)
    build(os.path.join(d, "员工手册-参考答案.docx"), True)
