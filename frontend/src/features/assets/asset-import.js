import { asciiDigits, interfacesOf, validIp, validVlan } from './asset-model.js';
import { normalizeMac } from '../../shared/lib/mac.js';

export const IMPORT_MAX_BYTES = 100000,
  IMPORT_MAX_ROWS = 100,
  IMPORT_MAX_COLUMNS = 40;
const headerAliases = {
  name: ['اسم الأصل', 'الأصل', 'name', 'asset name'],
  ip: ['عنوان ip', 'ip', 'ip address'],
  mac: ['عنوان mac', 'mac', 'mac address'],
  type: ['نوع الأصل', 'النوع', 'type'],
  owner: ['المالك', 'owner'],
  criticality: ['الأهمية', 'criticality'],
  group: ['المجموعة', 'group'],
  manufacturer: ['الشركة المصنّعة', 'الشركة المصنعة', 'manufacturer'],
  deviceModel: ['الطراز', 'model'],
  operatingSystem: ['نظام التشغيل', 'os'],
  location: ['الموقع', 'location'],
  interfaceName: ['اسم الواجهة', 'interface'],
  vlan: ['vlan'],
};
const keyOf = header =>
  Object.entries(headerAliases).find(([, values]) =>
    values.includes(header.trim().toLocaleLowerCase()),
  )?.[0];
const normalizedIp = value => {
  const ip = String(value || '')
    .trim()
    .toLowerCase();
  if (!ip) return '';
  if (ip.includes(':')) {
    try {
      return new URL(`http://[${ip}]/`).hostname.slice(1, -1);
    } catch {
      return ip;
    }
  }
  return ip;
};

// RFC-4180-style comma CSV: quotes, escaped quotes, CRLF and multiline values.
// No evaluation of cell content; invalid quote placement is rejected explicitly.
export function parseCsv(text) {
  const original = String(text ?? '');
  if (new TextEncoder().encode(original).length > IMPORT_MAX_BYTES)
    throw Error('الملف أو النص أكبر من ١٠٠٬٠٠٠ بايت.');
  const input = original.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [],
    cell = '',
    inQuote = false,
    afterQuote = false;
  const pushCell = () => {
    if (row.length >= IMPORT_MAX_COLUMNS)
      throw Error('الحد الأقصى ٤٠ عمودًا في الاستيراد التجريبي.');
    row.push(cell);
    cell = '';
    afterQuote = false;
  };
  const pushRow = () => {
    pushCell();
    if (row.some(v => v.trim() !== '')) rows.push(row);
    row = [];
  };
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inQuote) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuote = false;
          afterQuote = true;
        }
      } else cell += c;
      continue;
    }
    if (afterQuote) {
      if (c === ',') {
        pushCell();
        continue;
      }
      if (c === '\n' || c === '\r') {
        pushRow();
        if (c === '\r' && input[i + 1] === '\n') i++;
        continue;
      }
      if (c === ' ' || c === '\t') continue;
      throw Error('تنسيق علامات الاقتباس في CSV غير صالح.');
    }
    if (c === '"') {
      if (cell !== '') throw Error('تنسيق علامات الاقتباس في CSV غير صالح.');
      inQuote = true;
      continue;
    }
    if (c === ',') {
      pushCell();
      continue;
    }
    if (c === '\n' || c === '\r') {
      pushRow();
      if (c === '\r' && input[i + 1] === '\n') i++;
      continue;
    }
    cell += c;
  }
  if (inQuote) throw Error('يوجد حقل مقتبس غير مغلق في CSV.');
  if (cell !== '' || row.length || afterQuote) pushRow();
  if (rows.length > IMPORT_MAX_ROWS + 1)
    throw Error('الحد الأقصى ١٠٠ صف بيانات في الاستيراد التجريبي.');
  return rows;
}

export function previewAssetCsv(text, assets) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw Error('أضف صف عناوين وصف بيانات واحدًا على الأقل.');
  const headings = rows[0].map(h => h.trim()),
    mapped = headings.map(keyOf),
    known = mapped.filter(Boolean);
  if (!known.includes('name')) throw Error('يجب وجود عمود «اسم الأصل» أو «الأصل».');
  if (new Set(known).size !== known.length)
    throw Error('يوجد أكثر من عمود للبيان نفسه؛ أزل العناوين المكررة.');
  const unknown = headings.filter((_, i) => !mapped[i]);
  const existing = { name: new Set(), ip: new Set(), mac: new Set() },
    seen = { name: new Set(), ip: new Set(), mac: new Set() };
  assets.forEach(a => {
    existing.name.add(
      String(a.name || '')
        .trim()
        .toLocaleLowerCase(),
    );
    interfacesOf(a).forEach(i => {
      if (i.ip) existing.ip.add(normalizedIp(i.ip));
      if (i.mac) existing.mac.add(normalizeMac(i.mac));
    });
  });
  const records = rows.slice(1).map((cells, index) => {
    const values = {};
    mapped.forEach((key, i) => {
      if (key) values[key] = String(cells[i] ?? '').trim();
    });
    // NEXORA exports its table's asset cell as name + sample ID.
    if (headings[mapped.indexOf('name')] === 'الأصل')
      values.name = (values.name || '').replace(/\s+·\s+AST-(?:(?:DEMO|IMPORT)-[\w-]+|\d+)$/i, '');
    for (const key of ['ip', 'mac', 'vlan']) if (['—', '-'].includes(values[key])) values[key] = '';
    values.name = values.name || '';
    values.ip = values.ip || '';
    values.mac = values.mac || '';
    values.type = values.type || 'أصل آخر';
    values.owner = values.owner || 'غير محدد';
    values.criticality = values.criticality || 'متوسطة';
    values.group = values.group || 'أصول مستوردة';
    values.interfaceName = values.interfaceName || 'eth0';
    values.vlan = asciiDigits(values.vlan || '').trim();
    const errors = [];
    if (cells.length !== headings.length) errors.push('عدد القيم لا يطابق عدد الأعمدة');
    if (!values.name) errors.push('اسم الأصل مطلوب');
    if (Object.values(values).some(v => v.length > 200)) errors.push('إحدى القيم تتجاوز ٢٠٠ حرف');
    if (!validIp(values.ip)) errors.push('عنوان IP غير صالح');
    const mac = normalizeMac(values.mac);
    if (mac === null) errors.push('عنوان MAC غير صالح أو ليس أحادي البث');
    else values.mac = mac;
    if (!validVlan(values.vlan)) errors.push('VLAN يجب أن يكون بين ١ و٤٠٩٤');
    if (!['حرجة', 'متوسطة', 'منخفضة'].includes(values.criticality))
      errors.push('الأهمية يجب أن تكون حرجة أو متوسطة أو منخفضة');
    const warnings = [];
    const candidates = {
      name: values.name.toLocaleLowerCase(),
      ip: normalizedIp(values.ip),
      mac: mac || '',
    };
    for (const [key, label] of [
      ['name', 'اسم الأصل'],
      ['ip', 'عنوان IP'],
      ['mac', 'عنوان MAC'],
    ]) {
      const value = candidates[key];
      if (!value) continue;
      if (existing[key].has(value)) warnings.push(`${label} مكرر مع سجل حالي`);
      if (seen[key].has(value)) warnings.push(`${label} مكرر في الملف`);
      seen[key].add(value);
    }
    return { index: index + 1, values, errors, warnings };
  });
  return { records, unknown };
}
