#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 office 目录下的 docx 内嵌成 base64，供 minis:// 等无法 fetch 的场景使用"""
import base64, json, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = {
    'word-01-source': 'office/task-01/员工手册-素材.docx',
    'word-01-answer': 'office/task-01/员工手册-参考答案.docx',
    'excel-01-source': 'office/task-02/销售数据-素材.xlsx',
    'excel-01-answer': 'office/task-02/销售数据-参考答案.xlsx',
    'ppt-01-source': 'office/task-03/产品规划-素材.pptx',
    'ppt-01-answer': 'office/task-03/产品规划-参考答案.pptx',
}

out = {}
for k, rel in FILES.items():
    p = os.path.join(BASE, rel)
    with open(p, 'rb') as f:
        out[k] = base64.b64encode(f.read()).decode()

js = "/* 由 tools/embed_office.py 生成，勿手改：把 docx 内嵌为 base64 */\n" \
     "window.OFFICE_B64 = " + json.dumps(out, ensure_ascii=False, indent=0) + ";\n"
path = os.path.join(BASE, 'assets', 'office-assets.js')
with open(path, 'w') as f:
    f.write(js)
print('写入', path, os.path.getsize(path), '字节')
