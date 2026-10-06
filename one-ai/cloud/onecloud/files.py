"""Builds real files from what the agents write: PDF, Word, Excel and
PowerPoint documents, WAV and MIDI music, GLB 3D models, ZIP archives and
e-mails. Standard library only, so the server stays dependency-free.
"""

import email.message
import email.policy
import html
import io
import json
import math
import random
import re
import struct
import wave
import zipfile
from xml.sax.saxutils import escape as xml_escape

MIME = {
    "txt": "text/plain", "md": "text/markdown", "csv": "text/csv", "tsv": "text/tab-separated-values",
    "json": "application/json", "html": "text/html", "htm": "text/html", "css": "text/css",
    "js": "text/javascript", "mjs": "text/javascript", "ts": "text/plain", "py": "text/x-python",
    "xml": "application/xml", "svg": "image/svg+xml", "yaml": "text/yaml", "yml": "text/yaml",
    "pdf": "application/pdf", "zip": "application/zip", "png": "image/png", "jpg": "image/jpeg",
    "jpeg": "image/jpeg", "webp": "image/webp", "gif": "image/gif", "mp4": "video/mp4", "mp3": "audio/mpeg",
    "wav": "audio/wav", "mid": "audio/midi", "glb": "model/gltf-binary", "eml": "message/rfc822",
    "ics": "text/calendar", "sql": "text/plain", "sh": "text/x-shellscript",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}


def mime_for(name):
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    return MIME.get(ext, "text/plain" if ext else "application/octet-stream")


def safe_name(name, default="fil.txt"):
    """A file name without folders or odd characters (å, ä, ö are fine)."""
    n = re.sub(r"[^\w.\- ()]+", "-", str(name or "").replace("\\", "/").split("/")[-1], flags=re.UNICODE).strip(" .-")
    return (n or default)[-100:]


def safe_path(name, default="fil.txt"):
    """Like safe_name but keeps sub-folders (for ZIP archives)."""
    parts = [safe_name(p, "") for p in str(name or "").replace("\\", "/").split("/") if p not in ("", ".", "..")]
    parts = [p for p in parts if p]
    return "/".join(parts) or default


def _inline(text):
    """Markdown inline markup to plain text."""
    text = re.sub(r"!\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1 (\2)", text)
    return re.sub(r"(\*\*|__|`|~~)", "", text)


def markdown_blocks(md):
    """Markdown as (kind, text) blocks: h1, h2, h3, li, p, code, gap."""
    out, code = [], None
    for line in md.replace("\r\n", "\n").split("\n"):
        if line.strip().startswith("```"):
            if code is None:
                code = []
            else:
                out.extend(("code", c) for c in code)
                code = None
            continue
        if code is not None:
            code.append(line.rstrip())
            continue
        s = line.strip()
        if not s:
            out.append(("gap", ""))
        elif re.match(r"^#{1,6}\s", s):
            level = min(3, len(s) - len(s.lstrip("#")))
            out.append(("h%d" % level, _inline(s.lstrip("#").strip())))
        elif re.match(r"^[-*+]\s", s):
            out.append(("li", _inline(s[2:].strip())))
        elif re.match(r"^\|?\s*:?-{3,}", s):
            continue  # table separator row
        elif s.startswith("|"):
            out.append(("p", "   ".join(c.strip() for c in _inline(s).strip("|").split("|"))))
        else:
            out.append(("p", _inline(s)))
    if code:
        out.extend(("code", c) for c in code)
    return out


# --- PDF ---------------------------------------------------------------------

def _wrap(text, per_line):
    lines, cur = [], ""
    for w in text.split(" "):
        while len(w) > per_line:
            if cur:
                lines.append(cur)
                cur = ""
            lines.append(w[:per_line])
            w = w[per_line:]
        if cur and len(cur) + 1 + len(w) > per_line:
            lines.append(cur)
            cur = w
        else:
            cur = cur + " " + w if cur else w
    lines.append(cur)
    return lines


