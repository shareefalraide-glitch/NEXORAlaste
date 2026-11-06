import React, { useState } from 'react';
import { Download, Fingerprint, Upload } from 'lucide-react';
import {
  ar,
  Button,
  ltr,
  PageHeading,
  Panel,
  PanelHeading,
  SearchInput,
  Select,
  Severity,
  Table,
  Tag,
} from '../../shared/ui/index';

import { iocExportSchema } from '../export/export-schema';

import { includes, Result } from './DetectionTable';
export function Threats({ data, openModal, exportData }) {
  const [q, setQ] = useState(''),
    [type, setType] = useState('all');
  const rows = data.iocs.filter(x => includes(x, q) && (type === 'all' || x.type === type));
  return (
    <>
      <PageHeading
        title="مؤشرات التهديد"
        subtitle="أدر المؤشرات المحلية التي تثري سياق الأحداث والتنبيهات."
        actions={
          <>
            <Button
              icon={Download}
              onClick={() =>
                exportData('مؤشرات التهديد', rows, {
                  allRows: data.iocs,
                  columns: iocExportSchema,
                  visibleColumns: iocExportSchema.map(c => c.id),
                })
              }
            >
              تصدير
            </Button>
            <Button icon={Upload} variant="primary" onClick={() => openModal('importIoc')}>
              استيراد مؤشرات
            </Button>
          </>
        }
      />
      <div className="page-intro-strip">
        <div className="strip-icon cyan">
          <Fingerprint size={20} />
        </div>
        <div>
          <strong>استخبارات تهديد محلية</strong>
          <p>تُستورد القوائم من حزم محلية؛ هذه الواجهة لا تتصل بأي مصدر خارجي.</p>
        </div>
        <span className="strip-label">THREAT INTELLIGENCE</span>
      </div>
      <Panel className="data-panel">
        <PanelHeading
          title="قائمة المؤشرات"
          subtitle="عناوين ونطاقات ضمن عينة توضيحية"
          aside={<Tag color="blue">{ar(rows.length)} مؤشر</Tag>}
        />
        <div className="filter-bar">
          <SearchInput value={q} onChange={setQ} placeholder="بحث بالقيمة أو المعرّف أو المصدر" />
          <div className="filter-controls">
            <Select value={type} onChange={setType} ariaLabel="نوع المؤشر">
              <option value="all">كل الأنواع</option>
              <option>عنوان IP</option>
              <option>نطاق</option>
              <option>تجزئة</option>
            </Select>
            <button
              className="reset-filter"
              onClick={() => {
                setQ('');
                setType('all');
              }}
            >
              إعادة ضبط
            </button>
          </div>
        </div>
        <Table
          head={['المؤشر', 'النوع', 'المصدر', 'الخطورة', 'تاريخ الإضافة', 'المطابقات']}
          empty={!rows.length}
        >
          {rows.map(x => (
            <tr key={x.id}>
              <td>
                <div className="record-title">
                  {ltr(x.value, 'mono strong')}
                  {ltr(x.id, 'record-id')}
                </div>
              </td>
              <td>{x.type}</td>
              <td>{x.source}</td>
              <td>
                <Severity value={x.severity} />
              </td>
              <td>{x.added}</td>
              <td>{ar(x.matches)}</td>
            </tr>
          ))}
        </Table>
        <Result rows={rows.length} total={data.iocs.length} />
      </Panel>
    </>
  );
}
