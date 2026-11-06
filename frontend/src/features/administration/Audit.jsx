import React, { useState } from 'react';
import { ChevronLeft, Download, FileClock, LockKeyhole, SearchCheck } from 'lucide-react';
import {
  ar,
  Avatar,
  Button,
  ltr,
  PageHeading,
  Panel,
  PanelHeading,
  SearchInput,
  Select,
  Status,
  Table,
  Tag,
} from '../../shared/ui/index';

import { auditExportSchema } from '../export/export-schema';
import { includes, Row } from './AdministrationTable';
export function Audit({ data, openDetail, openModal, exportData }) {
  const [q, setQ] = useState(''),
    [actor, setActor] = useState('all');
  const actors = [...new Set(data.audit.map(x => x.actor))];
  const rows = data.audit.filter(x => includes(x, q) && (actor === 'all' || x.actor === actor));
  return (
    <>
      <PageHeading
        title="سجل التدقيق"
        subtitle="مسار واضح للعمليات الحساسة والتغييرات على بيانات المنصة."
        actions={
          <>
            <Button icon={SearchCheck} onClick={() => openModal('verifyAudit')}>
              فحص السلامة
            </Button>
            <Button
              icon={Download}
              onClick={() =>
                exportData('سجل التدقيق', rows, {
                  allRows: data.audit,
                  columns: auditExportSchema,
                  visibleColumns: auditExportSchema.map(c => c.id),
                })
              }
            >
              تصدير السجل
            </Button>
          </>
        }
      />
      <div className="audit-banner">
        <div className="audit-lock">
          <LockKeyhole size={22} />
        </div>
        <div>
          <strong>سجل للإضافة فقط في التصميم</strong>
          <p>
            يُعرض السجل دون أدوات تعديل أو حذف. آلية التجزئة والتحقق الفعلي تُنفّذ لاحقًا في الخادم.
          </p>
        </div>
        <Tag color="green">APPEND-ONLY DESIGN</Tag>
      </div>
      <Panel className="data-panel">
        <PanelHeading
          title="سجل العمليات"
          subtitle="كل عملية مرتبطة بمنفّذ ووقت وكيان متأثر"
          icon={FileClock}
          aside={<Tag color="blue">{ar(rows.length)} سجل</Tag>}
        />
        <div className="filter-bar">
          <SearchInput value={q} onChange={setQ} placeholder="بحث بالعملية أو الكيان أو المنفذ" />
          <div className="filter-controls">
            <Select value={actor} onChange={setActor} ariaLabel="المنفذ">
              <option value="all">كل المنفذين</option>
              {actors.map(a => (
                <option key={a}>{a}</option>
              ))}
            </Select>
            <button
              className="reset-filter"
              onClick={() => {
                setQ('');
                setActor('all');
              }}
            >
              إعادة ضبط
            </button>
          </div>
        </div>
        <Table
          head={[
            'الوقت',
            'العملية',
            'المنفّذ',
            'الكيان المتأثر',
            'عنوان المصدر',
            'النتيجة',
            'بصمة توضيحية',
            '',
          ]}
          empty={!rows.length}
        >
          {rows.map(x => (
            <Row key={x.id} onClick={() => openDetail('audit', x.id)}>
              <td>
                <div className="record-title">
                  {ltr(x.time, 'mono strong')}
                  <small>{x.date}</small>
                </div>
              </td>
              <td>
                <strong>{x.action}</strong>
              </td>
              <td>
                <div className="owner-cell">
                  <Avatar name={x.actor} small />
                  {x.actor}
                </div>
              </td>
              <td>{ltr(x.entity, 'mono')}</td>
              <td>{ltr(x.ip, 'mono')}</td>
              <td>
                <Status value={x.result} />
              </td>
              <td>{ltr(x.hash, 'mono cell-muted')}</td>
              <td>
                <button className="table-arrow" aria-label={`عرض ${x.id}`}>
                  <ChevronLeft size={16} />
                </button>
              </td>
            </Row>
          ))}
        </Table>
        <div className="table-footer">
          <span>عرض {ar(rows.length)} سجلًا من عينة التدقيق</span>
          <span>للقراءة فقط</span>
        </div>
      </Panel>
    </>
  );
}
