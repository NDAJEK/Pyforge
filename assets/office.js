/* ============================================================
   Office 实训：浏览器内判定 docx / xlsx
   docx、xlsx 本质都是 ZIP + XML，用 JSZip 解开直接读属性，
   按「采分点」逐条断言，文件不出本机。
   ============================================================ */
(function () {
  'use strict';

  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const SS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const RID = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

  /* ---------------- 任务定义 ---------------- */
  const TASKS = [
    {
      id: 'word-01', kind: 'docx', subject: 'Word',
      title: '长文档排版：员工手册',
      total: 30, minutes: 30,
      source: 'office/task-01/员工手册-素材.docx',
      answer: 'office/task-01/员工手册-参考答案.docx',
      b64Source: 'word-01-source', b64Answer: 'word-01-answer',
      intro: '素材是一份没有任何格式的《员工手册》。请用 Word 打开它，按下面的 10 条要求排版，另存为 .docx 后上传。',
      points: [
        { id: 'w1', score: 5, desc: '标题「员工手册」应用「标题 1」样式', check: c => ({ ok: c.titleStyle, detail: c.titleStyle ? '' : '没有套用「标题 1」样式（当前：' + c.titleStyleName + '）' }) },
        { id: 'w2', score: 2, desc: '标题居中', check: c => ({ ok: c.titleCenter, detail: c.titleCenter ? '' : '标题段落没有居中' }) },
        { id: 'w3', score: 4, desc: '正文中文字体为宋体', check: c => ({ ok: c.fontRatio >= 0.7, detail: c.fontRatio >= 0.7 ? '' : `只有 ${Math.round(c.fontRatio * 100)}% 的正文段落是宋体` }) },
        { id: 'w4', score: 3, desc: '正文字号为小四（12 磅）', check: c => ({ ok: c.sizeRatio >= 0.7, detail: c.sizeRatio >= 0.7 ? '' : `只有 ${Math.round(c.sizeRatio * 100)}% 的正文段落是 12 磅` }) },
        { id: 'w5', score: 3, desc: '正文行距为 1.5 倍', check: c => ({ ok: c.lineRatio >= 0.7, detail: c.lineRatio >= 0.7 ? '' : `只有 ${Math.round(c.lineRatio * 100)}% 的正文段落是 1.5 倍行距` }) },
        { id: 'w6', score: 3, desc: '正文首行缩进 2 字符', check: c => ({ ok: c.indentRatio >= 0.7, detail: c.indentRatio >= 0.7 ? '' : `只有 ${Math.round(c.indentRatio * 100)}% 的正文段落做了首行缩进` }) },
        { id: 'w7', score: 2, desc: '纸张为 A4（21×29.7cm）', check: c => ({ ok: c.a4, detail: c.a4 ? '' : `当前页面 ${c.pageW}×${c.pageH} twips，A4 应为 11906×16838` }) },
        { id: 'w8', score: 2, desc: '上下页边距 2.54 厘米', check: c => ({ ok: c.margin, detail: c.margin ? '' : `当前上下边距 ${c.mt}/${c.mb} twips，应为 1440` }) },
        { id: 'w9', score: 3, desc: '页眉包含文字「员工手册」', check: c => ({ ok: c.header, detail: c.header ? '' : '没有找到包含「员工手册」的页眉' }) },
        { id: 'w10', score: 3, desc: '页脚插入页码域', check: c => ({ ok: c.footer, detail: c.footer ? '' : '页脚里没有页码域（PAGE）' }) }
      ]
    },
    {
      id: 'excel-01', kind: 'xlsx', subject: 'Excel',
      title: '数据加工：销售明细汇总',
      total: 30, minutes: 30,
      source: 'office/task-02/销售数据-素材.xlsx',
      answer: 'office/task-02/销售数据-参考答案.xlsx',
      b64Source: 'excel-01-source', b64Answer: 'excel-01-answer',
      intro: '素材是一张 20 行的销售明细，「金额」列是空的，「部门汇总」表也空着。请用 Excel 完成下面 8 条要求，另存为 .xlsx 后上传。',
      points: [
        { id: 'e1', score: 6, desc: '金额列用公式 =数量×单价 计算', check: c => ({ ok: c.formulaRatio >= 0.9, detail: c.formulaRatio >= 0.9 ? '' : `只有 ${Math.round(c.formulaRatio * 100)}% 的金额单元格是公式（手填数字不给分）` }) },
        { id: 'e2', score: 4, desc: '金额计算结果正确', check: c => ({ ok: c.valueRatio >= 0.9, detail: c.valueRatio >= 0.9 ? '' : `${c.badValues} 个金额与「数量×单价」对不上` }) },
        { id: 'e3', score: 3, desc: '金额列设置为千分位/货币格式', check: c => ({ ok: c.numFmt, detail: c.numFmt ? '' : '金额列没有设置千分位或货币格式（如 #,##0 或 ¥#,##0）' }) },
        { id: 'e4', score: 3, desc: '冻结首行', check: c => ({ ok: c.frozen, detail: c.frozen ? '' : '没有冻结标题行' }) },
        { id: 'e5', score: 3, desc: '为明细表添加自动筛选', check: c => ({ ok: c.filter, detail: c.filter ? '' : '标题行没有启用自动筛选' }) },
        { id: 'e6', score: 3, desc: '按金额从大到小排序', check: c => ({ ok: c.desc, detail: c.desc ? '' : '金额列没有按降序排列' }) },
        { id: 'e7', score: 4, desc: '部门汇总用 SUMIF 公式', check: c => ({ ok: c.sumifRatio >= 0.9, detail: c.sumifRatio >= 0.9 ? '' : `只有 ${Math.round(c.sumifRatio * 100)}% 的汇总单元格用了 SUMIF（手填数字不给分）` }) },
        { id: 'e8', score: 4, desc: '部门汇总结果正确', check: c => ({ ok: c.sumOk, detail: c.sumOk ? '' : '汇总值与明细对不上：' + c.sumDetail }) }
      ]
    },
    {
      id: 'ppt-01', kind: 'pptx', subject: 'PPT',
      title: '演示文稿：年度产品规划',
      total: 20, minutes: 20,
      source: 'office/task-03/产品规划-素材.pptx',
      answer: 'office/task-03/产品规划-参考答案.pptx',
      b64Source: 'ppt-01-source', b64Answer: 'ppt-01-answer',
      intro: '素材是 4:3、宋体、没有切换效果的四页草稿。请把它改成规范的产品汇报：宽屏 16:9、统一字体、标题够大、每页加切换效果，并补一页结尾。',
      points: [
        { id: 'p1', score: 4, desc: '幻灯片尺寸改为 16:9 宽屏', check: c => ({ ok: c.wide, detail: c.wide ? '' : `当前尺寸 ${c.cx}×${c.cy}，16:9 应为 12192000×6858000` }) },
        { id: 'p2', score: 4, desc: '全部文字使用统一字体（微软雅黑）', check: c => ({ ok: c.fontAll, detail: c.fontAll ? '' : `${c.fontBad} 页还在用其他字体` }) },
        { id: 'p3', score: 4, desc: '每页标题字号不小于 40 磅', check: c => ({ ok: c.titleAll, detail: c.titleAll ? '' : `${c.titleBad} 页标题不足 40 磅` }) },
        { id: 'p4', score: 4, desc: '每页都设置了切换效果', check: c => ({ ok: c.transAll, detail: c.transAll ? '' : `${c.transBad} 页没有切换效果` }) },
        { id: 'p5', score: 2, desc: '幻灯片共 5 页', check: c => ({ ok: c.count === 5, detail: c.count === 5 ? '' : `当前 ${c.count} 页` }) },
        { id: 'p6', score: 2, desc: '最后一页内容为「谢谢」', check: c => ({ ok: c.lastThanks, detail: c.lastThanks ? '' : '最后一页没有「谢谢」' }) }
      ]
    }
  ];

  /* ---------------- 取文件 ---------------- */
  function b64ToBuf(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  async function loadBytes(task, kind) {
    const url = kind === 'answer' ? task.answer : task.source;
    try {
      const r = await fetch(url);
      if (r.ok) return await r.arrayBuffer();
    } catch (e) { /* minis:// 等环境走内嵌副本 */ }
    const key = kind === 'answer' ? task.b64Answer : task.b64Source;
    if (window.OFFICE_B64 && window.OFFICE_B64[key]) return b64ToBuf(window.OFFICE_B64[key]);
    throw new Error('取不到文件：当前环境不能 fetch，也没有内嵌副本');
  }

  function downloadSource() {
    try {
      const buf = b64ToBuf(window.OFFICE_B64[CUR.b64Source]);
      const ext = CUR.kind;
      const blob = new Blob([buf], { type: 'application/octet-stream' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = CUR.title.replace(/.*：/, '') + '-素材.' + ext;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast('素材下载已开始');
    } catch (e) {
      toast('当前环境不支持下载，请用电脑打开线上版', 'no');
    }
  }

  /* ================= docx ================= */
  const nsW = (root, tag) => Array.from(root.getElementsByTagNameNS(W, tag));
  const attrW = (el, name) => (el ? el.getAttributeNS(W, name) : null);
  const kid = (el, tag) => (el ? nsW(el, tag)[0] : undefined);

  function firstChild(parent, tag) {
    if (!parent) return null;
    for (const n of parent.childNodes) if (n.nodeType === 1 && n.localName === tag) return n;
    return null;
  }

  function runProp(p, pPr, runRPr, defaults, styles, tag, name) {
    const look = rPr => {
      if (!rPr) return null;
      const e = firstChild(rPr, tag);
      return e ? attrW(e, name) : null;
    };
    let v = look(runRPr);
    if (v) return v;
    v = look(pPr && firstChild(pPr, 'rPr'));
    if (v) return v;
    const ps = pPr && firstChild(pPr, 'pStyle');
    if (ps) {
      const st = styles[attrW(ps, 'val')];
      if (st) { v = look(firstChild(st, 'rPr')); if (v) return v; }
    }
    return look(defaults);
  }

  async function parseDocx(buf) {
    const zip = await JSZip.loadAsync(buf);
    const read = async n => (zip.file(n) ? zip.file(n).async('string') : null);
    const docXml = await read('word/document.xml');
    if (!docXml) throw new Error('这不是一个有效的 .docx 文件');
    const parser = new DOMParser();
    const doc = parser.parseFromString(docXml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('文档结构损坏');

    const stylesXml = await read('word/styles.xml');
    const styles = {};
    let defaults = null;
    if (stylesXml) {
      const sd = parser.parseFromString(stylesXml, 'application/xml');
      nsW(sd, 'style').forEach(st => {
        const id = attrW(st, 'styleId');
        if (id) styles[id] = st;
      });
      const dd = nsW(sd, 'docDefaults')[0];
      if (dd) defaults = firstChild(firstChild(dd, 'rPrDefault'), 'rPr');
    }

    const headers = [], footers = [];
    zip.forEach(path => {
      if (/^word\/header\d*\.xml$/.test(path)) headers.push(path);
      if (/^word\/footer\d*\.xml$/.test(path)) footers.push(path);
    });

    const body = nsW(doc, 'body')[0];
    const paras = nsW(body, 'p');
    if (!paras.length) throw new Error('文档里没有段落');

    const titleP = paras[0];
    const tPpr = firstChild(titleP, 'pPr');
    const tStyle = attrW(firstChild(tPpr, 'pStyle'), 'val') || '';
    const tJc = attrW(firstChild(tPpr, 'jc'), 'val') || '';

    const bodyParas = paras.slice(1);
    const stats = { font: 0, size: 0, line: 0, indent: 0 };
    bodyParas.forEach(p => {
      const pPr = firstChild(p, 'pPr');
      const runs = nsW(p, 'r');
      const runRPr = runs.length ? firstChild(runs[0], 'rPr') : null;

      const ea = runProp(p, pPr, runRPr, defaults, styles, 'rFonts', 'eastAsia')
        || runProp(p, pPr, runRPr, defaults, styles, 'rFonts', 'ascii');
      if (ea === '宋体' || ea === 'SimSun') stats.font++;

      const sz = runProp(p, pPr, runRPr, defaults, styles, 'sz', 'val');
      if (sz === '24') stats.size++;

      const sp = firstChild(pPr, 'spacing');
      if (sp && attrW(sp, 'line') === '360' && (attrW(sp, 'lineRule') || 'auto') === 'auto') stats.line++;

      const ind = firstChild(pPr, 'ind');
      if (ind) {
        const chars = attrW(ind, 'firstLineChars');
        const tw = parseInt(attrW(ind, 'firstLine') || '0', 10);
        if (chars === '200' || tw >= 440) stats.indent++;
      }
    });

    const n = Math.max(1, bodyParas.length);
    const sect = nsW(doc, 'sectPr').pop();
    const pgSz = kid(sect, 'pgSz'), pgMar = kid(sect, 'pgMar');

    let headerText = '';
    for (const h of headers) {
      const x = await read(h);
      if (x) headerText += new DOMParser().parseFromString(x, 'application/xml').documentElement.textContent;
    }
    let footerXml = '';
    for (const f of footers) { const x = await read(f); if (x) footerXml += x; }

    return {
      titleStyle: /^(heading\s*1|1|标题1)$/i.test(tStyle),
      titleStyleName: tStyle || '无样式',
      titleCenter: tJc === 'center',
      fontRatio: stats.font / n, sizeRatio: stats.size / n,
      lineRatio: stats.line / n, indentRatio: stats.indent / n,
      a4: !!pgSz && Math.abs(+attrW(pgSz, 'w') - 11906) < 20 && Math.abs(+attrW(pgSz, 'h') - 16838) < 20,
      pageW: pgSz ? attrW(pgSz, 'w') : '?', pageH: pgSz ? attrW(pgSz, 'h') : '?',
      margin: !!pgMar && Math.abs(+attrW(pgMar, 'top') - 1440) < 20 && Math.abs(+attrW(pgMar, 'bottom') - 1440) < 20,
      mt: pgMar ? attrW(pgMar, 'top') : '?', mb: pgMar ? attrW(pgMar, 'bottom') : '?',
      header: headerText.includes('员工手册'),
      footer: /PAGE/i.test(footerXml)
    };
  }

  /* ================= xlsx ================= */
  async function parseXlsx(buf) {
    const zip = await JSZip.loadAsync(buf);
    const p = new DOMParser();
    const read = async n => (zip.file(n) ? zip.file(n).async('string') : null);
    const wbXml = await read('xl/workbook.xml');
    if (!wbXml) throw new Error('这不是一个有效的 .xlsx 文件');
    const wb = p.parseFromString(wbXml, 'application/xml');
    const relXml = await read('xl/_rels/workbook.xml.rels');
    const relMap = {};
    if (relXml) {
      const rel = p.parseFromString(relXml, 'application/xml');
      Array.from(rel.getElementsByTagName('Relationship')).forEach(r => {
        relMap[r.getAttribute('Id')] = r.getAttribute('Target');
      });
    }
    const sheets = Array.from(wb.getElementsByTagNameNS(SS, 'sheet')).map(s => {
      let t = relMap[s.getAttributeNS(RID, 'id')] || '';
      if (t.startsWith('/')) t = t.slice(1);
      else if (!t.startsWith('xl/')) t = 'xl/' + t;
      return { name: s.getAttribute('name'), path: t };
    });

    /* 共享字符串 */
    const sst = [];
    const sstXml = await read('xl/sharedStrings.xml');
    if (sstXml) {
      const d = p.parseFromString(sstXml, 'application/xml');
      Array.from(d.getElementsByTagNameNS(SS, 'si')).forEach(si => {
        sst.push(Array.from(si.getElementsByTagNameNS(SS, 't')).map(t => t.textContent).join(''));
      });
    }

    /* 数字格式 */
    const numFmts = {}, xfs = [];
    const stXml = await read('xl/styles.xml');
    if (stXml) {
      const d = p.parseFromString(stXml, 'application/xml');
      Array.from(d.getElementsByTagNameNS(SS, 'numFmt')).forEach(nf => {
        numFmts[nf.getAttribute('numFmtId')] = nf.getAttribute('formatCode');
      });
      Array.from(d.getElementsByTagNameNS(SS, 'cellXfs')[0]?.getElementsByTagNameNS(SS, 'xf') || []).forEach(xf => xfs.push(xf));
    }
    const BUILTIN = { '0': 'General', '3': '#,##0', '4': '#,##0.00', '44': '#,##0.00' };
    const fmtOf = sIdx => {
      if (sIdx === null || sIdx === undefined) return '';
      const xf = xfs[+sIdx];
      if (!xf) return '';
      const id = xf.getAttribute('numFmtId');
      return numFmts[id] || BUILTIN[id] || '';
    };

    const readSheet = async path => {
      const x = await read(path);
      if (!x) throw new Error('找不到工作表：' + path);
      const d = p.parseFromString(x, 'application/xml');
      const map = {};
      Array.from(d.getElementsByTagNameNS(SS, 'c')).forEach(c => {
        const ref = c.getAttribute('r');
        const f = c.getElementsByTagNameNS(SS, 'f')[0];
        const v = c.getElementsByTagNameNS(SS, 'v')[0];
        const is = c.getElementsByTagNameNS(SS, 'is')[0];
        let val = null;
        if (is) val = is.textContent;
        else if (v) val = v.textContent;
        if (c.getAttribute('t') === 's' && val !== null) val = sst[+val];
        map[ref] = { f: f ? f.textContent : null, v: val, s: c.getAttribute('s') };
      });
      return { map, xml: x };
    };

    const detail = sheets.find(s => /明细|销售/.test(s.name)) || sheets[0];
    const summary = sheets.find(s => s !== detail && /汇总|部门/.test(s.name)) || sheets[1];
    const d1 = await readSheet(detail.path);
    const d2 = summary ? await readSheet(summary.path) : { map: {}, xml: '' };

    /* 明细行 */
    const rows = [];
    for (let i = 2; i <= 200; i++) {
      const a = d1.map['A' + i], g = d1.map['G' + i];
      if (!a && !g) continue;
      rows.push({
        i, dept: (d1.map['C' + i] || {}).v || '',
        qty: num((d1.map['E' + i] || {}).v),
        price: num((d1.map['F' + i] || {}).v),
        amount: num(g && g.v),
        formula: g && g.f, fmt: fmtOf(g && g.s)
      });
    }
    if (!rows.length) throw new Error('明细表里没读到数据行');

    const withFormula = rows.filter(r => r.formula && /E\d+\s*\*\s*F\d+/i.test(r.formula.replace(/\$/g, '')));
    const valueOk = rows.filter(r => r.amount !== null && Math.abs(r.amount - r.qty * r.price) < 0.5);
    const amounts = rows.map(r => r.amount).filter(v => v !== null);
    const desc = amounts.length > 1 && amounts.every((v, i) => i === 0 || amounts[i - 1] >= v);
    const fmtOk = rows.filter(r => /#,##0|¥|\$|￥/.test(r.fmt)).length >= rows.length * 0.8;

    /* 汇总表 */
    const sRows = [];
    for (let i = 2; i <= 20; i++) {
      const a = d2.map['A' + i], b = d2.map['B' + i];
      if (!a || !a.v) continue;
      sRows.push({ dept: a.v, val: num(b && b.v), formula: b && b.f });
    }
    const sumifOk = sRows.length > 0 && sRows.filter(r => r.formula && /SUMIF/i.test(r.formula)).length >= sRows.length * 0.9;

    const agg = {};
    rows.forEach(r => { if (r.amount !== null && r.dept) agg[r.dept] = (agg[r.dept] || 0) + r.amount; });
    let bad = [];
    sRows.forEach(r => {
      if (r.val === null || Math.abs(r.val - (agg[r.dept] || 0)) > 1) bad.push(r.dept);
    });
    const sumOk = sRows.length >= 2 && bad.length === 0;

    return {
      formulaRatio: withFormula.length / rows.length,
      valueRatio: valueOk.length / rows.length,
      badValues: rows.length - valueOk.length,
      numFmt: fmtOk,
      frozen: /state="frozen"/.test(d1.xml),
      filter: /<autoFilter/.test(d1.xml),
      desc,
      sumifRatio: sRows.length ? sRows.filter(r => r.formula && /SUMIF/i.test(r.formula)).length / sRows.length : 0,
      sumOk,
      sumDetail: bad.length ? bad.join('、') + ' 的汇总对不上' : '汇总表是空的'
    };
  }

  const num = v => (v === null || v === undefined || v === '' ? null : Number(v));

  /* ================= pptx ================= */
  async function parsePptx(buf) {
    const zip = await JSZip.loadAsync(buf);
    const read = async n => (zip.file(n) ? zip.file(n).async('string') : null);
    const pres = await read('ppt/presentation.xml');
    if (!pres) throw new Error('这不是一个有效的 .pptx 文件');
    const m = pres.match(/<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
    const cx = m ? +m[1] : 0, cy = m ? +m[2] : 0;

    const names = Object.keys(zip.files)
      .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => (+a.match(/slide(\d+)/)[1]) - (+b.match(/slide(\d+)/)[1]));

    const slides = [];
    for (const n of names) {
      const x = await read(n);
      const t = x.match(/<p:ph[^>]*type="(?:title|ctrTitle)"[^>]*>[\s\S]{0,2500}?sz="(\d+)"/);
      const texts = Array.from(x.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)).map(m2 => m2[1]);
      slides.push({
        xml: x, titleSz: t ? +t[1] : 0,
        transition: /<p:transition/.test(x),
        font: /微软雅黑/.test(x),
        text: texts.join(' ')
      });
    }
    return { cx, cy, slides };
  }

  /* ---------------- 判分 ---------------- */
  async function judge(buffer, task) {
    let ctx;
    if (task.kind === 'xlsx') ctx = await parseXlsx(buffer);
    else if (task.kind === 'pptx') {
      const p = await parsePptx(buffer);
      const badFont = p.slides.filter(s => !s.font).length;
      const badTitle = p.slides.filter(s => s.titleSz < 4000).length;
      const badTrans = p.slides.filter(s => !s.transition).length;
      const last = p.slides[p.slides.length - 1];
      ctx = {
        cx: p.cx, cy: p.cy,
        wide: Math.abs(p.cx - 12192000) < 3000 && Math.abs(p.cy - 6858000) < 3000,
        fontAll: p.slides.length > 0 && badFont === 0, fontBad: badFont,
        titleAll: p.slides.length > 0 && badTitle === 0, titleBad: badTitle,
        transAll: p.slides.length > 0 && badTrans === 0, transBad: badTrans,
        count: p.slides.length,
        lastThanks: !!last && /谢谢/.test(last.text)
      };
    } else ctx = await parseDocx(buffer);
    const results = task.points.map(pt => {
      const r = pt.check(ctx);
      return { id: pt.id, desc: pt.desc, score: pt.score, ok: !!r.ok, detail: r.detail || '' };
    });
    const score = results.filter(r => r.ok).reduce((a, b) => a + b.score, 0);
    return { score, total: task.total, results };
  }

  /* ---------------- 界面 ---------------- */
  let CUR = TASKS[0];

  function openTask(id) {
    CUR = TASKS.find(t => t.id === id) || TASKS[0];
    renderOffice();
  }

  function renderOffice() {
    const done = (S.office && S.office[CUR.id]) || null;
    main().innerHTML = `<div class="page wide">
      <h1>Office 实训</h1>
      <div class="sub">下载素材 → 在电脑上用 Office 2016 完成 → 上传判分。文件只在你本机解析，不会上传。</div>

      <div class="row-actions" style="margin-bottom:16px">
        ${TASKS.map(t => `<button class="btn ${t.id === CUR.id ? 'primary' : ''}" onclick="OFFICE.open('${t.id}')">${t.subject} · ${esc(t.title.replace(/.*：/, ''))}</button>`).join('')}
      </div>

      <div class="panel" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
          <h3 style="margin:0;font-size:16px;color:var(--ink)">${esc(CUR.title)}</h3>
          <span class="tag">${CUR.subject} · ${CUR.total} 分 · 建议 ${CUR.minutes} 分钟</span>
          ${done ? `<span class="chip ok">上次 ${done.score}/${CUR.total}</span>` : ''}
        </div>
        <div style="font-size:13.5px;color:var(--muted);line-height:1.75;margin-bottom:16px">${esc(CUR.intro)}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn" onclick="OFFICE.download()">下载素材</button>
          <button class="btn primary" onclick="document.getElementById('taskFile').click()">上传做完的文件</button>
          <button class="btn ghost" onclick="OFFICE.checkAnswer()">判一下参考答案</button>
          <input type="file" id="taskFile" accept=".docx,.xlsx,.pptx" style="display:none">
        </div>
      </div>

      <div class="panel" style="margin-bottom:16px">
        <h3>采分点（${CUR.points.length} 条，共 ${CUR.total} 分）</h3>
        <div id="pointList">${CUR.points.map(p => `
          <div class="pt" id="pt-${p.id}">
            <span class="st">·</span>
            <span class="nm">${esc(p.desc)}</span>
            <span class="sc">${p.score} 分</span>
          </div>`).join('')}</div>
      </div>

      <div class="panel" id="resultBox" style="display:none"></div>
    </div>`;

    const input = document.getElementById('taskFile');
    input.value = '';
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const box = document.getElementById('resultBox');
      box.style.display = 'block';
      box.innerHTML = '<span style="color:var(--muted);font-size:13px">正在解析…</span>';
      try {
        const ext = f.name.split('.').pop().toLowerCase();
        if (CUR.kind === 'xlsx' && ext !== 'xlsx') throw new Error('这道题要上传 .xlsx 文件');
        if (CUR.kind === 'docx' && ext !== 'docx') throw new Error('这道题要上传 .docx 文件');
        if (CUR.kind === 'pptx' && ext !== 'pptx') throw new Error('这道题要上传 .pptx 文件');
        showResult(await judge(await f.arrayBuffer(), CUR));
      } catch (e) {
        box.innerHTML = `<span style="color:var(--bad)">判定失败：${esc(e.message)}</span>`;
      }
    });
  }

  function showResult(r) {
    const box = document.getElementById('resultBox');
    box.style.display = 'block';
    box.innerHTML = `
      <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px">
        <div style="font-size:40px;font-weight:750;letter-spacing:-1px">${r.score}</div>
        <div style="color:var(--muted);font-size:15px">/ ${r.total} 分</div>
        <div style="margin-left:auto;font-size:13px;color:${r.score >= r.total * 0.6 ? 'var(--ok)' : 'var(--bad)'}">
          ${r.score >= r.total * 0.6 ? '及格线以上' : '还差一点'}
        </div>
      </div>
      <div class="tests" style="margin-top:12px">
        ${r.results.map(x => `<div class="tcase ${x.ok ? 'p' : 'f'}">
          <span class="st">${x.ok ? '✓' : '✗'}</span>
          <span class="nm" style="width:auto;flex:1">${esc(x.desc)}</span>
          <span class="dt">${x.ok ? x.score + ' 分' : esc(x.detail)}</span>
        </div>`).join('')}
      </div>`;

    r.results.forEach(x => {
      const el = document.getElementById('pt-' + x.id);
      if (!el) return;
      el.classList.toggle('p', x.ok);
      el.classList.toggle('f', !x.ok);
      el.querySelector('.st').textContent = x.ok ? '✓' : '✗';
    });

    S.office = S.office || {};
    S.office[CUR.id] = { score: r.score, ts: Date.now() };
    save();
  }

  async function checkAnswer() {
    const box = document.getElementById('resultBox');
    box.style.display = 'block';
    box.innerHTML = '<span style="color:var(--muted);font-size:13px">正在判参考答案…</span>';
    try {
      showResult(await judge(await loadBytes(CUR, 'answer'), CUR));
    } catch (e) {
      box.innerHTML = `<span style="color:var(--bad)">读取参考答案失败：${esc(e.message)}</span>`;
    }
  }

  window.OFFICE = { tasks: TASKS, checkAnswer, judge, download: downloadSource, open: openTask };
  window.renderOffice = renderOffice;
})();
