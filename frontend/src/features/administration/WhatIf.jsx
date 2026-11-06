import React, { useState } from 'react';
import { Calculator, RotateCcw } from 'lucide-react';
import { Button, InfoBox, Tag } from '../../shared/ui/index';

const defaults = { rule: '0.45', anomaly: '0.35', asset: '0.12', frequency: '0.08' };
const keys = [
  ['rule', 'شدّة القاعدة'],
  ['anomaly', 'الشذوذ السلوكي'],
  ['asset', 'أهمية الأصل'],
  ['frequency', 'تكرار المصدر'],
];
const field = { rule: 'rule', anomaly: 'anomaly', asset: 'assetScore', frequency: 'frequency' };
const calculate = (incident, weights) =>
  keys.reduce((sum, [key]) => sum + Number(weights[key]) * (Number(incident[field[key]]) || 0), 0);
export default function WhatIf({ data, settingsWeights }) {
  const [incidentId, setIncidentId] = useState(data.incidents[0]?.id || ''),
    [weights, setWeights] = useState(defaults);
  const incident = data.incidents.find(x => x.id === incidentId) || data.incidents[0];
  const total = keys.reduce((n, [k]) => n + (Number(weights[k]) || 0), 0);
  const valid =
    keys.every(
      ([k]) =>
        weights[k] !== '' &&
        Number.isFinite(Number(weights[k])) &&
        Number(weights[k]) >= 0 &&
        Number(weights[k]) <= 1,
    ) && Math.abs(total - 1) < 0.0001;
  const original = incident ? calculate(incident, defaults) : 0,
    alternative = valid && incident ? calculate(incident, weights) : null;
  return (
    <details className="experience-module what-if">
      <summary>
        <span>
          <span className="experience-module-icon">
            <Calculator size={19} />
          </span>
          <span>
            <strong>ماذا لو؟ · محاكي الأوزان</strong>
            <small>قارن نتيجة حسابية على حادثة من العينة</small>
          </span>
        </span>
        <Tag color="blue">محلي</Tag>
      </summary>
      <div className="experience-module-body">
        <InfoBox>
          هذا حساب محلي على قيم ثابتة من العينة، وليس تنبؤًا أو تدريبًا أو معايرة حقيقية. التغيير
          هنا لا يحفظ إعدادات ولا يغيّر درجات السجلات.
        </InfoBox>
        <label className="experience-field">
          الحادثة{' '}
          <select
            aria-label="حادثة محاكاة ماذا لو"
            value={incident?.id || ''}
            onChange={e => setIncidentId(e.target.value)}
          >
            {data.incidents.map(x => (
              <option key={x.id} value={x.id}>
                {x.id} · {x.title}
              </option>
            ))}
          </select>
        </label>
        <div className="whatif-weights">
          {keys.map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                aria-label={`وزن ${label} في المحاكاة`}
                value={weights[key]}
                onChange={e => setWeights(current => ({ ...current, [key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <div className={`whatif-total ${valid ? '' : 'invalid'}`}>
          مجموع الأوزان: <b dir="ltr">{total.toFixed(2)} / 1.00</b>{' '}
          {valid ? '· صالح للمقارنة' : '· يجب أن يكون 1.00، وكل وزن بين 0 و1'}
        </div>
        {incident && (
          <div className="whatif-results">
            <div>
              <span>بالأوزان الافتراضية</span>
              <strong dir="ltr">{original.toFixed(3)}</strong>
            </div>
            <div>
              <span>بالأوزان المحاكية</span>
              <strong dir="ltr">{alternative === null ? '—' : alternative.toFixed(3)}</strong>
            </div>
            <div>
              <span>الفرق الحسابي</span>
              <strong dir="ltr">
                {alternative === null
                  ? '—'
                  : `${alternative - original >= 0 ? '+' : ''}${(alternative - original).toFixed(3)}`}
              </strong>
            </div>
          </div>
        )}
        <div className="whatif-actions">
          <Button type="button" icon={RotateCcw} onClick={() => setWeights({ ...defaults })}>
            الأوزان الافتراضية
          </Button>
          <Button
            type="button"
            onClick={() =>
              setWeights(
                Object.fromEntries(
                  keys.map(([key]) => [key, String(settingsWeights[key] ?? defaults[key])]),
                ),
              )
            }
          >
            نسخ أوزان نموذج الإعدادات
          </Button>
        </div>
      </div>
    </details>
  );
}
