#!/usr/bin/env python3
"""Render the project's RTL Markdown specification as an editable OOXML Word file."""
from pathlib import Path
import re
import sys
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'docs/NEXORA_UI_UX_Final_Enhancement_Specification.md'
OUTPUT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT.parent/'NEXORA_UI_UX_Final_Enhancement_Specification.docx'

def rtl(paragraph):
    paragraph.alignment=WD_ALIGN_PARAGRAPH.RIGHT
    ppr=paragraph._p.get_or_add_pPr()
    if ppr.find(qn('w:bidi')) is None:
        bidi=OxmlElement('w:bidi');bidi.set(qn('w:val'),'1');ppr.append(bidi)
    return paragraph

def style_run(run,bold=None,color=None,size=None):
    if bold is not None: run.bold=bold
    run.font.name='Arial'
    run._element.get_or_add_rPr().rFonts.set(qn('w:cs'),'Arial')
    flag=OxmlElement('w:rtl');flag.set(qn('w:val'),'1');run._element.get_or_add_rPr().append(flag)
    if color: run.font.color.rgb=RGBColor.from_string(color)
    if size: run.font.size=Pt(size)
    return run

def inline(paragraph,text):
    # Links remain meaningful in a printed or offline document as label + URL.
    text=re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)',r'\1 — \2',text)
    for part in re.split(r'(\*\*.*?\*\*|`.*?`)',text):
        if not part:continue
        if part.startswith('**') and part.endswith('**'):style_run(paragraph.add_run(part[2:-2]),True)
        elif part.startswith('`') and part.endswith('`'):style_run(paragraph.add_run(part[1:-1]),False,'096A83')
        else:style_run(paragraph.add_run(part))

def shade(cell,color):
    tcpr=cell._tc.get_or_add_tcPr();element=tcpr.find(qn('w:shd'))
    if element is None:element=OxmlElement('w:shd');tcpr.append(element)
    element.set(qn('w:fill'),color)

def make_table(document,lines):
    rows=[]
    for line in lines:
        parts=[p.strip() for p in line.strip().strip('|').split('|')]
        if all(re.fullmatch(r':?-{3,}:?',p or '') for p in parts):continue
        rows.append(parts)
    if not rows:return
    n=max(map(len,rows));table=document.add_table(rows=0,cols=n);table.style='Table Grid';table.alignment=WD_TABLE_ALIGNMENT.CENTER
    tblpr=table._tbl.tblPr;visual=OxmlElement('w:bidiVisual');visual.set(qn('w:val'),'1');tblpr.append(visual)
    for index,row in enumerate(rows):
        cells=table.add_row().cells
        for i,cell in enumerate(cells):
            cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
            p=rtl(cell.paragraphs[0]);p.paragraph_format.space_after=Pt(3);p.paragraph_format.space_before=Pt(3)
            inline(p,row[i] if i<len(row) else '')
            if index==0:
                shade(cell,'E5F4F7')
                for run in p.runs:run.bold=True;run.font.color.rgb=RGBColor.from_string('096A83')
            elif index%2==0:shade(cell,'F5F8FB')
    document.add_paragraph()

doc=Document();section=doc.sections[0];section.top_margin=Cm(2.0);section.bottom_margin=Cm(2.0);section.left_margin=Cm(1.9);section.right_margin=Cm(1.9)
styles=doc.styles
for name in ['Normal','Title','Heading 1','Heading 2','Heading 3']:
    st=styles[name];st.font.name='Arial';st._element.get_or_add_rPr().rFonts.set(qn('w:cs'),'Arial')
styles['Normal'].font.size=Pt(10.5)
styles['Normal'].paragraph_format.line_spacing=1.25
styles['Normal'].paragraph_format.space_after=Pt(6)
for name,size in [('Title',21),('Heading 1',16),('Heading 2',13),('Heading 3',11)]:
    st=styles[name];st.font.size=Pt(size);st.font.bold=True;st.font.color.rgb=RGBColor.from_string('096A83')
header=rtl(section.header.paragraphs[0]);style_run(header.add_run('NEXORA  |  UI/UX SPECIFICATION'),True,'096A83',9)
footer=rtl(section.footer.paragraphs[0]);style_run(footer.add_run('واجهة تجريبية فقط  ·  الإصدار 1.6.1  ·  '),False,'4C5C74',9)
field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');footer._p.append(field)

doc.core_properties.title='NEXORA — مواصفات تحسين تجربة الواجهة'
doc.core_properties.subject='Analyst workspace 1.6.1, interface-only implementation and limitations'
doc.core_properties.author='NEXORA UI/UX'
lines=SOURCE.read_text(encoding='utf-8').splitlines();i=0
while i<len(lines):
    line=lines[i].strip()
    if not line:i+=1;continue
    if line.startswith('|'):
        block=[]
        while i<len(lines) and lines[i].strip().startswith('|'):block.append(lines[i]);i+=1
        make_table(doc,block);continue
    heading=re.match(r'^(#{1,3})\s+(.+)$',line)
    if heading:
        level=len(heading.group(1));p=doc.add_paragraph(style='Title' if level==1 else f'Heading {level-1}');rtl(p);inline(p,heading.group(2));i+=1;continue
    if line.startswith('- '):
        p=doc.add_paragraph(style='Normal');rtl(p);p.paragraph_format.right_indent=Cm(.35);inline(p,'• '+line[2:]);i+=1;continue
    p=rtl(doc.add_paragraph());inline(p,line);i+=1

doc.save(OUTPUT)
print(f'Wrote {OUTPUT} ({len(doc.paragraphs)} paragraphs, {len(doc.tables)} tables).')
