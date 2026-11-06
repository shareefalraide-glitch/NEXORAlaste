import React, { useState } from 'react';
import {
  ChevronLeft,
  CircleHelp,
  Download,
  FileCode2,
  Plus,
  ShieldCheck,
  Waypoints,
} from 'lucide-react';
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
  Switch,
  Table,
} from '../../shared/ui/index';

import { ruleExportSchema } from '../export/export-schema';

import { RuleStudio } from '../demo/ProductExtensions';
import { includes, Result, Row } from './DetectionTable';
export function Rules({
  data,
  update,
  openDetail,
  openModal,
  exportData,
  ruleDrafts,
  setRuleDrafts,
  offlineSimulation,
}) {
  const [q, setQ] = useState(''),
    [source, setSource] = useState('all'),
    [state, setState] = useState('all');
  const rows = data.rules.filter(
    x =>
      includes(x, q) &&
      (source === 'all' || x.source === source) &&
      (state === 'all' || (state === 'enabled') === x.enabled),
  );
  return (
    <>
      <PageHeading
        title="قواعد الكشف"
        subtitle="أدر قواعد الكشف التوقيعي واختبرها على بيانات تاريخية تجريبية."
        actions={
          <>
            <Button
              icon={Download}
              onClick={() =>
                exportData('قواعد الكشف', rows, {
                  allRows: data.rules,
                  columns: ruleExportSchema,
                  visibleColumns: ruleExportSchema.map(c => c.id),
                })
              }
            >
              تصدير
            </Button>
            <Button icon={Plus} variant="primary" onClick={() => openModal('newRule')}>
              إضافة قاعدة
            </Button>
          </>
        }
      />
      <div className="detection-top">
        <Panel className="feature-card">
          <div className="feature-card-icon purple">
            <FileCode2 size={22} />
          </div>
          <div>
            <span>القواعد في العينة</span>
            <strong>{ar(data.rules.length)}</strong>
            <small>قواعد Sigma وSuricata</small>
          </div>
        </Panel>
        <Panel className="feature-card">
          <div className="feature-card-icon green">
            <ShieldCheck size={22} />
          </div>
          <div>
            <span>قواعد مفعّلة</span>
            <strong>{ar(data.rules.filter(x => x.enabled).length)}</strong>
            <small>يمكن تغيير حالتها تجريبيًا</small>
          </div>
        </Panel>
        <Panel className="feature-card">
          <div className="feature-card-icon blue">
            <Waypoints size={22} />
          </div>
          <div>
            <span>مصادر القواعد</span>
            <strong>٢</strong>
            <small dir="ltr">Sigma + Suricata</small>
          </div>
        </Panel>
      </div>
      <Panel className="data-panel">
        <PanelHeading title="مكتبة القواعد" subtitle="القواعد التوقيعية ومطابقتها لتقنيات ATT&CK" />
        <div className="filter-bar">
          <SearchInput value={q} onChange={setQ} placeholder="بحث بالاسم أو المعرّف أو التقنية" />
          <div className="filter-controls">
            <Select value={source} onChange={setSource} ariaLabel="مصدر القاعدة">
              <option value="all">كل المصادر</option>
              <option>Sigma</option>
              <option>Suricata</option>
            </Select>
            <Select value={state} onChange={setState} ariaLabel="حالة القاعدة">
              <option value="all">كل الحالات</option>
              <option value="enabled">مفعّلة</option>
              <option value="disabled">متوقفة</option>
            </Select>
            <button
              className="reset-filter"
              onClick={() => {
                setQ('');
                setSource('all');
                setState('all');
              }}
            >
              إعادة ضبط
            </button>
          </div>
        </div>
        <Table
          head={['القاعدة', 'المصدر', 'الخطورة', 'تقنية ATT&CK', 'آخر تحديث', 'الحالة', '']}
          empty={!rows.length}
        >
          {rows.map(x => (
            <Row key={x.id} onClick={() => openDetail('rule', x.id)}>
              <td>
                <div className="record-title">
                  <strong>{x.name}</strong>
                  {ltr(x.id, 'record-id')}
                </div>
              </td>
              <td>
                <span className="source-tag" dir="ltr">
                  {x.source}
                </span>
              </td>
              <td>
                <Severity value={x.severity} />
              </td>
              <td>{ltr(x.technique, 'mono')}</td>
              <td className="cell-muted nowrap">{x.last}</td>
              <td onClick={e => e.stopPropagation()}>
                <div className="switch-cell">
                  <Switch
                    checked={x.enabled}
                    label={`تفعيل ${x.name}`}
                    onChange={v =>
                      update('rules', x.id, { enabled: v }, `${v ? 'تفعيل' : 'تعطيل'} قاعدة`)
                    }
                  />
                  <span>{x.enabled ? 'مفعّلة' : 'متوقفة'}</span>
                </div>
              </td>
              <td>
                <button className="table-arrow" aria-label={`فتح ${x.id}`}>
                  <ChevronLeft size={16} />
                </button>
              </td>
            </Row>
          ))}
        </Table>
        <Result rows={rows.length} total={data.rules.length} />
      </Panel>
      <RuleStudio
        data={data}
        openDetail={openDetail}
        ruleDrafts={ruleDrafts}
        setRuleDrafts={setRuleDrafts}
        offlineSimulation={offlineSimulation}
      />
      <div className="page-footnote">
        <CircleHelp size={14} /> تغيير القواعد واختبارها هنا محاكاة محلية ولا يؤثر في أي محرك كشف
        حقيقي.
      </div>
    </>
  );
}
