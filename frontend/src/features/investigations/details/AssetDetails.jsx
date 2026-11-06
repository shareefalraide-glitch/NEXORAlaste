import { useLandmarkScope } from '../../../shared/hooks/landmark-scope';
import React, { useRef } from 'react';
import { Activity, ChevronLeft, Plus, Server, ShieldAlert } from 'lucide-react';
import { ar, Button, Empty, InfoBox, ltr, Severity, Status, Tag } from '../../../shared/ui/index';
import { events } from '../../../data/fixtures/demo-records';
import { recordBelongsToAsset } from '../../assets/asset-relations';
import { interfacesOf, interfacePatch, primaryInterface } from '../../assets/asset-model';

import { useSessionValue } from '../../../shared/hooks/session-state';

import { BusinessImpact, VulnerabilityForAsset } from '../../demo/ProductExtensions';
import { DetailGrid, RelatedRecords } from './DetailComponents';
export function AssetDetails({
  item,
  data,
  openModal,
  openDetail,
  update,
  offlineSimulation,
  sessionRef,
  viewScope,
}) {
  const landmark = useLandmarkScope();
  const [tab, setTab] = useSessionValue(
      sessionRef,
      `asset-view:${viewScope}:${item.id}`,
      'tab',
      'overview',
    ),
    addRef = useRef(null);
  const related = data.incidents.filter(x => recordBelongsToAsset(data.assets, x, item));
  const interfaces = interfacesOf(item),
    primary = primaryInterface(item);
  const markPrimary = iface =>
    update('assets', item.id, interfacePatch(item, interfaces, iface.id), 'تغيير الواجهة الرئيسية');
  const remove = iface =>
    openModal('deleteInterface', {
      assetId: item.id,
      interfaceId: iface.id,
      onComplete: () => requestAnimationFrame(() => addRef.current?.focus()),
    });
  return (
    <>
      <div className="detail-badges">
        <Severity value={item.criticality} />
        <Status value={item.baseline} />
      </div>
      <p className="detail-description">
        ملف الأصل وسياقه في العينة؛ بيانات الأجهزة والواجهات توضيحية وغير مكتشفة من الشبكة.
      </p>
      <div className="detail-actions">
        <Button
          icon={Server}
          disabled={offlineSimulation}
          onClick={() => openModal('editAsset', item)}
        >
          تعديل الأصل
        </Button>
      </div>
      <div className="tabs detail-tabs asset-detail-tabs" role="group" aria-label="أقسام ملف الأصل">
        {[
          ['overview', 'الملف والسجلات'],
          ['interfaces', `واجهات الشبكة (${ar(interfaces.length)})`],
          ['history', 'سجل التغييرات'],
          ['context', 'الخدمة والثغرات'],
        ].map(([id, label]) => (
          <button
            type="button"
            key={id}
            className={tab === id ? 'active' : ''}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'overview' && (
        <>
          <DetailGrid
            items={[
              ['عنوان IP', ltr(item.ip || '—', 'mono')],
              ['عنوان MAC للواجهة', ltr(item.mac || '—', 'mono')],
              ['نوع الأصل', item.type],
              ['المالك', item.owner],
              ['الشركة المصنّعة', item.manufacturer || 'غير محدد'],
              ['الطراز', ltr(item.deviceModel || '—', 'mono')],
              ['نظام التشغيل', item.operatingSystem || 'غير محدد'],
              ['الموقع', item.location || 'غير محدد'],
              ['المجموعة', item.group],
              ['حالة الأصل', item.status],
              ['الأحداث في العينة', item.events],
            ]}
          />
          <p className="detail-muted">
            العناوين أعلاه للواجهة الرئيسية فقط؛ يعرض قسم واجهات الشبكة بقية الواجهات المسجلة في
            العينة.
          </p>
          <div className="detail-section-title">
            <span>
              <Activity size={16} /> خط الأساس السلوكي
            </span>
            <Status value={item.baseline} />
          </div>
          {item.baseline === 'قيد التأسيس' ? (
            <InfoBox tone="amber" title="التأسيس جارٍ">
              لا تصدر درجة شذوذ تشغيلية لهذا الأصل حتى مرور ١٤ يومًا أو اكتمال ١٠٠٬٠٠٠ حدث، أيهما
              أولًا.
            </InfoBox>
          ) : (
            <InfoBox tone="green" title="اكتمل التأسيس">
              يمكن مقارنة السلوك بخط الأساس المرجعي الخاص بهذا الأصل. القيم المعروضة تجريبية.
            </InfoBox>
          )}
          <div className="detail-section-title space-top">
            <span>
              <ShieldAlert size={16} /> حوادث مرتبطة
            </span>
            <Tag>{ar(related.length)}</Tag>
          </div>
          <div className="related-list">
            {related.length ? (
              related.map(x => (
                <button
                  className="related-row"
                  key={x.id}
                  onClick={() => openDetail('incident', x.id)}
                >
                  <span className="incident-icon orange">
                    <ShieldAlert size={16} />
                  </span>
                  <span>
                    <strong>{x.title}</strong>
                    <small dir="ltr">{x.id}</small>
                  </span>
                  <Status value={x.status} />
                  <ChevronLeft size={16} />
                </button>
              ))
            ) : (
              <Empty title="لا توجد حوادث مرتبطة" text="لا توجد حوادث لهذا الأصل في العينة." />
            )}
          </div>
          <RelatedRecords
            title="تنبيهات الأصل في العينة"
            items={data.alerts.filter(alert => recordBelongsToAsset(data.assets, alert, item))}
            kind="alert"
            openDetail={openDetail}
          />
          <RelatedRecords
            title="أحداث الأصل في العينة"
            items={events.filter(event => recordBelongsToAsset(data.assets, event, item))}
            kind="event"
            openDetail={openDetail}
          />
        </>
      )}
      {tab === 'context' && (
        <>
          <BusinessImpact assetId={item.id} />
          <VulnerabilityForAsset assetId={item.id} />
        </>
      )}
      {tab === 'interfaces' && (
        <section className="asset-interfaces" aria-label={landmark('واجهات الشبكة المسجلة')}>
          <div className="asset-section-head">
            <div>
              <h3>واجهات الشبكة</h3>
              <p>العناوين اختيارية وVLAN بين ١ و٤٠٩٤؛ لا تُرسل إعدادات لأي جهاز.</p>
            </div>
            <button
              ref={addRef}
              type="button"
              className="btn btn-secondary"
              disabled={offlineSimulation}
              onClick={() => openModal('assetInterface', { assetId: item.id })}
            >
              <Plus size={15} /> إضافة واجهة
            </button>
          </div>
          {interfaces.length ? (
            <div className="interface-list">
              {interfaces.map(iface => (
                <article className="interface-card" key={iface.id}>
                  <div className="interface-card-head">
                    <div>
                      <strong dir="ltr">{iface.name}</strong>
                      <small dir="ltr">{iface.id}</small>
                    </div>
                    {iface.id === primary?.id && <Tag color="blue">الرئيسية</Tag>}
                  </div>
                  <div className="interface-values">
                    <div>
                      <span>عنوان IP</span>
                      {ltr(iface.ip || '—', 'mono')}
                    </div>
                    <div>
                      <span>عنوان MAC</span>
                      {ltr(iface.mac || '—', 'mono')}
                    </div>
                    <div>
                      <span>VLAN</span>
                      {ltr(iface.vlan || '—', 'mono')}
                    </div>
                  </div>
                  <div className="interface-actions">
                    <Button
                      disabled={offlineSimulation}
                      aria-label={`تعديل الواجهة ${iface.name}`}
                      onClick={() =>
                        openModal('assetInterface', { assetId: item.id, interfaceId: iface.id })
                      }
                    >
                      تعديل
                    </Button>
                    {iface.id !== primary?.id && (
                      <Button
                        disabled={offlineSimulation}
                        aria-label={`جعل الواجهة ${iface.name} رئيسية`}
                        onClick={() => markPrimary(iface)}
                      >
                        تعيين رئيسية
                      </Button>
                    )}
                    <Button
                      disabled={offlineSimulation}
                      aria-label={`حذف الواجهة ${iface.name}`}
                      onClick={() => remove(iface)}
                    >
                      حذف
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty title="لا توجد واجهات مسجلة" text="يمكن إضافة واجهة إلى سجل الأصل في العينة." />
          )}
          {offlineSimulation && (
            <p className="detail-muted">محاكاة الانقطاع: الواجهات للقراءة فقط.</p>
          )}
        </section>
      )}
      {tab === 'history' && (
        <section className="asset-history" aria-label={landmark('سجل تغييرات الأصل')}>
          <div className="asset-section-head">
            <div>
              <h3>سجل التغييرات</h3>
              <p>سجل محلي توضيحي لهذه الجلسة، وليس سجل تدقيق دائمًا.</p>
            </div>
            <Tag>{ar((item.history || []).length)}</Tag>
          </div>
          {(item.history || []).length ? (
            <ol>
              {item.history.map(entry => (
                <li key={entry.id}>
                  <span className="asset-history-dot" />
                  <div>
                    <strong>{entry.action}</strong>
                    <p>{entry.detail}</p>
                    <small>
                      {entry.actor} · <bdi dir="auto">{entry.time}</bdi>
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <Empty title="لا توجد تغييرات مسجلة" text="ستظهر تعديلات هذه الجلسة هنا." />
          )}
        </section>
      )}
    </>
  );
}
