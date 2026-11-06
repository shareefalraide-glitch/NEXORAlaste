#!/usr/bin/env python3
"""Render the 1.6.1 human acceptance checklist as editable RTL OOXML."""
from pathlib import Path
import re
import sys
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'docs/ACCEPTANCE_1_6_1.md'
OUTPUT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT.parent/'NEXORA_1_6_1_Acceptance_Checklist.docx'

def rtl(paragraph):
    paragraph.alignment=WD_ALIGN_PARAGRAPH.RIGHT
    ppr=paragraph._p.get_or_add_pPr()
    bidi=OxmlElement('w:bidi');bidi.set(qn('w:val'),'1');ppr.append(bidi)
    return paragraph

def inline(paragraph,text):
    for part in re.split(r'(\*\*.*?\*\*|`.*?`)',text):
        if not part:continue
        strong=part.startswith('**') and part.endswith('**')
        code=part.startswith('`') and part.endswith('`')
        run=paragraph.add_run(part[2:-2] if strong else part[1:-1] if code else part)
        run.bold=strong
        run.font.name='Arial';run._element.get_or_add_rPr().rFonts.set(qn('w:cs'),'Arial')
        tag=OxmlElement('w:rtl');tag.set(qn('w:val'),'1');run._element.get_or_add_rPr().append(tag)
        if code:run.font.color.rgb=RGBColor.from_string('096A83')

def tint(paragraph):
    ppr=paragraph._p.get_or_add_pPr();shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'E8F4F5');ppr.append(shade)

doc=Document();sec=doc.sections[0]
sec.page_width=Cm(21);sec.page_height=Cm(29.7)
sec.top_margin=Cm(1.8);sec.bottom_margin=Cm(1.8);sec.left_margin=Cm(2);sec.right_margin=Cm(2)
styles=doc.styles
for name in ['Normal','Title','Heading 1','Heading 2']:
    style=styles[name];style.font.name='Arial';style._element.get_or_add_rPr().rFonts.set(qn('w:cs'),'Arial')
styles['Normal'].font.size=Pt(10.5);styles['Normal'].paragraph_format.line_spacing=1.22;styles['Normal'].paragraph_format.space_after=Pt(5)
for name,size in [('Title',19),('Heading 1',15),('Heading 2',12)]:
    style=styles[name];style.font.size=Pt(size);style.font.bold=True;style.font.color.rgb=RGBColor.from_string('096A83');style.paragraph_format.keep_with_next=True
header=rtl(sec.header.paragraphs[0]);inline(header,'NEXORA  |  ACCEPTANCE & HUMAN REVIEW  |  1.6.1')
for run in header.runs:run.font.size=Pt(8);run.font.color.rgb=RGBColor.from_string('096A83')
footer=rtl(sec.footer.paragraphs[0]);inline(footer,'خطة مراجعة بشرية لم تُنفّذ  ·  صفحة ')
for run in footer.runs:run.font.size=Pt(8);run.font.color.rgb=RGBColor.from_string('526874')
field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');footer._p.append(field)
doc.core_properties.title='NEXORA 1.6.1 — قائمة القبول وخطة تجربة الاستخدام'
doc.core_properties.subject='Editable checklist; human evaluation not yet performed'
doc.core_properties.author='NEXORA UI/UX'
for raw in SOURCE.read_text(encoding='utf-8').splitlines():
    line=raw.strip()
    if not line:continue
    match=re.match(r'^(#{1,3})\s+(.+)$',line)
    if match:
        level=len(match.group(1));p=doc.add_paragraph(style='Title' if level==1 else f'Heading {level-1}');rtl(p);inline(p,match.group(2));continue
    p=rtl(doc.add_paragraph())
    if line.startswith('- '):p.paragraph_format.right_indent=Cm(.3);inline(p,'• '+line[2:])
    else:inline(p,line)
    if line.startswith('**الحالة:'):tint(p)
doc.save(OUTPUT)
print(f'Wrote {OUTPUT} with {len(doc.paragraphs)} editable paragraphs.')
