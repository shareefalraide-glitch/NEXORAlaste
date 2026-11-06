import React from 'react';
import {
  Activity,
  CalendarDays,
  Clock3,
  Download,
  FileBarChart2,
  FileCheck2,
  FileClock,
  FileText,
  Plus,
  Shield,
} from 'lucide-react';
import { Button, PageHeading, Panel, PanelHeading, Tag } from '../../shared/ui/index';

import { inPeriod } from '../../shared/lib/time-scope';

import ReportDesigner from './ReportDesigner';

import {
  alertExportSchema,
  incidentExportSchema,
  auditExportSchema,
} from '../export/export-schema';

const reports = [
  {
    name: 'ملخص الحوادث الأمنية',
    desc: 'عرض الحوادث وتوزيعها وحالاتها خلال الفترة المختارة.',
    type: 'الحوادث',
    icon: Shield,
    color: 'blue',
  },
  {
    name: 'التقرير التنفيذي',
    desc: 'نظرة موجزة على نشاط الشبكة ومؤشرات الاستجابة.',
    type: 'التنفيذي',
    icon: FileBarChart2,
    color: 'purple',
  },
  {
    name: 'تقرير التنبيهات والكشف',
    desc: 'تحليل التنبيهات حسب الخطورة ومصدر الكشف.',
    type: 'التنبيهات',
    icon: Activity,
    color: 'cyan',
  },
  {
    name: 'تقرير سجل التدقيق',
    desc: 'ملخص العمليات الحساسة وسجل نشاط المستخدمين.',
    type: 'التدقيق',
    icon: FileCheck2,
    color: 'amber',
  },
];
export function Reports({ openModal, exportData, data, timeRange = '24h' }) {
  const scopedIncidents = data.incidents.filter(x =>
    inPeriod(x, 'incident', timeRange, { includeUndated: false }),
  );
  const scopedAlerts = data.alerts.filter(x =>
    inPeriod(x, 'alert', timeRange, { includeUndated: false }),
  );
  return (
    <>
      <PageHeading
        title="التقارير"
        subtitle="حوّل نشاط المنصة إلى تقارير واضحة قابلة للمشاركة."
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => openModal('report', { type: 'الحوادث' })}
          >
            إنشاء تقرير
          </Button>
        }
      />
      <ReportDesigner data={data} timeRange={timeRange} exportData={exportData} />
      <div className="reports-header">
        <div>
          <h2>تقارير جاهزة</h2>
          <p>اختر قالبًا للمعاينة أو إصدار نسخة تجريبية</p>
        </div>
        <span className="updated-label">
          <CalendarDays size={14} /> عينة توضيحية
        </span>
      </div>
      <div className="report-grid">
        {reports.map(r => (
          <Panel className="report-card" key={r.type}>
            <div className="report-top">
              <span className={`feature-card-icon ${r.color}`}>
                <r.icon size={21} />
              </span>
              <Tag>{r.type}</Tag>
            </div>
            <h3>{r.name}</h3>
            <p>{r.desc}</p>
            <div className="report-meta">
              <span>
                <Clock3 size={14} /> فترة قابلة للتحديد
              </span>
              <span>عربي · RTL</span>
            </div>
            <div className="report-actions">
              <Button icon={FileText} onClick={() => openModal('report', { type: r.type })}>
                معاينة التقرير
              </Button>
              <button
                className="icon-button"
                title="تصدير عينة CSV"
                aria-label={`تصدير ${r.name}`}
                onClick={() =>
                  exportData(
                    r.name,
                    r.type === 'التنبيهات'
                      ? scopedAlerts
                      : r.type === 'التدقيق'
                        ? data.audit
                        : scopedIncidents,
                    {
                      columns:
                        r.type === 'التنبيهات'
                          ? alertExportSchema
                          : r.type === 'التدقيق'
                            ? auditExportSchema
                            : incidentExportSchema,
                    },
                  )
                }
              >
                <Download size={17} />
              </button>
            </div>
          </Panel>
        ))}
      </div>
      <Panel className="report-history">
        <PanelHeading
          title="تقرير حادثة تفصيلي"
          subtitle="الخط الزمني والإجراءات والسياق المرتبط"
          icon={FileClock}
        />
        <div className="report-history-row">
          <span className="file-box">
            <FileText size={19} />
          </span>
          <div>
            <strong>تقرير حادثة تجريبية</strong>
            <p>يتضمن أحداثًا وإجراءات توضيحية قابلة للطباعة</p>
          </div>
          <Button icon={FileText} onClick={() => openModal('report', { type: 'حادثة تفصيلية' })}>
            عرض النموذج
          </Button>
        </div>
      </Panel>
      <div className="page-footnote">
        <Shield size={14} /> التصدير السريع للحوادث والتنبيهات يتبع الفترة العامة؛ سجل التدقيق لقطة
        مستقلة. التقرير التنفيذي يصدر سجلات الحوادث فقط.
      </div>
    </>
  );
}
