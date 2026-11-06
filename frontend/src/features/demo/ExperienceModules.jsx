import React, {useState} from 'react';
import {Activity, ArrowLeft, Boxes, ClipboardList, Clock3, Copy, Eye, Radio, ShieldAlert} from 'lucide-react';
import {SAMPLE_END_UTC,PERIOD_LABELS,inPeriod} from '../../shared/lib/time-scope';
import {ar, Button, InfoBox, Tag} from '../../shared/ui/index';
import {followupFor} from './ProductExtensions';

function Module({title,subtitle,icon:Icon,badge,children}){return <details className="experience-module"><summary><span><span className="experience-module-icon"><Icon size={19}/></span><span><strong>{title}</strong><small>{subtitle}</small></span></span><Tag color="blue">{badge||'عينة'}</Tag></summary><div className="experience-module-body">{children}</div></details>}
const exposure={
 'AST-001':{scope:'داخلي · مثال',note:'خدمة مصادقة داخلية افتراضية'},
 'AST-002':{scope:'داخلي · مثال',note:'قاعدة بيانات داخلية افتراضية'},
 'AST-007':{scope:'خارجي · افتراضي',note:'خدمة ويب خلف واجهة نشر مفترضة؛ لا تُستنتج من IP الخاص'}
};
export function AttackSurface({data,openDetail}){
 return <Module title="سطح التعرّض" subtitle="سياق الأصول المعروفة وغير المقيّمة في المثال" icon={Eye} badge="افتراضي">
  <InfoBox>هذه تسميات موضوعة يدويًا في العينة وليست اكتشافًا للأصول أو فحصًا للمنافذ والثغرات. أهمية الأصل لا تساوي درجة خطورته.</InfoBox>
  <div className="module-record-list">{data.assets.map(asset=>{const x=exposure[asset.id];return <button type="button" key={asset.id} onClick={()=>openDetail('asset',asset.id)}><span><strong dir="ltr">{asset.name}</strong><small>{x?.note||'لا تتوفر بيانات تعرّض في العينة'}</small></span><Tag color={x?.scope.startsWith('خارجي')?'amber':'neutral'}>{x?.scope||'غير مقيّم'}</Tag><ArrowLeft size={14}/></button>})}</div>
 </Module>;
}
const healthSamples={
 'SRC-001':{cpu:38,ram:52,received:12000,dropped:30,latency:0.4},
 'SRC-002':{cpu:63,ram:68,received:7100,dropped:12,latency:1.2}
};
export function SensorHealth({data,openDetail}){
 return <Module title="صحة المصادر والمستشعرات" subtitle="مقاييس افتراضية ونطاقات غير متاحة" icon={Radio} badge="لقطة ثابتة">
  <InfoBox>لا يوجد اتصال أو جمع قياسات فعلي. قيما المعالج والذاكرة والفقد أدناه أمثلة اصطناعية لمصدرين؛ بقية المصادر غير متاحة وليست صفرًا. عدادات هذا المثال مستقلة عن عدد الأحداث في بطاقة المصدر.</InfoBox>
  <div className="sensor-grid">{data.sources.map(source=>{const h=healthSamples[source.id];const drop=h?100*h.dropped/(h.received+h.dropped):null;return <button type="button" key={source.id} className="sensor-card" onClick={()=>openDetail('source',source.id)}><div><strong>{source.name}</strong><Tag>{source.method||'غير محدد'}</Tag></div><small>المصدر: {source.kind} · طريقة الجمع منفصلة</small><div className="sensor-values"><span>CPU <b dir="ltr">{h?`${h.cpu}%`:'—'}</b></span><span>RAM <b dir="ltr">{h?`${h.ram}%`:'—'}</b></span><span>فقد عينة <b dir="ltr">{h?`${drop.toFixed(2)}%`:'—'}</b></span><span>تأخر <b dir="ltr">{h?`${h.latency} s`:'—'}</b></span></div><small>{h?`${ar(h.dropped)} مفقود من ${ar(h.received+h.dropped)} متوقّع في المثال`:'القياسات غير متوفرة لهذا المصدر'}</small></button>})}</div>
 </Module>;
}
const behavior={
 'AST-001':{metric:'محاولات مصادقة فاشلة / ساعة',baseline:12,current:23,unit:'محاولة'},
 'AST-002':{metric:'حجم بيانات صادرة / ساعة',baseline:320,current:356,unit:'MB'}
};
export function BehavioralBaselines({data,openDetail}){
 const [selected,setSelected]=useState('AST-001');
 const asset=data.assets.find(x=>x.id===selected)||data.assets[0],sample=asset?.baseline==='مكتمل'?behavior[asset.id]:null;
 return <Module title="خط أساس سلوكي للأصول" subtitle="أمثلة مستقلة عن متوسط حركة الشبكة" icon={Activity} badge="قيمة توضيحية">
  <InfoBox>الأرقام المدخلة مثال ثابت لأصلين، ولا يوجد تدريب نموذج أو قياس سلوك مستخدم أو جهاز. عند التأسيس أو غياب العينة لا تعرض الواجهة درجة تشغيلية.</InfoBox>
  <label className="experience-field">الأصل <select aria-label="أصل خط الأساس السلوكي" value={asset?.id||''} onChange={e=>setSelected(e.target.value)}>{data.assets.map(a=><option value={a.id} key={a.id}>{a.name} · {a.baseline}</option>)}</select></label>
  {sample?<div className="behavior-sample"><div><span>المقياس الافتراضي</span><strong>{sample.metric}</strong></div><div><span>خط الأساس</span><strong dir="ltr">{sample.baseline} {sample.unit}</strong></div><div><span>القيمة في المثال</span><strong dir="ltr">{sample.current} {sample.unit}</strong></div><div><span>الفرق الحسابي</span><strong dir="ltr">+{((sample.current/sample.baseline-1)*100).toFixed(1)}%</strong></div></div>:<p className="detail-muted">{asset?.baseline==='قيد التأسيس'?'الأصل قيد التأسيس؛ لا تُعرض درجة شذوذ.':'لا تتوفر عينة سلوكية لهذا الأصل.'}</p>}
  {asset&&<Button type="button" onClick={()=>openDetail('asset',asset.id)}>فتح الأصل</Button>}
  <p className="experience-footnote">خط أساس الشبكة يحسب متوسط مرور قصير من فواصل اصطناعية؛ هذا المثال يمثل سمة أصل مستقلة، ولا يُشتق أحدهما من الآخر.</p>
 </Module>;
}
export function ShiftHandover({data,openDetail,timeRange='24h',offlineSimulation=false,investigations={},handoverDraft,setHandoverDraft}){
 const [fallback,setFallback]=useState({from:'',to:'',note:'',reviewed:false}),[message,setMessage]=useState('');
 const draft=handoverDraft||fallback,setDraft=setHandoverDraft||setFallback;
 const edit=(key,value)=>{if(!offlineSimulation)setDraft(current=>({...current,[key]:value,reviewed:false}))};
 const openAll=data.incidents.filter(x=>!['مغلقة','إنذار كاذب'].includes(x.status));
 const incidents=openAll.filter(x=>inPeriod(x,'incident',timeRange)),outside=openAll.length-incidents.length;
 const summary=`تسليم توضيحي · ${PERIOD_LABELS[timeRange]} · 29 OCT 2026 10:00 UTC+03\nالمغادر: ${draft.from||'غير محدد'} · المستلم: ${draft.to||'غير محدد'}\n`+incidents.map(x=>{const tasks=investigations[x.id]?.tasks?.filter(t=>!t.done).length;return `${x.id} · ${x.title} · ${x.status} · ${x.owner} · ${followupFor(x).label}${tasks!==undefined?` · مهام متبقية: ${tasks}`:''}`}).join('\n')+(outside?`\nحوادث مفتوحة خارج الفترة: ${outside}`:'')+(draft.note.trim()?`\nملاحظة الجلسة: ${draft.note.trim()}`:'')+'\nمسودة محلية؛ لم تُرسل أو تُعتمد.';
 const copy=async()=>{try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(summary);setMessage('نُسخ ملخص العينة.')}catch{setMessage('النسخ المباشر غير متاح؛ اختر النص وانسخه يدويًا.')}};
 const people=data.users.filter(user=>user.status==='نشط');
 return <Module title="تسليم المناوبة والمواعيد" subtitle="حوادث الفترة ومتابعاتها ومسودة التسليم" icon={ClipboardList} badge="الجلسة فقط">
  <InfoBox>هذه مسودة يدوية لا تُرسل لأحد ولا تُحفظ على خادم. مواعيد المتابعة أمثلة ثابتة، وليست حساب التزام SLA أو تصعيدًا فعليًا.</InfoBox>
  <div className="handover-people"><label>المناوب المغادر<select aria-label="المناوب المغادر" value={draft.from} disabled={offlineSimulation} onChange={e=>edit('from',e.target.value)}><option value="">غير محدد</option>{people.map(u=><option key={u.id} value={u.name}>{u.name}</option>)}</select></label><label>المناوب المستلم<select aria-label="المناوب المستلم" value={draft.to} disabled={offlineSimulation} onChange={e=>edit('to',e.target.value)}><option value="">غير محدد</option>{people.map(u=><option key={u.id} value={u.name}>{u.name}</option>)}</select></label></div>
  {draft.from&&draft.from===draft.to&&<p className="handover-warning">اختر شخصين مختلفين لمراجعة المسودة الشكلية.</p>}
  <div className="handover-scope"><span>{ar(incidents.length)} حادثة مفتوحة ضمن {PERIOD_LABELS[timeRange]}</span><strong>{outside?`${ar(outside)} مفتوحة خارج الفترة`: 'لا حوادث مفتوحة خارج الفترة'}</strong></div>
  <div className="module-record-list">{incidents.map(item=>{const due=followupFor(item),tasks=investigations[item.id]?.tasks?.filter(t=>!t.done).length;return <button type="button" key={item.id} onClick={()=>openDetail('incident',item.id)}><span><strong>{item.title}</strong><small><bdi dir="ltr">{item.id}</bdi> · {item.status} · {item.owner}{tasks!==undefined?` · ${ar(tasks)} مهام متبقية`:''}</small></span><Tag color={due.color}>{due.label}</Tag><ArrowLeft size={14}/></button>})}{!incidents.length&&<p className="detail-muted">لا توجد حوادث مفتوحة ضمن النطاق المختار.</p>}</div>
  <label className="handover-note">ملاحظة تسليم غير حساسة<textarea value={draft.note} disabled={offlineSimulation} maxLength={500} onChange={e=>edit('note',e.target.value)} placeholder="أضف توجيهًا تجريبيًا للجلسة..."/></label>
  <div className="handover-review"><Button type="button" disabled={offlineSimulation||!draft.from||!draft.to||draft.from===draft.to||draft.reviewed} onClick={()=>setDraft(current=>({...current,reviewed:true}))}>مراجعة المسودة محليًا</Button><span>{draft.reviewed?'مراجعة شكلية للجلسة · لم يُرسل التسليم':'مسودة غير مرسلة'}</span></div>
  <details className="hunt-share"><summary>معاينة الملخص ونسخه</summary><label><span className="sr-only">ملخص التسليم</span><textarea aria-label="ملخص التسليم التجريبي" value={summary} readOnly rows="5" onFocus={e=>e.target.select()}/></label><Button type="button" icon={Copy} onClick={copy}>نسخ الملخص</Button><span role="status">{message}</span></details>
 </Module>;
}
