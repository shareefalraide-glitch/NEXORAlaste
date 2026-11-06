import React from 'react';
import { FileCode2, Play } from 'lucide-react';
import { Button, ltr, Severity, Tag } from '../../../shared/ui/index';

import { DetailGrid } from './DetailComponents';
export function RuleDetails({ item, openModal, update }) {
  return (
    <>
      <h3 className="drawer-record-title">{item.name}</h3>
      <div className="detail-badges">
        <Severity value={item.severity} />
        <Tag color="blue">{item.source}</Tag>
        <Tag color={item.enabled ? 'green' : 'neutral'}>{item.enabled ? 'مفعّلة' : 'متوقفة'}</Tag>
      </div>
      <p className="detail-description">{item.desc}</p>
      <div className="detail-actions">
        <Button icon={Play} variant="primary" onClick={() => openModal('testRule', item)}>
          اختبار على عينة
        </Button>
        <Button
          onClick={() =>
            update(
              'rules',
              item.id,
              { enabled: !item.enabled },
              `${item.enabled ? 'تعطيل' : 'تفعيل'} قاعدة`,
            )
          }
        >
          {item.enabled ? 'تعطيل القاعدة' : 'تفعيل القاعدة'}
        </Button>
      </div>
      <DetailGrid
        items={[
          ['المعرّف', ltr(item.id, 'mono')],
          ['مصدر القاعدة', ltr(item.source, 'mono')],
          ['تقنية ATT&CK', ltr(item.technique, 'mono')],
          ['آخر تحديث', item.last],
        ]}
      />
      <div className="detail-section-title">
        <span>
          <FileCode2 size={16} /> وصف القاعدة
        </span>
      </div>
      <div className="rule-explanation">
        <p>{item.desc}</p>
        <small>اختبار القاعدة هنا محاكاة تجربة مستخدم فقط، ولا يشغّل محرك قواعد.</small>
      </div>
    </>
  );
}
