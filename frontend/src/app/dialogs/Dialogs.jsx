import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { Button, enterToSubmit, InfoBox, Modal, Status, Tag } from '../../shared/ui/index';

import { normalizeMac } from '../../shared/lib/mac';
import { validIp, validVlan } from '../../features/assets/asset-model';

import AdvancedSearch from '../../features/search/AdvancedSearch';

import DemoCopilot from '../../features/search/DemoCopilot';
import RuleSimulation from '../../features/detection/RuleSimulation';
import { FORM_TYPES, initialDialogValues, dialogTitle } from './dialog-state';
import { submitDialog } from './dialog-submit';
import { IncidentForms } from './components/IncidentForms';
import { AssetForms } from './components/AssetForms';
import { AdministrationForms } from './components/AdministrationForms';
import { SourceForms } from './components/SourceForms';
import { ReportPreview } from './components/ReportPreview';

export default function Dialogs({
  modal,
  close,
  data,
  update,
  add,
  bulkAlerts,
  createIncident,
  notify,
  go,
  openDetail,
  openModal,
  exportData,
  timeRange = '24h',
  copilotHistory = [],
  setCopilotHistory,
  offlineSimulation = false,
  pageOptions = [],
  currentPage,
  activeDetail,
  toggleTheme,
}) {
  const [values, setValues] = useState(() => initialDialogValues(modal, data, timeRange));
  const [wizardStep, setWizardStep] = useState(0),
    [confirmDiscard, setConfirmDiscard] = useState(false),
    [macAttempted, setMacAttempted] = useState(false),
    [interfaceAttempted, setInterfaceAttempted] = useState(false);
  const initialValues = useRef(JSON.stringify(values)),
    dirtyRef = useRef(false);
  dirtyRef.current =
    !!modal && FORM_TYPES.includes(modal.type) && JSON.stringify(values) !== initialValues.current;
  const requestClose = useCallback(() => {
    if (dirtyRef.current) {
      setConfirmDiscard(true);
      return;
    }
    close();
  }, [close]);
  const cancelDiscard = useCallback(() => setConfirmDiscard(false), []);
  useEffect(() => {
    const beforeUnload = e => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);
  const set = (k, v) => setValues(s => ({ ...s, [k]: v }));
  if (!modal) return null;
  const p = modal.payload || {};
  const incident = data.incidents.find(x => x.id === p.id);
  const title = dialogTitle(modal);
  const doSubmit = e =>
    submitDialog(e, {
      modal,
      p,
      incident,
      values,
      data,
      notify,
      update,
      close,
      bulkAlerts,
      add,
      createIncident,
    });
  const manualSubmit = e => {
    e.preventDefault();
    const form =
      e.currentTarget.tagName === 'FORM' ? e.currentTarget : e.currentTarget.closest('form');
    if (form?.querySelector('[data-form-submit]')?.disabled) return;
    if (form && !form.reportValidity()) return;
    if (
      ['newAsset', 'editAsset', 'assetInterface', 'addSource', 'editSource'].includes(modal.type) &&
      normalizeMac(values.mac) === null
    ) {
      setMacAttempted(true);
      if (modal.type === 'addSource' && wizardStep !== 0) {
        setWizardStep(0);
        requestAnimationFrame(() =>
          document.querySelector('.modal-form input[name="mac"]')?.focus(),
        );
      } else form?.querySelector('input[name="mac"]')?.focus();
      return;
    }
    if (modal.type === 'newAsset' && !validIp(values.ip)) {
      setInterfaceAttempted(true);
      form?.querySelector('input[name="asset-ip"]')?.focus();
      return;
    }
    if (modal.type === 'assetInterface' && (!validIp(values.ip) || !validVlan(values.vlan))) {
      setInterfaceAttempted(true);
      form
        ?.querySelector(
          !validIp(values.ip) ? 'input[name="interface-ip"]' : 'input[name="interface-vlan"]',
        )
        ?.focus();
      return;
    }
    if (modal.type === 'addSource') {
      if (!values.name.trim()) {
        setWizardStep(0);
        notify('أدخل اسمًا للمصدر قبل المتابعة.', 'error');
        return;
      }
      if (wizardStep < 2) {
        setWizardStep(step => step + 1);
        return;
      }
    }
    doSubmit(e);
  };
  const formTypes = FORM_TYPES;

  return (
    <>
      <Modal
        title={title}
        subtitle={
          modal.type === 'report'
            ? 'محتوى عربي قابل للطباعة، ببيانات توضيحية'
            : 'نموذج واجهات تجريبي'
        }
        onClose={requestClose}
        wide={['report', 'search'].includes(modal.type)}
      >
        {formTypes.includes(modal.type) ? (
          <form
            onSubmit={manualSubmit}
            onKeyDown={enterToSubmit(manualSubmit)}
            className="modal-form"
          >
            <IncidentForms
              modal={modal}
              incident={incident}
              p={p}
              values={values}
              set={set}
              requestClose={requestClose}
              manualSubmit={manualSubmit}
              data={data}
            />
            <AssetForms
              modal={modal}
              p={p}
              values={values}
              set={set}
              requestClose={requestClose}
              manualSubmit={manualSubmit}
              data={data}
              interfaceAttempted={interfaceAttempted}
              macAttempted={macAttempted}
              setMacAttempted={setMacAttempted}
            />
            <AdministrationForms
              modal={modal}
              values={values}
              set={set}
              requestClose={requestClose}
              manualSubmit={manualSubmit}
              notify={notify}
            />
            <SourceForms
              modal={modal}
              p={p}
              values={values}
              set={set}
              requestClose={requestClose}
              manualSubmit={manualSubmit}
              wizardStep={wizardStep}
              setWizardStep={setWizardStep}
              macAttempted={macAttempted}
              setMacAttempted={setMacAttempted}
            />
          </form>
        ) : (
          <div className="modal-content">
            {modal.type === 'testRule' && (
              <RuleSimulation
                rule={p}
                timeRange={timeRange}
                close={close}
                openDetail={openDetail}
              />
            )}
            {modal.type === 'modelAction' && (
              <>
                <InfoBox tone="amber" title="واجهة فقط">
                  {p.action} تتطلب خدمة النموذج وحوكمة نسخ حقيقية. لن يبدأ تدريب أو استعادة في هذا
                  النموذج.
                </InfoBox>
                <div className="modal-actions">
                  <Button onClick={close}>إغلاق</Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      notify('تمت محاكاة الطلب في الواجهة فقط');
                      close();
                    }}
                  >
                    محاكاة الطلب
                  </Button>
                </div>
              </>
            )}
            {modal.type === 'baselineInfo' && (
              <>
                <p className="modal-lead">
                  يُبنى خط أساس مستقل لكل أصل لمدة ١٤ يومًا أو حتى ١٠٠٬٠٠٠ حدث، أيهما أولًا. خلال
                  التأسيس لا تُصدر درجة شذوذ تشغيلية، ويعمل مسار القواعد فقط.
                </p>
                <div className="modal-actions">
                  <Button onClick={close}>فهمت</Button>
                </div>
              </>
            )}
            {modal.type === 'sourceDetail' && (
              <>
                <div className="detail-badges">
                  <Tag color="blue">{p.name}</Tag>
                  <Status value={p.health || 'غير متصل'} />
                </div>
                <div className="source-details-grid">
                  <div className="preview-field">
                    <span>نوع المصدر</span>
                    <strong>{p.kind}</strong>
                  </div>
                  <div className="preview-field">
                    <span>الموقع</span>
                    <strong>{p.location || 'غير محدد'}</strong>
                  </div>
                  <div className="preview-field">
                    <span>عنوان MAC للواجهة</span>
                    <strong dir="ltr">{p.mac || '—'}</strong>
                  </div>
                  <div className="preview-field">
                    <span>طريقة جمع البيانات</span>
                    <strong>
                      <bdi dir="ltr">{p.method || '—'}</bdi>{' '}
                      <small>· {p.methodType || 'غير محددة'}</small>
                    </strong>
                  </div>
                  <div className="preview-field">
                    <span>آخر استقبال تجريبي</span>
                    <strong>{p.lastSeen || '—'}</strong>
                  </div>
                  <div className="preview-field">
                    <span>انحراف الساعة التوضيحي</span>
                    <strong>{p.drift && p.drift !== '—' ? `${p.drift} ثانية` : '—'}</strong>
                  </div>
                  <div className="preview-field">
                    <span>معرّف المصدر</span>
                    <strong dir="ltr">{p.id || '—'}</strong>
                  </div>
                </div>
                <InfoBox>
                  يُعرض اسم الجهاز أو المستشعر كمصدر، وتُعرض أداة الاستشعار أو بروتوكول الاستقبال
                  كتفصيل منفصل. الحالة هنا توضيحية فقط.
                </InfoBox>
                <div className="modal-actions">
                  <Button onClick={close}>إغلاق</Button>
                </div>
              </>
            )}
            {modal.type === 'mitreDetail' && (
              <>
                <div className="detail-badges">
                  <Tag color="blue">{p.id}</Tag>
                  <Tag
                    color={
                      p.status === 'enabled'
                        ? 'green'
                        : p.status === 'disabled'
                          ? 'amber'
                          : 'neutral'
                    }
                  >
                    {p.status === 'enabled'
                      ? 'قاعدة مفعّلة'
                      : p.status === 'disabled'
                        ? 'قاعدة معطّلة فقط'
                        : 'لا توجد قاعدة في العينة'}
                  </Tag>
                  <Tag>غير مختبرة فعليًا</Tag>
                </div>
                <h3>{p.name}</h3>
                <p className="modal-lead">
                  حالة الربط منفصلة عن نتيجة الاختبار. وجود قاعدة مفعّلة لا يثبت فعالية الكشف.
                </p>
                {p.linkedRules?.length ? (
                  <div className="experience-linked-rules">
                    {p.linkedRules.map(rule => (
                      <button
                        type="button"
                        key={rule.id}
                        onClick={() => {
                          close();
                          openDetail('rule', rule.id);
                        }}
                      >
                        <span>
                          <bdi dir="ltr">{rule.id}</bdi> · {rule.name}
                        </span>
                        <Status value={rule.enabled ? 'نشط' : 'غير نشط'} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="detail-muted">
                    لا توجد قاعدة مرتبطة بهذه التقنية ضمن العينة الحالية.
                  </p>
                )}
                <div className="modal-actions">
                  <Button onClick={close}>إغلاق</Button>
                  <Button
                    icon={ArrowLeft}
                    onClick={() => {
                      close();
                      go('rules');
                    }}
                  >
                    عرض القواعد
                  </Button>
                </div>
              </>
            )}
            {modal.type === 'mitreExport' && (
              <>
                <p className="modal-lead">
                  صدّر صفوف التقنيات وحالة ارتباطها بالقواعد في ملف CSV تجريبي. لا يمثل الملف
                  تقييمًا أمنيًا فعليًا.
                </p>
                <div className="modal-actions">
                  <Button onClick={close}>إغلاق</Button>
                  <Button
                    variant="primary"
                    icon={Download}
                    onClick={() => {
                      exportData('تغطية MITRE', p.rows || []);
                      close();
                    }}
                  >
                    تصدير CSV
                  </Button>
                </div>
              </>
            )}
            {modal.type === 'verifyAudit' && (
              <>
                <InfoBox tone="amber" title="التحقق الفعلي غير متاح">
                  البصمات في هذه الواجهة تجريبية. يتطلب التحقق من سلسلة التجزئة خدمة وقاعدة بيانات
                  آمنتين في مرحلة التنفيذ.
                </InfoBox>
                <div className="modal-actions">
                  <Button onClick={close}>إغلاق</Button>
                </div>
              </>
            )}
            {modal.type === 'help' && (
              <>
                <p className="modal-lead">
                  ابدأ من نظرة عامة، ثم افتح أي حادثة أو تنبيه لاستكشاف السياق وشرح الخطورة. استخدم
                  القائمة للتنقل إلى الأحداث، تحليل الشبكة التجريبي، الأصول، الكشف والإدارة.
                </p>
                <InfoBox title="ما الذي يعمل الآن؟">
                  التصفية والبحث والحوارات والتعديلات المؤقتة والتصدير تعمل على عينة محلية. لا توجد
                  مراقبة أو مصادقة أو إجراءات أمنية فعلية.
                </InfoBox>
                <div className="modal-actions">
                  <Button onClick={close}>فهمت</Button>
                </div>
              </>
            )}
            {modal.type === 'workspace' && (
              <>
                <div className="preview-field">
                  <span>مساحة العمل الحالية</span>
                  <strong>المؤسسة التجريبية</strong>
                </div>
                <InfoBox>مساحة توضيحية واحدة، ولا توجد مؤسسات أو حسابات مرتبطة بخادم.</InfoBox>
                <div className="modal-actions">
                  <Button onClick={close}>إغلاق</Button>
                  <Button
                    icon={ArrowLeft}
                    onClick={() => {
                      close();
                      go('settings');
                    }}
                  >
                    إعدادات المساحة
                  </Button>
                </div>
              </>
            )}
            {modal.type === 'about' && (
              <>
                <p className="modal-lead">
                  NEXORA منصة مقترحة لكشف شذوذ الشبكات وإدارة الحوادث السيبرانية. هذا نموذج واجهات
                  عربي مبني على تقرير المشروع.
                </p>
                <InfoBox>
                  الإصدار الحالي للعرض التفاعلي فقط ولا يمثل نظامًا أمنيًا تشغيليًا.
                </InfoBox>
                <div className="modal-actions">
                  <Button onClick={close}>إغلاق</Button>
                </div>
              </>
            )}
            {modal.type === 'copilot' && (
              <DemoCopilot
                data={data}
                timeRange={timeRange}
                close={close}
                openDetail={openDetail}
                go={go}
                initialIncidentId={p.incidentId || ''}
                history={copilotHistory}
                setHistory={setCopilotHistory}
                offlineSimulation={offlineSimulation}
              />
            )}
            {modal.type === 'search' && (
              <AdvancedSearch
                data={data}
                close={close}
                openDetail={openDetail}
                go={go}
                openModal={openModal}
                pageOptions={pageOptions}
                currentPage={currentPage}
                activeDetail={activeDetail}
                toggleTheme={toggleTheme}
                timeRange={timeRange}
              />
            )}
            {modal.type === 'report' && (
              <ReportPreview
                modal={modal}
                p={p}
                values={values}
                set={set}
                data={data}
                close={close}
                exportData={exportData}
              />
            )}
          </div>
        )}
      </Modal>
      {confirmDiscard && (
        <Modal title="تغييرات غير محفوظة" subtitle="تأكيد مغادرة النموذج" onClose={cancelDiscard}>
          <div className="modal-content">
            <InfoBox tone="amber">لديك تعديلات لم تُحفظ في هذا النموذج. هل تريد تجاهلها؟</InfoBox>
            <div className="modal-actions">
              <Button type="button" onClick={cancelDiscard}>
                متابعة التعديل
              </Button>
              <Button type="button" variant="primary" onClick={close}>
                تجاهل التغييرات
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
