import React from 'react';
import { ChevronLeft, CircleHelp, Download, Plus, Server, Upload } from 'lucide-react';
import {
  ar,
  Button,
  ltr,
  PageHeading,
  Panel,
  PanelHeading,
  Select,
  Severity,
  Status,
  Table,
  Tag,
} from '../../shared/ui/index';

import { AttackSurface } from '../demo/ExperienceModules';
import { VulnerabilityIntelligence } from '../demo/ProductExtensions';
import { matchesMac } from '../../shared/lib/mac';
import { interfacesOf } from './asset-model';
import { BaselineSummary } from '../../shared/charts/Visuals';

import NamedViews from '../../shared/components/NamedViews';
import RecordComparison from '../../shared/components/RecordComparison';

import { useSessionValue } from '../../shared/hooks/session-state';
import { assetExportSchema } from '../export/export-schema';
import { oneOf, matches, FilterBar, ResultCount, Row } from '../operations/OperationsTable';
export function Assets({ data, openDetail, openModal, exportData, sessionRef }) {
  const [q, setQ] = useSessionValue(sessionRef, 'assets', 'q', ''),
    [criticality, setCriticality] = useSessionValue(sessionRef, 'assets', 'criticality', 'all'),
    [baseline, setBaseline] = useSessionValue(sessionRef, 'assets', 'baseline', 'all');
  const rows = data.assets.filter(
    x =>
      (matches(x, q) ||
        interfacesOf(x).some(iface => matches(iface, q) || matchesMac(iface.mac, q))) &&
      (criticality === 'all' || x.criticality === criticality) &&
      (baseline === 'all' || x.baseline === baseline),
  );
  return (
    <>
      <PageHeading
        title="إدارة الأصول"
        subtitle="تتبّع الأصول المراقبة وسياقها وأهميتها لاحتساب الخطورة."
        actions={
          <>
            <Button
              icon={Download}
              onClick={() =>
                exportData('الأصول', rows, {
                  allRows: data.assets,
                  columns: assetExportSchema,
                  visibleColumns: assetExportSchema
                    .filter(c => c.id !== 'interfaceDetails')
                    .map(c => c.id),
                })
              }
            >
              تصدير
            </Button>
            <Button icon={Upload} onClick={() => openModal('importAssets')}>
              استيراد CSV
            </Button>
            <Button icon={Plus} variant="primary" onClick={() => openModal('newAsset')}>
              إضافة أصل
            </Button>
          </>
        }
      />
      <div className="incident-kpis asset-kpis">
        <div>
          <span>الأصول في العينة</span>
          <strong>{ar(data.assets.length)}</strong>
          <small>أصول تجريبية</small>
        </div>
        <div>
          <span>أصول حرجة</span>
          <strong>{ar(data.assets.filter(x => x.criticality === 'حرجة').length)}</strong>
          <small>تتطلب اهتمامًا أعلى</small>
        </div>
        <div>
          <span>خط الأساس مكتمل</span>
          <strong>{ar(data.assets.filter(x => x.baseline === 'مكتمل').length)}</strong>
          <small>جاهزة للكشف السلوكي</small>
        </div>
        <div>
          <span>قيد التأسيس</span>
          <strong className="amber-text">
            {ar(data.assets.filter(x => x.baseline === 'قيد التأسيس').length)}
          </strong>
          <small>لا تصدر لها درجة شذوذ</small>
        </div>
      </div>
      <RecordComparison kind="asset" records={data.assets} openDetail={openDetail} />
      <BaselineSummary assets={data.assets} />
      <AttackSurface data={data} openDetail={openDetail} />
      <VulnerabilityIntelligence data={data} openDetail={openDetail} />
      <Panel className="data-panel">
        <PanelHeading
          title="سجل الأصول"
          subtitle="انقر على الأصل لعرض تفاصيله وسياقه"
          aside={<Tag color="blue">{ar(rows.length)} أصل</Tag>}
        />
        <FilterBar
          search={q}
          setSearch={setQ}
          placeholder="بحث باسم الأصل أو عنوان IP أو MAC أو المالك"
          onReset={() => {
            setQ('');
            setCriticality('all');
            setBaseline('all');
          }}
        >
          <Select value={criticality} onChange={setCriticality} ariaLabel="أهمية الأصل">
            <option value="all">كل مستويات الأهمية</option>
            {['حرجة', 'متوسطة', 'منخفضة'].map(s => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Select value={baseline} onChange={setBaseline} ariaLabel="حالة خط الأساس">
            <option value="all">كل حالات التأسيس</option>
            <option>مكتمل</option>
            <option>قيد التأسيس</option>
          </Select>
        </FilterBar>
        <NamedViews
          scope="assets"
          current={{ criticality, baseline }}
          onApply={v => {
            setQ('');
            setCriticality(oneOf(v.criticality, ['all', 'حرجة', 'متوسطة', 'منخفضة']));
            setBaseline(oneOf(v.baseline, ['all', 'مكتمل', 'قيد التأسيس']));
          }}
          sessionRef={sessionRef}
          presets={[
            { name: 'الأصول الحرجة', value: { criticality: 'حرجة' } },
            { name: 'الأصول قيد التأسيس', value: { baseline: 'قيد التأسيس' } },
          ]}
        />
        <Table
          head={[
            'الأصل',
            'النوع',
            'عنوان IP',
            'عنوان MAC',
            'الواجهات',
            'الأهمية',
            'المالك',
            'خط الأساس',
            'التنبيهات',
            '',
          ]}
          empty={rows.length === 0}
        >
          {rows.map(x => (
            <Row key={x.id} onClick={() => openDetail('asset', x.id)}>
              <td>
                <div className="incident-cell">
                  <span className="incident-icon blue">
                    <Server size={16} />
                  </span>
                  <div>
                    <strong dir="ltr">{x.name}</strong>
                    <small dir="ltr">{x.id}</small>
                  </div>
                </div>
              </td>
              <td>{x.type}</td>
              <td>{ltr(x.ip || '—', 'mono')}</td>
              <td>{ltr(x.mac || '—', 'mono')}</td>
              <td>{ar(interfacesOf(x).length)}</td>
              <td>
                <Severity value={x.criticality} />
              </td>
              <td>{x.owner}</td>
              <td>
                <Status value={x.baseline} />
              </td>
              <td>{ar(x.alerts)}</td>
              <td>
                <button className="table-arrow" aria-label={`فتح ${x.name}`}>
                  <ChevronLeft size={16} />
                </button>
              </td>
            </Row>
          ))}
        </Table>
        <ResultCount count={rows.length} total={data.assets.length} />
      </Panel>
      <div className="page-footnote">
        <CircleHelp size={14} /> يبدأ الكشف السلوكي بعد اكتمال ١٤ يومًا أو ١٠٠٬٠٠٠ حدث، أيهما أولًا.
        القيم توضيحية.
      </div>
    </>
  );
}
