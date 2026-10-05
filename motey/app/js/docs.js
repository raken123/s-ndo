/* Motey – builds real documents in the browser, no libraries:
 * PDF (text, A4, Helvetica), XLSX and DOCX (Office Open XML in a stored ZIP). */
(function () {
  'use strict';

  /* ---------- ZIP (stored, UTF-8 names) ---------- */
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files, mime) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    const d = new Date();
    const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of files) {
      const name = enc.encode(f.name);
      const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const csize = central.reduce((s, p) => s + p.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, csize, true); e.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: mime || 'application/zip' });
  }

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ---------- PDF ---------- */
  const WIN = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '•': 0x95, '–': 0x96, '—': 0x97, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '™': 0x99 };
  function pdfHex(s) {
    let h = '';
    for (const ch of String(s)) {
      let c = ch.codePointAt(0);
      if (WIN[ch]) c = WIN[ch]; else if (c > 255) c = 0x3F;
      h += c.toString(16).padStart(2, '0');
    }
    return '<' + h + '>';
  }
  function wrap(text, size, width) {
    const max = Math.max(10, Math.floor(width / (size * 0.52)));
    const out = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const w of para.split(/\s+/)) {
        if ((line + ' ' + w).trim().length > max) { if (line) out.push(line); line = w; }
        else line = (line + ' ' + w).trim();
      }
      out.push(line);
    }
    return out;
  }
  /* blocks: [{h1|h2|p|li: text}] */
  function pdf(blocks) {
    const W = 595, H = 842, M = 56, LW = W - 2 * M;
    const pages = [[]];
    let y = H - M;
    const put = (font, size, text, x, gap) => {
      for (const l of wrap(text, size, LW - (x - M))) {
        if (y - size < M) { pages.push([]); y = H - M; }
        y -= size * 1.35;
        pages[pages.length - 1].push(`BT /${font} ${size} Tf ${x} ${y.toFixed(1)} Td ${pdfHex(l)} Tj ET`);
      }
      y -= gap || 0;
    };
    for (const b of blocks) {
      if (b.h1) { put('F2', 20, b.h1, M, 6); pages[pages.length - 1].push(`0.42 0.30 0.96 RG 2 w ${M} ${y.toFixed(1)} m ${W - M} ${y.toFixed(1)} l S`); y -= 10; }
      else if (b.h2) { y -= 6; put('F2', 13, b.h2, M, 2); }
      else if (b.li) put('F1', 11, '• ' + b.li, M + 10, 1);
      else if (b.small) put('F1', 9, b.small, M, 4);
      else put('F1', 11, b.p || '', M, 5);
    }
    const objs = [];
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    const kids = [];
    pages.forEach((ops, i) => {
      const pid = 5 + i * 2, cid = 6 + i * 2;
      const stream = ops.join('\n') + `\nBT /F1 8 Tf ${M} 30 Td ${pdfHex('Skapad av Motey – sida ' + (i + 1) + ' av ' + pages.length)} Tj ET`;
      objs[pid] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${cid} 0 R >>`;
      objs[cid] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
      kids.push(`${pid} 0 R`);
    });
    objs[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
    let out = '%PDF-1.4\n';
    const offs = [];
    for (let i = 1; i < objs.length; i++) { offs[i] = out.length; out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
    const xref = out.length;
    out += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + offs.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return new Blob([out], { type: 'application/pdf' });
  }

  /* ---------- XLSX ---------- */
  function colName(i) { let s = ''; i++; while (i) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; }
  function xlsx(sheetName, rows) {
    const body = rows.map((r, ri) => `<row r="${ri + 1}">` + r.map((v, ci) => {
      const ref = colName(ci) + (ri + 1);
      if (v && typeof v === 'object') {
        return typeof v.n === 'number' ? `<c r="${ref}" s="1"><v>${v.n}</v></c>` : `<c r="${ref}" t="inlineStr" s="1"><is><t>${esc(v.b)}</t></is></c>`;
      }
      if (typeof v === 'number') return `<c r="${ref}"><v>${v}</v></c>`;
      if (v === '' || v == null) return '';
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    }).join('') + '</row>').join('');
    const NS = 'http://schemas.openxmlformats.org';
    return zip([
      { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${NS}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
      { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS}/package/2006/relationships"><Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${NS}/officeDocument/2006/relationships"><sheets><sheet name="${esc(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
      { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS}/package/2006/relationships"><Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${NS}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: 'xl/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${NS}/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>` },
      { name: 'xl/worksheets/sheet1.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NS}/spreadsheetml/2006/main"><cols><col min="1" max="1" width="60" customWidth="1"/><col min="2" max="4" width="18" customWidth="1"/></cols><sheetData>${body}</sheetData></worksheet>` }
    ], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  /* ---------- DOCX ---------- */
  function docx(blocks) {
    const NS = 'http://schemas.openxmlformats.org';
    const para = b => {
      if (b.h1) return `<w:p><w:r><w:rPr><w:b/><w:sz w:val="40"/><w:color w:val="6C4CF5"/></w:rPr><w:t xml:space="preserve">${esc(b.h1)}</w:t></w:r></w:p>`;
      if (b.h2) return `<w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t xml:space="preserve">${esc(b.h2)}</w:t></w:r></w:p>`;
      if (b.li) return `<w:p><w:pPr><w:ind w:left="360"/></w:pPr><w:r><w:t xml:space="preserve">• ${esc(b.li)}</w:t></w:r></w:p>`;
      return `<w:p><w:r><w:rPr>${b.small ? '<w:sz w:val="18"/><w:color w:val="5B5878"/>' : ''}</w:rPr><w:t xml:space="preserve">${esc(b.p || b.small || '')}</w:t></w:r></w:p>`;
    };
    return zip([
      { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${NS}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>` },
      { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS}/package/2006/relationships"><Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
      { name: 'word/document.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${NS}/wordprocessingml/2006/main"><w:body>${blocks.map(para).join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>` }
    ], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  }

  /* ---------- content for a meeting ---------- */
  function amounts(meeting) {
    const rx = /(\d{1,3}(?:[  ]\d{3})+|\d+(?:,\d+)?)\s*(miljoner|miljon|mkr|tkr|kronor|kr|procent|%)/gi;
    const rows = [];
    for (const l of meeting.transcript || []) {
      let m;
      rx.lastIndex = 0;
      while ((m = rx.exec(l.text))) {
        let n = parseFloat(m[1].replace(/[  ]/g, '').replace(',', '.'));
        const unit = m[2].toLowerCase();
        let enhet = 'kr';
        if (/milj|mkr/.test(unit)) n *= 1e6;
        else if (unit === 'tkr') n *= 1e3;
        else if (/procent|%/.test(unit)) enhet = '%';
        rows.push({ text: l.text, who: l.who, n, enhet });
      }
    }
    return rows;
  }

  function reportBlocks(meeting, sum, fileName) {
    const d = new Date(meeting.start).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const b = [
      { h1: fileName.replace(/\.[^.]+$/, '').replace(/_/g, ' ') },
      { small: `${meeting.title} · ${d} · Utkast skapat av Motey utifrån mötet – granska innan det skickas vidare.` },
      { h2: 'Sammanfattning' }, { p: sum.summary }
    ];
    if (sum.points.length) { b.push({ h2: 'Det viktigaste' }); sum.points.forEach(p => b.push({ li: p })); }
    if (sum.decisions.length) { b.push({ h2: 'Beslut' }); sum.decisions.forEach(p => b.push({ li: p })); }
    if (sum.actions.length) { b.push({ h2: 'Att göra' }); sum.actions.forEach(a => b.push({ li: (a.who ? a.who + ': ' : '') + a.what })); }
    const nums = amounts(meeting);
    if (nums.length) { b.push({ h2: 'Siffror från mötet' }); nums.forEach(r => b.push({ li: r.text })); }
    b.push({ h2: 'Deltagare' }, { p: (meeting.attendees || []).join(', ') });
    return b;
  }

  /* Build a draft of a missing file from what was said in the meeting. */
  function draftFor(meeting, sum, fileName) {
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      const nums = amounts(meeting);
      const rows = [
        [{ b: fileName.replace(/\.[^.]+$/, '').replace(/_/g, ' ') }],
        [`${meeting.title} – utkast skapat av Motey`],
        [],
        [{ b: 'Beskrivning' }, { b: 'Värde' }, { b: 'Enhet' }, { b: 'Sagt av' }]
      ];
      nums.forEach(r => rows.push([r.text, r.n, r.enhet, r.who]));
      if (!nums.length) sum.points.forEach(p => rows.push([p]));
      rows.push([], [{ b: 'Att göra' }]);
      sum.actions.forEach(a => rows.push([a.what, '', '', a.who || '']));
      if (ext === 'csv') {
        const csv = rows.map(r => r.map(v => v && typeof v === 'object' ? (v.b || v.n) : v).map(v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
        return { name: fileName, blob: new Blob(['﻿' + csv], { type: 'text/csv' }) };
      }
      return { name: fileName.replace(/\.xls$/i, '.xlsx'), blob: xlsx('Motey', rows) };
    }
    const blocks = reportBlocks(meeting, sum, fileName);
    if (ext === 'docx' || ext === 'doc') return { name: fileName.replace(/\.doc$/i, '.docx'), blob: docx(blocks) };
    if (ext === 'pdf') return { name: fileName, blob: pdf(blocks) };
    // Anything else (pptx, key, …): a PDF with the same base name.
    return { name: fileName.replace(/\.[^.]+$/, '') + '.pdf', blob: pdf(blocks) };
  }

  window.Docs = { zip, pdf, xlsx, docx, draftFor, reportBlocks, amounts, crc32 };
})();
