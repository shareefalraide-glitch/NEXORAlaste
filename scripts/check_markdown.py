#!/usr/bin/env python3
"""Check the project's Arabic Markdown wrappers, task cards and local links.

Uses only the Python standard library. This is a structural check, not a
substitute for inspecting GitHub's rendered output or reviewing the content.
"""
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
EXCLUDED = {'.git', 'node_modules', '.venv', 'dist', 'build', '__pycache__', '.pytest_cache'}
TASKS = ROOT / 'planning' / 'issues'
FENCE = re.compile(r'^(`{3,}|~{3,})(.*)$')
HEADING = re.compile(r'^#\s+\S')
LINK = re.compile(r'!?\[[^\]]*\]\(([^\s)]+)(?:\s+[\'"][^)]*[\'"])?\)')
TASK_ID = re.compile(r'^P[1-5]-\d{2}$')
FIELDS = ('العنوان', 'القسم', 'الأولوية', 'المسؤول المقترح', 'المتطلبات المرتبطة', 'الاعتماديات', 'الحالة')
SECTIONS = ('## 📝 وصف المهمة', '## ✅ خطوات التنفيذ', '### ✅ معايير القبول',
            '## 🛑 التحديات المتوقعة', '## 📌 ملاحظات إضافية')
PRIORITY = {'P0': '🔴 عالية', 'P1': '🟡 متوسطة', 'P2': '🟢 منخفضة'}


def check_file(path: Path) -> list[str]:
    errors: list[str] = []
    name = path.relative_to(ROOT).as_posix()
    content = path.read_text(encoding='utf-8')
    lines = content.splitlines()

    def error(message: str) -> None:
        errors.append(f'{name}: {message}')

    if len(lines) < 5 or lines[:2] != ['<div dir="rtl" lang="ar">', ''] or lines[-2:] != ['', '</div>']:
        error('غلاف RTL الخارجي أو لغة العربية غير صحيحين، أو لا يحيط بهما سطر فارغ.')
    if not any(HEADING.match(line) for line in lines[:8]):
        error('العنوان الرئيسي مفقود.')

    fence = None
    fence_count = 0
    plain_lines = []
    for i, line in enumerate(lines):
        match = FENCE.match(line)
        if match:
            token, info = match.groups()
            if fence is None:
                fence = (token[0], len(token), i)
                fence_count += 1
                if i < 2 or lines[i-2:i] != ['<div dir="ltr">', '']:
                    error(f'السطر {i+1}: كتلة الشيفرة لا تبدأ داخل غلاف LTR مع سطر فارغ.')
                continue
            if token[0] == fence[0] and len(token) >= fence[1] and not info.strip():
                if lines[i+1:i+3] != ['', '</div>']:
                    error(f'السطر {i+1}: غلاف LTR لا يغلق بعد سطر فارغ.')
                fence = None
                continue
        if fence is None:
            plain_lines.append(line)
    if fence is not None:
        error(f'السطر {fence[2]+1}: كتلة شيفرة غير مغلقة.')
    if content.count('<div dir="ltr">') != fence_count:
        error('عدد أغلفة LTR لا يطابق عدد كتل الشيفرة.')

    for line in plain_lines:
        for raw in LINK.findall(line):
            target = unquote(raw.strip('<>'))
            parsed = urlsplit(target)
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue
            if not (path.parent / parsed.path).exists():
                error(f'الرابط المحلي غير موجود: {target}')

    if path.parent == TASKS:
        task_id = path.stem
        if not TASK_ID.fullmatch(task_id):
            error('اسم ملف المهمة لا يطابق نموذج رقم المهمة.')
        if f'# 🎯 مهمة رقم: {task_id}' not in lines:
            error('رقم المهمة في العنوان لا يطابق اسم الملف.')
        for field in FIELDS:
            matches = [line for line in lines if line.startswith(f'**{field}:**')]
            if len(matches) != 1 or not matches[0].split('**', 2)[-1].strip():
                error(f'حقل المهمة مفقود أو مكرر أو فارغ: {field}')
        for section in SECTIONS:
            if lines.count(section) != 1:
                error(f'قسم المهمة مفقود أو مكرر: {section}')
        priorities = [line for line in lines if line.startswith('**الأولوية:**')]
        if len(priorities) == 1:
            selected = re.search(r'\((P[012])\)', priorities[0])
            if not selected or PRIORITY[selected.group(1)] not in priorities[0]:
                error('الأولوية أو الرمز لا يتوافق مع P0 أو P1 أو P2.')
        if sum(bool(re.match(r'^- \[ \] ', line)) for line in lines) < 1:
            error('لا توجد معايير قبول قابلة للتأشير.')
    return errors


def main() -> int:
    documents = sorted(p for p in ROOT.rglob('*.md')
                       if not (set(p.relative_to(ROOT).parts) & EXCLUDED))
    if not documents:
        print('لم تُعثر على ملفات Markdown.', file=sys.stderr)
        return 1
    errors = []
    for path in documents:
        errors.extend(check_file(path))
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        return 1
    tasks = sum(p.parent == TASKS for p in documents)
    print(f'نجح فحص {len(documents)} ملف Markdown، منها {tasks} بطاقة مهمة؛ الأغلفة والروابط المحلية سليمة.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