def pdf_from_markdown(md, title="Dokument"):
    """A4 PDF with headings, paragraphs, lists and code, using the standard
    Helvetica and Courier fonts (Latin-1 text, so å, ä, ö work)."""
    W, H, M = 595, 842, 56
    styles = {"h1": ("F2", 20, 10), "h2": ("F2", 15, 8), "h3": ("F2", 12.5, 6), "p": ("F1", 11, 4),
              "li": ("F1", 11, 2), "code": ("F3", 9.5, 0)}
    pages, ops, y = [], [], H - M

    def new_page():
        nonlocal ops, y
        if ops:
            pages.append(ops)
        ops, y = [], H - M

    def enc(s):
        s = s.encode("cp1252", "replace").decode("latin-1")
        return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    for kind, text in markdown_blocks(md):
        if kind == "gap":
            y -= 6
            continue
        font, size, after = styles[kind]
        indent = 14 if kind == "li" else 0
        width = 0.6 if font == "F3" else (0.56 if font == "F2" else 0.5)
        per_line = max(10, int((W - 2 * M - indent) / (size * width)))
        lines = _wrap(("• " + text) if kind == "li" else text, per_line)
        if kind.startswith("h"):
            y -= size * 0.6
        for ln in lines:
            if y - size < M:
                new_page()
            y -= size * 1.35
            ops.append("BT /%s %.1f Tf %d %.1f Td (%s) Tj ET" % (font, size, M + indent, y, enc(ln)))
        y -= after
    new_page()

    objs = ["<< /Type /Catalog /Pages 2 0 R >>", None,
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
            "<< /Title (%s) /Producer (One AI) >>" % enc(title)]
    kids = []
    for p in pages:
        stream = "\n".join(p).encode("latin-1")
        objs.append("<< /Length %d >>\nstream\n%s\nendstream" % (len(stream), stream.decode("latin-1")))
        objs.append("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] /Contents %d 0 R "
                    "/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> >>" % (W, H, len(objs)))
        kids.append("%d 0 R" % len(objs))
    objs[1] = "<< /Type /Pages /Kids [%s] /Count %d >>" % (" ".join(kids), len(kids))
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(out.tell())
        out.write(("%d 0 obj\n%s\nendobj\n" % (i, o)).encode("latin-1"))
    xref = out.tell()
    out.write(("xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)).encode())
    for off in offsets:
        out.write(("%010d 00000 n \n" % off).encode())
    out.write(("trailer\n<< /Size %d /Root 1 0 R /Info 6 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)).encode())
    return out.getvalue()


# --- Word ----------------------------------------------------------------------

def _zip(entries):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in entries:
            z.writestr(name, data)
    return buf.getvalue()


def _runs(text, size=None, bold=False, font=None):
    """Word runs, with **bold** spans."""
    out = []
    for i, piece in enumerate(re.split(r"\*\*(.+?)\*\*", text)):
        if not piece:
            continue
        props = ("<w:b/>" if bold or i % 2 else "") + (('<w:rFonts w:ascii="%s" w:hAnsi="%s"/>' % (font, font)) if font else "") \
            + (('<w:sz w:val="%d"/>' % (size * 2)) if size else "")
        out.append('<w:r>%s<w:t xml:space="preserve">%s</w:t></w:r>' % (
            "<w:rPr>%s</w:rPr>" % props if props else "", xml_escape(re.sub(r"(__|`|~~)", "", piece))))
    return "".join(out)


def docx_from_markdown(md):
    body = []
    for kind, text in markdown_blocks(re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1 (\2)", md)):
        if kind == "gap":
            continue
        if kind in ("h1", "h2", "h3"):
            size = {"h1": 20, "h2": 16, "h3": 13}[kind]
            body.append('<w:p><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>%s</w:p>' % _runs(text, size, True))
        elif kind == "li":
            body.append('<w:p><w:pPr><w:ind w:left="360" w:hanging="240"/></w:pPr>%s</w:p>' % _runs("• " + text, 11))
        elif kind == "code":
            body.append('<w:p><w:pPr><w:spacing w:after="0"/></w:pPr>%s</w:p>' % _runs(text, 10, font="Consolas"))
        else:
            body.append('<w:p><w:pPr><w:spacing w:after="160"/></w:pPr>%s</w:p>' % _runs(text, 11))
    doc = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
           '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>%s'
           '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" '
           'w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>') % "".join(body)
    return _zip([
        ("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
         '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
         '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
         '<Default Extension="xml" ContentType="application/xml"/>'
         '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
         '</Types>'),
        ("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
         '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
         '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
         '</Relationships>'),
        ("word/document.xml", doc),
    ])


# --- Excel ---------------------------------------------------------------------

def _col(i):
    s = ""
    i += 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


def xlsx_from_csv(text, sheet="Blad1"):
    """A workbook from CSV (comma, semicolon or tab separated). The first row
    is bold; numbers stay numbers."""
    import csv
    sample = text[:2000]
    delim = "\t" if sample.count("\t") > sample.count(",") else (";" if sample.count(";") > sample.count(",") else ",")
    rows = [r for r in csv.reader(io.StringIO(text.strip()), delimiter=delim)]
    xml_rows = []
    for ri, row in enumerate(rows):
        cells = []
        for ci, v in enumerate(row):
            ref, style = "%s%d" % (_col(ci), ri + 1), ' s="1"' if ri == 0 else ""
            num = v.strip().replace(" ", "")
            if re.fullmatch(r"-?\d+([.,]\d+)?", num) and ri > 0:
                cells.append('<c r="%s"%s><v>%s</v></c>' % (ref, style, num.replace(",", ".")))
            else:
                cells.append('<c r="%s" t="inlineStr"%s><is><t xml:space="preserve">%s</t></is></c>' % (ref, style, xml_escape(v)))
        xml_rows.append('<row r="%d">%s</row>' % (ri + 1, "".join(cells)))
    widths = "".join('<col min="%d" max="%d" width="%d" customWidth="1"/>' % (i + 1, i + 1, min(60, max(10, max(
        (len(r[i]) for r in rows if i < len(r)), default=8) + 2))) for i in range(max((len(r) for r in rows), default=0)))
    sheet_xml = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                 '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">%s<sheetData>%s</sheetData></worksheet>'
                 % ("<cols>%s</cols>" % widths if widths else "", "".join(xml_rows)))
    ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    return _zip([
        ("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
         '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
         '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
         '<Default Extension="xml" ContentType="application/xml"/>'
         '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
         '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
         '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
         '</Types>'),
        ("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
         '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
         '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
         '</Relationships>'),
        ("xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook %s '
         'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
         '<sheet name="%s" sheetId="1" r:id="rId1"/></sheets></workbook>' % (ns, xml_escape(sheet[:31]))),
        ("xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
         '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
         '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
         '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
         '</Relationships>'),
        ("xl/styles.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet %s>'
         '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
         '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
         '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
         '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
         '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
         '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
         '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' % ns),
        ("xl/worksheets/sheet1.xml", sheet_xml),
    ])


# --- PowerPoint ----------------------------------------------------------------

def slides_from_markdown(md):
    """'# Title' starts a slide; list items and paragraphs become bullets."""
    slides, cur = [], None
    for kind, text in markdown_blocks(md):
        if kind in ("h1", "h2"):
            cur = {"title": text, "bullets": []}
            slides.append(cur)
        elif kind in ("li", "p", "h3", "code") and text.strip():
            if cur is None:
                cur = {"title": "", "bullets": []}
                slides.append(cur)
            cur["bullets"].append(text)
    return {"title": slides[0]["title"] if slides else "Presentation", "slides": slides}


def _hex(c, default):
    c = str(c or "").strip().lstrip("#")
    return c.upper() if re.fullmatch(r"[0-9a-fA-F]{6}", c) else default


_P = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' \
     'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' \
     'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/"
_EMPTY_TREE = ('<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
               '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/>'
               '<a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>%s</p:spTree>')

THEME = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
         '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="One">'
         '<a:themeElements><a:clrScheme name="One">'
         '<a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>'
         '<a:dk2><a:srgbClr val="1F1F1F"/></a:dk2><a:lt2><a:srgbClr val="F4F4F4"/></a:lt2>'
         '<a:accent1><a:srgbClr val="10A37F"/></a:accent1><a:accent2><a:srgbClr val="2F6FEB"/></a:accent2>'
         '<a:accent3><a:srgbClr val="E5484D"/></a:accent3><a:accent4><a:srgbClr val="F5A524"/></a:accent4>'
         '<a:accent5><a:srgbClr val="8E4EC6"/></a:accent5><a:accent6><a:srgbClr val="12A594"/></a:accent6>'
         '<a:hlink><a:srgbClr val="2F6FEB"/></a:hlink><a:folHlink><a:srgbClr val="8E4EC6"/></a:folHlink></a:clrScheme>'
         '<a:fontScheme name="One"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>'
         '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>'
         '<a:fmtScheme name="One"><a:fillStyleLst>'
         '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
         '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst>'
         '<a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'
         '<a:ln w="25400"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'
         '<a:ln w="38100"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>'
         '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle>'
         '<a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst>'
         '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
         '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements>'
         '<a:objectDefaults/><a:extraClrSchemeLst/></a:theme>')


def _textbox(sid, name, x, y, w, h, paras):
    return ('<p:sp><p:nvSpPr><p:cNvPr id="%d" name="%s"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>'
            '<p:spPr><a:xfrm><a:off x="%d" y="%d"/><a:ext cx="%d" cy="%d"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
            '<a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" rIns="0"><a:normAutofit/></a:bodyPr><a:lstStyle/>%s</p:txBody></p:sp>'
            % (sid, name, x, y, w, h, "".join(paras)))


def _para(text, size, color, bold=False, bullet=False):
    ppr = ('<a:pPr marL="342900" indent="-342900"><a:spcBef><a:spcPts val="900"/></a:spcBef><a:buFont typeface="Arial"/>'
           '<a:buChar char="&#8226;"/></a:pPr>' if bullet else '<a:pPr><a:buNone/></a:pPr>')
    return ('<a:p>%s<a:r><a:rPr lang="sv-SE" sz="%d"%s dirty="0"><a:solidFill><a:srgbClr val="%s"/></a:solidFill></a:rPr>'
            '<a:t>%s</a:t></a:r></a:p>' % (ppr, size * 100, ' b="1"' if bold else "", color, xml_escape(text)))


def pptx_from_slides(deck):
    """A 16:9 PowerPoint deck from {"title", "theme": {"background",
    "text", "accent"}, "slides": [{"title", "bullets": [...]}]}. The first
    slide is a title slide when it has no bullets."""
    theme = deck.get("theme") or {}
    bg, fg, accent = _hex(theme.get("background"), "FFFFFF"), _hex(theme.get("text"), "1F1F1F"), _hex(theme.get("accent"), "10A37F")
    slides = [s for s in (deck.get("slides") or []) if isinstance(s, dict)][:60] or [{"title": deck.get("title") or "Presentation"}]
    W, H = 12192000, 6858000
    files = []
    for i, s in enumerate(slides, 1):
        title = str(s.get("title") or "")[:200]
        bullets = [str(b)[:500] for b in (s.get("bullets") or []) if str(b).strip()][:12]
        shapes = []
        if not bullets:
            shapes.append(_textbox(2, "Titel", 838200, 2286000, W - 1676400, 1371600, [_para(title, 44, fg, True)]))
            sub = str(s.get("subtitle") or "")
            if sub:
                shapes.append(_textbox(3, "Undertitel", 838200, 3733800, W - 1676400, 914400, [_para(sub, 22, accent)]))
        else:
            shapes.append(_textbox(2, "Titel", 838200, 457200, W - 1676400, 1143000, [_para(title, 34, fg, True)]))
            size = 22 if len(bullets) <= 5 else (18 if len(bullets) <= 8 else 15)
            shapes.append(_textbox(3, "Text", 838200, 1714500, W - 1676400, H - 2400300, [_para(b, size, fg, bullet=True) for b in bullets]))
        bar = ('<p:sp><p:nvSpPr><p:cNvPr id="9" name="Accent"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm>'
               '<a:off x="838200" y="%d"/><a:ext cx="1219200" cy="76200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
               '<a:solidFill><a:srgbClr val="%s"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>'
               % (2133600 if not bullets else 1524000, accent))
        xml = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld %s><p:cSld><p:bg><p:bgPr><a:solidFill>'
               '<a:srgbClr val="%s"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>%s</p:cSld>'
               '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>') % (_P, bg, _EMPTY_TREE % ("".join(shapes) + bar))
        files.append(("ppt/slides/slide%d.xml" % i, xml))
        files.append(("ppt/slides/_rels/slide%d.xml.rels" % i,
                      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                      '<Relationship Id="rId1" Type="%sslideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>' % _REL))
    n = len(slides)
    ct = "application/vnd.openxmlformats-officedocument.presentationml."
    overrides = "".join('<Override PartName="/ppt/slides/slide%d.xml" ContentType="%sslide+xml"/>' % (i, ct) for i in range(1, n + 1))
    pres_rels = "".join('<Relationship Id="rId%d" Type="%sslide" Target="slides/slide%d.xml"/>' % (i + 1, _REL, i) for i in range(1, n + 1))
    sld_ids = "".join('<p:sldId id="%d" r:id="rId%d"/>' % (255 + i, i + 1) for i in range(1, n + 1))
    rels_head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    base = [
        ("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
         '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
         '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
         '<Default Extension="xml" ContentType="application/xml"/>'
         '<Override PartName="/ppt/presentation.xml" ContentType="%spresentation.main+xml"/>'
         '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="%sslideMaster+xml"/>'
         '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="%sslideLayout+xml"/>'
         '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
         '<Override PartName="/ppt/presProps.xml" ContentType="%spresProps+xml"/>'
         '<Override PartName="/ppt/viewProps.xml" ContentType="%sviewProps+xml"/>'
         '<Override PartName="/ppt/tableStyles.xml" ContentType="%stableStyles+xml"/>%s</Types>'
         % (ct, ct, ct, ct, ct, ct, overrides)),
        ("_rels/.rels", rels_head + '<Relationship Id="rId1" Type="%sofficeDocument" Target="ppt/presentation.xml"/></Relationships>' % _REL),
        ("ppt/presentation.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation %s saveSubsetFonts="1">'
         '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>%s</p:sldIdLst>'
         '<p:sldSz cx="%d" cy="%d"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>' % (_P, sld_ids, W, H)),
        ("ppt/_rels/presentation.xml.rels", rels_head +
         '<Relationship Id="rId1" Type="%sslideMaster" Target="slideMasters/slideMaster1.xml"/>%s'
         '<Relationship Id="rId%d" Type="%stheme" Target="theme/theme1.xml"/>'
         '<Relationship Id="rId%d" Type="%spresProps" Target="presProps.xml"/>'
         '<Relationship Id="rId%d" Type="%sviewProps" Target="viewProps.xml"/>'
         '<Relationship Id="rId%d" Type="%stableStyles" Target="tableStyles.xml"/></Relationships>'
         % (_REL, pres_rels, n + 2, _REL, n + 3, _REL, n + 4, _REL, n + 5, _REL)),
        ("ppt/presProps.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentationPr %s/>' % _P),
        ("ppt/viewProps.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:viewPr %s/>' % _P),
        ("ppt/tableStyles.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
         '<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>'),
        ("ppt/slideMasters/slideMaster1.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster %s>'
         '<p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>%s</p:cSld>'
         '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" '
         'accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>'
         '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>' % (_P, _EMPTY_TREE % "")),
        ("ppt/slideMasters/_rels/slideMaster1.xml.rels", rels_head +
         '<Relationship Id="rId1" Type="%sslideLayout" Target="../slideLayouts/slideLayout1.xml"/>'
         '<Relationship Id="rId2" Type="%stheme" Target="../theme/theme1.xml"/></Relationships>' % (_REL, _REL)),
        ("ppt/slideLayouts/slideLayout1.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
         '<p:sldLayout %s type="blank" preserve="1"><p:cSld name="Tom">%s</p:cSld>'
         '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>' % (_P, _EMPTY_TREE % "")),
        ("ppt/slideLayouts/_rels/slideLayout1.xml.rels", rels_head +
         '<Relationship Id="rId1" Type="%sslideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>' % _REL),
        ("ppt/theme/theme1.xml", THEME),
    ]
    return _zip(base + files)


def html_deck(deck):
    """The same deck as a self-contained web page (arrow keys, swipe, click)."""
    theme = deck.get("theme") or {}
    bg, fg, accent = ("#" + _hex(theme.get("background"), "FFFFFF"), "#" + _hex(theme.get("text"), "1F1F1F"),
                      "#" + _hex(theme.get("accent"), "10A37F"))
    sections = []
    for s in deck.get("slides") or []:
        bullets = "".join("<li>%s</li>" % html.escape(str(b)) for b in s.get("bullets") or [])
        sub = "<p class=sub>%s</p>" % html.escape(str(s["subtitle"])) if s.get("subtitle") else ""
        sections.append("<section%s><h1>%s</h1><i></i>%s%s</section>" % (
            "" if bullets else " class=cover", html.escape(str(s.get("title") or "")), sub, "<ul>%s</ul>" % bullets if bullets else ""))
    return ("""<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>%s</title><style>html,body{margin:0;height:100%%;background:%s;color:%s;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden}
section{position:absolute;inset:0;padding:7vh 8vw;box-sizing:border-box;display:none}section.on{display:block}
section.cover{display:none;flex-direction:column;justify-content:center}section.cover.on{display:flex}
h1{font-size:clamp(24px,5vw,56px);margin:0 0 2vh}i{display:block;width:90px;height:6px;background:%s;margin-bottom:4vh}
li{font-size:clamp(16px,2.6vw,30px);margin:1.4vh 0}.sub{font-size:clamp(16px,2.6vw,28px);color:%s}
nav{position:fixed;bottom:12px;right:16px;font-size:14px;opacity:.6}</style></head><body>%s<nav id=n></nav>
<script>var s=document.querySelectorAll('section'),i=0;function go(k){i=Math.max(0,Math.min(s.length-1,k));s.forEach(function(e,j){e.classList.toggle('on',j===i)});document.getElementById('n').textContent=(i+1)+' / '+s.length}
addEventListener('keydown',function(e){if(/Arrow(Right|Down)|PageDown| /.test(e.key))go(i+1);if(/Arrow(Left|Up)|PageUp/.test(e.key))go(i-1)});
addEventListener('click',function(e){go(e.clientX>innerWidth/3?i+1:i-1)});go(0)</script></body></html>""" % (
        html.escape(str(deck.get("title") or "Presentation")), bg, fg, accent, accent, "".join(sections)))


# --- music -------------------------------------------------------------------

NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
DRUMS = {"kick": 36, "snare": 38, "hat": 42, "clap": 39, "tom": 45, "crash": 49}
PROGRAM = {"piano": 0, "bass": 33, "lead": 81, "pad": 89, "strings": 48, "pluck": 25, "drums": 0}


def midi_number(p):
    if isinstance(p, (int, float)):
        return max(0, min(127, int(p)))
    s = str(p).strip()
    if s.lower() in DRUMS:
        return DRUMS[s.lower()]
    m = re.fullmatch(r"([A-Ga-g])([#b]?)(-?\d)", s)
    if not m:
        return 60
    n = NOTE[m.group(1).upper()] + (1 if m.group(2) == "#" else -1 if m.group(2) == "b" else 0)
    return max(0, min(127, (int(m.group(3)) + 1) * 12 + n))


def _notes(track):
    out = []
    for n in (track.get("notes") or [])[:4000]:
        if isinstance(n, dict):
            n = [n.get("pitch"), n.get("start"), n.get("dur") or n.get("duration"), n.get("vel")]
        if not isinstance(n, (list, tuple)) or len(n) < 3:
            continue
        try:
            start, dur = float(n[1]), float(n[2])
            vel = float(n[3]) if len(n) > 3 and n[3] is not None else 0.8
        except (TypeError, ValueError):
            continue
        if start < 0 or dur <= 0:
            continue
        out.append((n[0], start, min(dur, 32), max(0.0, min(1.0, vel if vel <= 1 else vel / 127))))
    return out


def score_length(score):
    tempo = max(40, min(220, float(score.get("tempo") or 110)))
    beats = max([s + d for t in score.get("tracks") or [] for _, s, d, _ in _notes(t)] or [4])
    return beats * 60 / tempo


def wav_from_score(score, rate=22050, max_seconds=90):
    """Synthesizes {"tempo", "tracks": [{"instrument", "notes": [[pitch,
    start_beat, beats, velocity]]}]} into a 16-bit mono WAV."""
    tempo = max(40, min(220, float(score.get("tempo") or 110)))
    spb = 60 / tempo
    total = min(max_seconds, score_length(score) + 1.5)
    n_samples = int(total * rate)
    mix = [0.0] * n_samples
    rnd = random.Random(7)
    noise = [rnd.uniform(-1, 1) for _ in range(rate)]
    two_pi = 2 * math.pi
    for track in (score.get("tracks") or [])[:12]:
        inst = str(track.get("instrument") or "piano").lower()
        gain = float(track.get("volume") or 0.8)
        for pitch, start, dur, vel in _notes(track):
            t0 = int(start * spb * rate)
            if t0 >= n_samples:
                continue
            amp = vel * gain * 0.3
            if inst == "drums":
                kind = str(pitch).lower()
                d = int(rate * (0.35 if kind == "kick" else 0.2 if kind in ("snare", "clap", "tom") else 0.06 if kind == "hat" else 0.8))
                for i in range(min(d, n_samples - t0)):
                    t = i / rate
                    if kind == "kick":
                        v = math.sin(two_pi * (50 * t + 60 * (1 - math.exp(-t * 30)) / 30)) * math.exp(-t * 9)
                    elif kind == "tom":
                        v = math.sin(two_pi * 120 * t) * math.exp(-t * 14)
                    else:
                        v = noise[i % rate] * math.exp(-t * (60 if kind == "hat" else 4 if kind == "crash" else 22))
                    mix[t0 + i] += v * amp * 1.4
                continue
            f = 440 * 2 ** ((midi_number(pitch) - 69) / 12)
            length = min(int((dur * spb + (0.6 if inst in ("pad", "strings") else 0.25)) * rate), n_samples - t0)
            note_end = dur * spb
            w = two_pi * f / rate
            for i in range(length):
                t = i / rate
                ph = w * i
                if inst == "bass":
                    v = math.sin(ph) + 0.35 * math.sin(2 * ph)
                    env = min(1, t * 200) * math.exp(-t * 2.5)
                elif inst == "lead":
                    v = math.sin(ph) + math.sin(3 * ph) / 3 + math.sin(5 * ph) / 5
                    env = min(1, t * 80) * 0.7
                elif inst in ("pad", "strings"):
                    v = math.sin(ph) + 0.5 * math.sin(ph * 1.004) + 0.3 * math.sin(2 * ph)
                    env = min(1, t * 4) * 0.6
                elif inst == "pluck":
                    v = math.sin(ph) + 0.4 * math.sin(2 * ph) + 0.2 * math.sin(4 * ph)
                    env = math.exp(-t * 7)
                else:  # piano
                    v = math.sin(ph) + 0.45 * math.sin(2 * ph) + 0.12 * math.sin(3 * ph)
                    env = min(1, t * 300) * math.exp(-t * 2.2)
                if t > note_end:
                    env *= math.exp(-(t - note_end) * 18)
                mix[t0 + i] += v * env * amp
    peak = max(1e-6, max(abs(x) for x in mix))
    scale = 32000 / peak if peak > 1 else 32000
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(struct.pack("<%dh" % n_samples, *(int(max(-32767, min(32767, x * scale))) for x in mix)))
    return buf.getvalue()


def midi_from_score(score):
    tempo = max(40, min(220, float(score.get("tempo") or 110)))
    ppq = 480

    def vlq(n):
        out = [n & 0x7F]
        n >>= 7
        while n:
            out.insert(0, (n & 0x7F) | 0x80)
            n >>= 7
        return bytes(out)

    tracks = [b"\x00\xff\x51\x03" + struct.pack(">I", int(60_000_000 / tempo))[1:] + b"\x00\xff\x2f\x00"]
    ch = 0
    for track in (score.get("tracks") or [])[:15]:
        inst = str(track.get("instrument") or "piano").lower()
        channel = 9 if inst == "drums" else ch
        if inst != "drums":
            ch = ch + 1 if ch + 1 != 9 else 10
        events = []
        for pitch, start, dur, vel in _notes(track):
            key, v = midi_number(pitch), max(1, int(vel * 127))
            events.append((int(start * ppq), 1, bytes([0x90 | channel, key, v])))
            events.append((int((start + dur) * ppq), 0, bytes([0x80 | channel, key, 0])))
        events.sort(key=lambda e: (e[0], e[1]))
        data, last = bytearray(b"\x00" + bytes([0xC0 | channel, PROGRAM.get(inst, 0)])), 0
        for t, _, msg in events:
            data += vlq(t - last) + msg
            last = t
        data += b"\x00\xff\x2f\x00"
        tracks.append(bytes(data))
    out = b"MThd" + struct.pack(">IHHH", 6, 1, len(tracks), ppq)
    for t in tracks:
        out += b"MTrk" + struct.pack(">I", len(t)) + t
    return out


# --- 3D ------------------------------------------------------------------------

def _tri_box():
    tris = []
    faces = [((1, 0, 0), [(.5, -.5, -.5), (.5, .5, -.5), (.5, .5, .5), (.5, -.5, .5)]),
             ((-1, 0, 0), [(-.5, -.5, .5), (-.5, .5, .5), (-.5, .5, -.5), (-.5, -.5, -.5)]),
             ((0, 1, 0), [(-.5, .5, -.5), (-.5, .5, .5), (.5, .5, .5), (.5, .5, -.5)]),
             ((0, -1, 0), [(-.5, -.5, .5), (-.5, -.5, -.5), (.5, -.5, -.5), (.5, -.5, .5)]),
             ((0, 0, 1), [(-.5, -.5, .5), (.5, -.5, .5), (.5, .5, .5), (-.5, .5, .5)]),
             ((0, 0, -1), [(.5, -.5, -.5), (-.5, -.5, -.5), (-.5, .5, -.5), (.5, .5, -.5)])]
    for n, (a, b, c, d) in faces:
        tris += [(a, n), (b, n), (c, n), (a, n), (c, n), (d, n)]
    return tris


def _grid(fn, nu, nv):
    """Triangles of a parametric surface fn(u, v) -> (point, normal)."""
    tris = []
    for i in range(nu):
        for j in range(nv):
            a, b, c, d = fn(i / nu, j / nv), fn((i + 1) / nu, j / nv), fn((i + 1) / nu, (j + 1) / nv), fn(i / nu, (j + 1) / nv)
            tris += [a, c, b, a, d, c]
    return tris


def _sphere(u, v):
    th, ph = u * 2 * math.pi, v * math.pi
    n = (math.sin(ph) * math.cos(th), math.cos(ph), math.sin(ph) * math.sin(th))
    return tuple(x * .5 for x in n), n


def _torus(u, v):
    th, ph = u * 2 * math.pi, v * 2 * math.pi
    R, r = .35, .15
    n = (math.cos(ph) * math.cos(th), math.sin(ph), math.cos(ph) * math.sin(th))
    return ((R + r * math.cos(ph)) * math.cos(th), r * math.sin(ph), (R + r * math.cos(ph)) * math.sin(th)), n


def _tri_cyl(top=.5, seg=32):
    tris = []
    slope = (.5 - top)
    for i in range(seg):
        a0, a1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
        c0, s0, c1, s1 = math.cos(a0), math.sin(a0), math.cos(a1), math.sin(a1)
        def nrm(c, s):
            ln = math.sqrt(1 + slope * slope)
            return (c / ln, slope / ln, s / ln)
        b0, b1 = (.5 * c0, -.5, .5 * s0), (.5 * c1, -.5, .5 * s1)
        t0, t1 = (top * c0, .5, top * s0), (top * c1, .5, top * s1)
        tris += [(b0, nrm(c0, s0)), (t1, nrm(c1, s1)), (b1, nrm(c1, s1)), (b0, nrm(c0, s0)), (t0, nrm(c0, s0)), (t1, nrm(c1, s1))]
        tris += [((0, -.5, 0), (0, -1, 0)), (b1, (0, -1, 0)), (b0, (0, -1, 0))]
        if top > 0:
            tris += [((0, .5, 0), (0, 1, 0)), (t0, (0, 1, 0)), (t1, (0, 1, 0))]
    return tris


SHAPES = {
    "box": _tri_box, "cube": _tri_box,
    "sphere": lambda: _grid(_sphere, 32, 16), "ball": lambda: _grid(_sphere, 32, 16),
    "cylinder": lambda: _tri_cyl(.5), "cone": lambda: _tri_cyl(0.0), "torus": lambda: _grid(_torus, 32, 16),
    "plane": lambda: [(p, (0, 1, 0)) for p in [(-.5, 0, -.5), (-.5, 0, .5), (.5, 0, .5), (-.5, 0, -.5), (.5, 0, .5), (.5, 0, -.5)]],
}


def _rot(deg):
    x, y, z = (math.radians(float(a)) for a in deg)
    cx, sx, cy, sy, cz, sz = math.cos(x), math.sin(x), math.cos(y), math.sin(y), math.cos(z), math.sin(z)
    # R = Rz * Ry * Rx
    return [[cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
            [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
            [-sy, cy * sx, cy * cx]]


def _vec(v, n, default):
    try:
        out = [float(x) for x in (v or [])][:n]
    except (TypeError, ValueError):
        out = []
    return out + default[len(out):]


def _color(c):
    c = _hex(c, "B4B4B4")
    return [int(c[i:i + 2], 16) / 255 for i in (0, 2, 4)] + [1.0]


def glb_from_scene(scene):
    """A binary glTF from {"title", "parts": [{"shape", "position",
    "rotation" (degrees), "scale", "color", "metallic"?}]}."""
    parts = [p for p in (scene.get("parts") or []) if isinstance(p, dict) and str(p.get("shape", "")).lower() in SHAPES][:300]
    if not parts:
        raise ValueError("The 3D scene has no parts.")
    bin_data, views, accessors, meshes, nodes, materials = bytearray(), [], [], [], [], []
    for p in parts:
        tris = SHAPES[str(p["shape"]).lower()]()
        s = [max(1e-4, abs(x)) for x in _vec(p.get("scale"), 3, [1, 1, 1])]
        r = _rot(_vec(p.get("rotation"), 3, [0, 0, 0]))
        t = _vec(p.get("position"), 3, [0, 0, 0])
        pos, nor = [], []
        for (px, py, pz), (nx, ny, nz) in tris:
            v = (px * s[0], py * s[1], pz * s[2])
            pos.append([sum(r[i][k] * v[k] for k in range(3)) + t[i] for i in range(3)])
            n = (nx / s[0], ny / s[1], nz / s[2])
            n = [sum(r[i][k] * n[k] for k in range(3)) for i in range(3)]
            ln = math.sqrt(sum(x * x for x in n)) or 1
            nor.append([x / ln for x in n])
        for data, is_pos in ((pos, True), (nor, False)):
            off = len(bin_data)
            bin_data += struct.pack("<%df" % (len(data) * 3), *[x for v in data for x in v])
            views.append({"buffer": 0, "byteOffset": off, "byteLength": len(data) * 12, "target": 34962})
            acc = {"bufferView": len(views) - 1, "componentType": 5126, "count": len(data), "type": "VEC3"}
            if is_pos:
                acc["min"] = [min(v[i] for v in data) for i in range(3)]
                acc["max"] = [max(v[i] for v in data) for i in range(3)]
            accessors.append(acc)
        metallic = max(0.0, min(1.0, float(p.get("metallic") or 0)))
        materials.append({"pbrMetallicRoughness": {"baseColorFactor": _color(p.get("color")), "metallicFactor": metallic,
                                                   "roughnessFactor": 0.55}, "doubleSided": True})
        meshes.append({"primitives": [{"attributes": {"POSITION": len(accessors) - 2, "NORMAL": len(accessors) - 1},
                                        "material": len(materials) - 1}]})
        nodes.append({"mesh": len(meshes) - 1, "name": str(p.get("name") or p["shape"])[:60]})
    gltf = {"asset": {"version": "2.0", "generator": "One AI Modelgent"}, "scene": 0,
            "scenes": [{"name": str(scene.get("title") or "Modell")[:80], "nodes": list(range(len(nodes)))}],
            "nodes": nodes, "meshes": meshes, "materials": materials, "accessors": accessors, "bufferViews": views,
            "buffers": [{"byteLength": len(bin_data)}]}
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    bin_data += b"\0" * (-len(bin_data) % 4)
    total = 12 + 8 + len(js) + 8 + len(bin_data)
    return (b"glTF" + struct.pack("<II", 2, total) + struct.pack("<I", len(js)) + b"JSON" + js +
            struct.pack("<I", len(bin_data)) + b"BIN\0" + bytes(bin_data))


# --- archives and e-mail -----------------------------------------------------------

def zip_files(files):
    """files: [(path, bytes or str)]"""
    return _zip([(safe_path(n), d.encode() if isinstance(d, str) else d) for n, d in files])


def eml(to, subject, body, cc=""):
    """An unsent e-mail draft that mail apps open ready to send."""
    m = email.message.EmailMessage(policy=email.policy.SMTP)
    if to:
        m["To"] = str(to)[:500]
    if cc:
        m["Cc"] = str(cc)[:500]
    m["Subject"] = str(subject or "")[:300]
    m["X-Unsent"] = "1"
    m.set_content(str(body or ""))
    return m.as_bytes()


def pwa_zip(index_html, name="One App"):
    """An installable web app: the app plus a manifest, icon and service worker."""
    icon = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#111"/>'
            '<text x="256" y="330" font-size="240" font-family="sans-serif" text-anchor="middle" fill="#fff">%s</text></svg>'
            % xml_escape((name.strip()[:1] or "A").upper()))
    manifest = json.dumps({"name": name, "short_name": name[:12], "start_url": "./index.html", "display": "standalone",
                           "background_color": "#ffffff", "theme_color": "#111111",
                           "icons": [{"src": "icon.svg", "sizes": "any", "type": "image/svg+xml"}]}, indent=2, ensure_ascii=False)
    sw = ("const C='app-v1';self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(['./','./index.html','./icon.svg','./manifest.webmanifest']))));"
          "self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));")
    head = ('<link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icon.svg">'
            "<script>if('serviceWorker' in navigator)addEventListener('load',function(){navigator.serviceWorker.register('sw.js')})</script>")
    page = re.sub(r"</head>", head + "</head>", index_html, count=1, flags=re.I) if re.search(r"</head>", index_html, re.I) else head + index_html
    return zip_files([("index.html", page), ("manifest.webmanifest", manifest), ("sw.js", sw), ("icon.svg", icon)])
