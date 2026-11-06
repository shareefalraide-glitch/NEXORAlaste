import { normalizeMac } from '../../shared/lib/mac.js';
import {
  asciiDigits,
  interfacesOf,
  interfacePatch,
  newAssetRecord,
  primaryInterface,
  primaryMacPatch,
} from '../../features/assets/asset-model.js';

export function submitDialog(
  e,
  { modal, p, incident, values, data, notify, update, close, bulkAlerts, add, createIncident },
) {
  e.preventDefault();
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
  if (modal.type === 'transition') {
    if (!incident) return;
    const allowed = {
      جديدة: 'مسندة',
      مسندة: 'قيد المعالجة',
      'قيد المعالجة': 'محتواة',
      محتواة: 'معالجة',
      معالجة: 'مغلقة',
      مغلقة: 'جديدة',
    };
    if (allowed[incident.status] !== p.next) {
      notify('هذا الانتقال غير متاح', 'error');
      return;
    }
    if (p.next === 'محتواة' && incident.approval !== 'تمت الموافقة') {
      notify('الموافقة البشرية مطلوبة قبل الاحتواء', 'error');
      return;
    }
    const reason = values.reason?.trim();
    const root = values.rootCause?.trim();
    if (p.next === 'جديدة' && !reason) {
      notify('يلزم توثيق طلب إعادة الفتح', 'error');
      return;
    }
    if (p.next === 'مغلقة' && !root) {
      notify('يلزم توثيق السبب الجذري قبل الإغلاق', 'error');
      return;
    }
    const patch = {
      status: p.next,
      owner: p.next === 'مسندة' ? values.owner : incident.owner,
      rootCause: root || incident.rootCause,
      timeline: [
        {
          time,
          session: true,
          title: `تغيير الحالة إلى ${p.next}`,
          detail: reason || root || 'تم تغيير حالة الحادثة في المحاكاة.',
          actor: 'أحمد علي',
        },
        ...incident.timeline,
      ],
    };
    update('incidents', incident.id, patch, 'تغيير حالة حادثة');
    close();
    return;
  }
  if (modal.type === 'falsePositive') {
    if (!incident || incident.status !== 'قيد المعالجة') {
      notify('هذا الإجراء متاح أثناء المعالجة فقط', 'error');
      return;
    }
    const reason = values.reason.trim();
    if (!reason) {
      notify('سبب التصنيف مطلوب', 'error');
      return;
    }
    update(
      'incidents',
      incident.id,
      {
        status: 'إنذار كاذب',
        timeline: [
          { time, session: true, title: 'تصنيف إنذار كاذب', detail: reason, actor: 'أحمد علي' },
          ...incident.timeline,
        ],
      },
      'تصنيف إنذار كاذب',
    );
    close();
    return;
  }
  if (modal.type === 'approval') {
    if (!incident) return;
    const isRequest = p.mode === 'request',
      decision = values.decision,
      reason = values.reason.trim();
    if (
      isRequest &&
      (incident.approval === 'بانتظار الموافقة' || incident.approval === 'تمت الموافقة')
    ) {
      notify('يوجد طلب احتواء مسجل بالفعل', 'error');
      return;
    }
    if (isRequest && !reason) {
      notify('أضف سبب طلب الاحتواء.', 'error');
      return;
    }
    if (!isRequest && (incident.approval !== 'بانتظار الموافقة' || !values.confirm)) {
      notify('راجع الطلب وأكد تسجيل القرار.', 'error');
      return;
    }
    if (!isRequest && !['approve', 'reject', 'return'].includes(decision)) {
      notify('اختر قرارًا صالحًا.', 'error');
      return;
    }
    if (!isRequest && decision !== 'approve' && !reason) {
      notify('سبب الرفض أو الإعادة مطلوب.', 'error');
      return;
    }
    const target =
      values.action === 'حجب عنوان الوجهة'
        ? incident.destinationIp || incident.ip
        : values.action === 'تقييد اتصال الأصل'
          ? incident.ip
          : incident.sourceIp;
    const actionName = isRequest ? values.action : incident.containmentAction,
      actionTarget = isRequest ? target : incident.containmentTarget;
    const status = isRequest
      ? 'بانتظار الموافقة'
      : decision === 'approve'
        ? 'تمت الموافقة'
        : decision === 'reject'
          ? 'مرفوض'
          : 'أعيد للتعديل';
    const label = isRequest
      ? 'إرسال طلب الاحتواء'
      : decision === 'approve'
        ? 'الموافقة على الاحتواء'
        : decision === 'reject'
          ? 'رفض طلب الاحتواء'
          : 'إعادة الطلب للتعديل';
    const oldHistory =
      incident.approvalHistory ||
      (incident.requestedBy
        ? [
            {
              decision: 'إرسال طلب سابق',
              actor: incident.requestedBy,
              time: incident.requestedAt || '—',
              reason: 'تفاصيل الطلب في العينة',
              action: incident.containmentAction,
              target: incident.containmentTarget,
            },
          ]
        : []);
    const entry = {
      decision: label,
      actor: 'أحمد علي',
      time,
      reason: reason || 'قرار تجريبي بعد المراجعة',
      action: actionName || '—',
      target: actionTarget || '—',
    };
    const patch = {
      approval: status,
      containmentAction: actionName,
      containmentTarget: actionTarget,
      requestedBy: isRequest ? 'أحمد علي' : incident.requestedBy,
      requestedAt: isRequest ? time : incident.requestedAt,
      reviewedBy: isRequest ? null : 'أحمد علي',
      reviewedAt: isRequest ? null : time,
      approvedBy: !isRequest && decision === 'approve' ? 'أحمد علي' : null,
      approvedAt: !isRequest && decision === 'approve' ? time : null,
      approvalHistory: [entry, ...oldHistory],
      timeline: [
        {
          time,
          session: true,
          title: `${label} تجريبيًا`,
          detail: `${actionName || 'إجراء'} (${actionTarget || '—'}) · ${entry.reason}؛ لم يُنفّذ إجراء على الشبكة.`,
          actor: 'أحمد علي',
        },
        ...incident.timeline,
      ],
    };
    update('incidents', incident.id, patch, label);
    close();
    return;
  }
  if (modal.type === 'bulkReview' || modal.type === 'bulkAssign') {
    if (!values.confirm || !Array.isArray(p.ids) || !p.ids.length) {
      notify('أكد الإجراء وحدد التنبيهات أولًا.', 'error');
      return;
    }
    if (bulkAlerts(p.ids, modal.type === 'bulkReview' ? 'review' : 'assign', values.owner)) {
      p.onComplete?.();
      close();
    }
    return;
  }
  if (modal.type === 'newAsset') {
    const id = `AST-DEMO-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    add('assets', newAssetRecord(values, id), 'إضافة أصل');
    close();
    return;
  }
  if (modal.type === 'editAsset') {
    const current = data.assets.find(x => x.id === p.id);
    if (!current) return;
    update(
      'assets',
      p.id,
      {
        criticality: values.criticality,
        owner: values.owner,
        group: values.group,
        manufacturer: values.manufacturer.trim(),
        deviceModel: values.deviceModel.trim(),
        operatingSystem: values.operatingSystem.trim(),
        location: values.location.trim(),
        ...primaryMacPatch(current, normalizeMac(values.mac)),
      },
      'تعديل ملف الأصل',
    );
    close();
    return;
  }
  if (modal.type === 'assetInterface') {
    const asset = data.assets.find(x => x.id === p.assetId);
    if (!asset) return;
    const items = interfacesOf(asset),
      id =
        p.interfaceId ||
        `${asset.id}-IF-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const entry = {
      id,
      name: values.name.trim(),
      ip: values.ip.trim(),
      mac: normalizeMac(values.mac),
      vlan: asciiDigits(values.vlan).trim(),
    };
    const next = p.interfaceId ? items.map(x => (x.id === id ? entry : x)) : [...items, entry];
    const primary = values.makePrimary ? id : primaryInterface(asset)?.id || id;
    update(
      'assets',
      asset.id,
      interfacePatch(asset, next, primary),
      p.interfaceId ? 'تعديل واجهة شبكة' : 'إضافة واجهة شبكة',
    );
    close();
    return;
  }
  if (modal.type === 'deleteInterface') {
    const asset = data.assets.find(x => x.id === p.assetId);
    if (!asset || !values.confirm) return;
    const next = interfacesOf(asset).filter(x => x.id !== p.interfaceId);
    update(
      'assets',
      asset.id,
      interfacePatch(asset, next, asset.primaryInterfaceId),
      'حذف واجهة شبكة',
    );
    close();
    p.onComplete?.();
    return;
  }
  if (modal.type === 'newUser') {
    add(
      'users',
      {
        ...values,
        id: `USR-DEMO-${Date.now().toString().slice(-4)}`,
        status: 'نشط',
        last: 'لم يسجّل الدخول',
      },
      'إضافة مستخدم',
    );
    close();
    return;
  }
  if (modal.type === 'editUser') {
    update('users', p.id, { role: values.role, status: values.status }, 'تعديل مستخدم');
    close();
    return;
  }
  if (modal.type === 'newRule') {
    add(
      'rules',
      {
        ...values,
        id: `RULE-DEMO-${Date.now().toString().slice(-4)}`,
        last: 'الآن',
        enabled: false,
      },
      'إضافة قاعدة',
    );
    close();
    return;
  }
  if (modal.type === 'importIoc') {
    const lines = values.text
      .split(/[\n,،]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 50);
    if (!lines.length) {
      notify('أضف مؤشرًا واحدًا على الأقل', 'error');
      return;
    }
    const records = lines.map((value, i) => ({
      id: `IOC-DEMO-${Date.now().toString().slice(-4)}-${i + 1}`,
      type: values.type,
      value,
      source: 'إدخال محلي تجريبي',
      severity: values.severity,
      added: 'الآن',
      matches: 0,
    }));
    add('iocs', records, 'استيراد مؤشرات');
    close();
    return;
  }
  if (modal.type === 'addSource') {
    const methodType =
      {
        Zeek: 'محرك تحليل شبكة',
        Suricata: 'محرك كشف الشبكة',
        Syslog: 'بروتوكول سجلات',
        NetFlow: 'صيغة تدفقات الشبكة',
      }[values.method] || 'طريقة استقبال';
    add(
      'sources',
      {
        ...values,
        mac: normalizeMac(values.mac),
        name: values.name.trim(),
        location: values.location.trim(),
        id: `SRC-DEMO-${Date.now().toString().slice(-5)}`,
        methodType,
        health: 'غير متصل',
        lastSeen: '—',
        events: '٠',
        rate: '٠',
        drift: '—',
      },
      'إضافة مصدر',
    );
    close();
    return;
  }
  if (modal.type === 'editSource') {
    update('sources', p.id, { mac: normalizeMac(values.mac) }, 'تعديل عنوان MAC للمصدر');
    close();
    return;
  }
  if (['newIncident', 'createFromAlert'].includes(modal.type)) {
    if (!values.id || !values.reason?.trim()) {
      notify('حدد التنبيه وأضف سبب الإنشاء', 'error');
      return;
    }
    createIncident(values.id, values.reason.trim());
    close();
    return;
  }
}
