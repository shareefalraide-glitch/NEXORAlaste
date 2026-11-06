import {useLandmarkScope} from '../../shared/hooks/landmark-scope';
import React, {useState} from 'react';
import {Activity, ArrowDown, ArrowLeft, ArrowUp, Boxes, Cable, ClipboardCheck, Clock3, DatabaseBackup, FileCode2, Fingerprint, GitCompareArrows, GitPullRequest, Link2, ShieldAlert, ShieldCheck, UserRound} from 'lucide-react';
import {ar, Button, InfoBox, Tag} from '../../shared/ui/index';
import {SAMPLE_END_UTC,localSampleTime} from '../../shared/lib/time-scope';
import {defaultInvestigation} from '../investigations/workspace/IncidentWorkspace';
import {BUSINESS_CONTEXT,VULNERABILITY_SAMPLES} from '../../data/fixtures/mock-context';

function Expandable({title,subtitle,icon:Icon,badge='تصوّر',className='',children}){
 return <details className={`experience-module ${className}`}><summary><span><span className="experience-module-icon"><Icon size={19}/></span><span><strong>{title}</strong><small>{subtitle}</small></span></span><Tag color="blue">{badge}</Tag></summary><div className="experience-module-body">{children}</div></details>;
}

const followups={'INC-2026-084':'2026-10-29T07:15:00Z','INC-2026-083':'2026-10-29T06:55:00Z','INC-2026-082':'2026-10-29T08:00:00Z'};
const policy={'حرجة':{ack:15,resolution:240},'عالية':{ack:30,resolution:480},'متوسطة':{ack:60,resolution:1440}};
export function followupFor(incident){
 const value=followups[incident?.id],time=value?Date.parse(value):null;
 if(!Number.isFinite(time))return {time:null,minutes:null,label:'لا موعد عينة',color:'neutral'};
 const minutes=Math.round((time-SAMPLE_END_UTC)/60000);
 return {time,minutes,label:minutes<0?`تجاوز افتراضي ${ar(Math.abs(minutes))} د`:`متبقٍ افتراضي ${ar(minutes)} د`,color:minutes<0?'amber':'neutral'};
}
export function SlaPreview({incident,investigations,setInvestigations,offlineSimulation=false}){
 const landmark=useLandmarkScope();
 const [reason,setReason]=useState('');
 const target=policy[incident.severity],follow=followupFor(incident),escalation=investigations[incident.id]?.escalation;
 const save=()=>{const text=reason.trim();if(!text||offlineSimulation)return;setInvestigations(current=>({...current,[incident.id]:{...(current[incident.id]||defaultInvestigation()),escalation:{reason:text}}}));setReason('')};
 const remove=()=>setInvestigations(current=>{const next={...(current[incident.id]||defaultInvestigation())};delete next.escalation;return {...current,[incident.id]:next}});
 return <section className="sla-preview" aria-label={landmark('المتابعة وأهداف الخدمة التجريبية')}><div className="context-heading"><span><Clock3 size={17}/> المتابعة وأهداف الخدمة</span><Tag color={follow.color}>{follow.label}</Tag></div>
  <div className="sla-grid"><div><span>موعد متابعة المثال</span><strong>{follow.time===null?'غير متاح':<bdi dir="ltr">{localSampleTime(follow.time,true)}</bdi>}</strong><small>مقارنة بنهاية العينة الثابتة، لا بالوقت الحالي</small></div><div><span>هدف الإقرار المقترح</span><strong>{target?`${ar(target.ack)} دقيقة`:'غير محدد'}</strong><small>لا يتوفر وقت إقرار موثوق لقياس الالتزام</small></div><div><span>هدف الحل المقترح</span><strong>{target?`${ar(target.resolution)} دقيقة`:'غير محدد'}</strong><small>لا يتوفر وقت حل موثوق لقياس الالتزام</small></div></div>
  <InfoBox>الأهداف أمثلة حسب الخطورة، وموعد المتابعة محدد يدويًا في العينة. لا تُحسب ساعات عمل أو حالة التزام SLA، ولا يُرسل تصعيد تلقائي.</InfoBox>
  <div className="escalation-draft"><label>سبب مقترح تصعيد غير حساس<input aria-label="سبب مقترح التصعيد" value={reason} maxLength={180} disabled={offlineSimulation} onChange={e=>setReason(e.target.value)} placeholder="مثال: مراجعة بشرية مطلوبة" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();save()}}}/></label><Button type="button" disabled={!reason.trim()||offlineSimulation} onClick={save}>تسجيل مقترح محلي</Button></div>
  {escalation&&<div className="escalation-saved"><span><strong>مقترح للجلسة فقط</strong><small>{escalation.reason} · لم يُرسل إلى أحد</small></span><button type="button" disabled={offlineSimulation} onClick={remove}>حذف المقترح</button></div>}
 </section>;
}

export function RuleStudio({data,openDetail,ruleDrafts,setRuleDrafts,offlineSimulation=false}){
 const [id,setId]=useState(data.rules[0]?.id||'');
 const rule=data.rules.find(r=>r.id===id)||data.rules[0];
 if(!rule)return <Expandable title="هندسة الكشف" subtitle="مسودات ومراجعات شكلية" icon={GitPullRequest} className="rule-studio"><p className="detail-muted">لا توجد قاعدة في العينة لبدء المسودة.</p></Expandable>;
 const draft=ruleDrafts[rule.id]||{name:rule.name,description:rule.desc,stage:'مسودة'};
 const conditions=Array.isArray(draft.conditions)?draft.conditions:[],conditionsValid=conditions.every(c=>c.value.trim()),changed=draft.name!==rule.name||draft.description!==rule.desc||conditions.length>0;
 const patch=values=>{if(offlineSimulation)return;setRuleDrafts(current=>({...current,[rule.id]:{...(current[rule.id]||{name:rule.name,description:rule.desc,stage:'مسودة'}),...values}}))};
 const edit=(key,value)=>patch({[key]:value,stage:'مسودة'});
 const discard=()=>setRuleDrafts(current=>{const next={...current};delete next[rule.id];return next});
 return <Expandable title="هندسة الكشف" subtitle="مسودة وفروق ومراجعة شكلية داخل مكتبة القواعد" icon={GitPullRequest} badge="الجلسة فقط" className="rule-studio">
  <InfoBox>المسودة لا تغيّر القاعدة الأساسية، ولا تُشغّل Sigma أو Suricata، ولا تُنشر أو تُعتمد على خادم. المقارنة هنا نصية فقط.</InfoBox>
  <label className="experience-field">القاعدة الأصلية<select aria-label="قاعدة مسودة هندسة الكشف" value={rule.id} onChange={e=>setId(e.target.value)}>{data.rules.map(r=><option value={r.id} key={r.id}>{r.id} · {r.name}</option>)}</select></label>
  <div className="studio-fields"><label>اسم المسودة<input aria-label="اسم مسودة القاعدة" value={draft.name} maxLength={120} disabled={offlineSimulation} onChange={e=>edit('name',e.target.value)}/></label><label>الوصف المقترح<textarea aria-label="وصف مسودة القاعدة" value={draft.description} maxLength={400} rows="3" disabled={offlineSimulation} onChange={e=>edit('description',e.target.value)}/></label></div>
  <div className="rule-condition-builder"><div><strong>شروط المسودة الوصفية</strong><small>لا تتوفر شروط الأصل في العينة؛ هذه ليست ترجمة لقاعدة فعلية ولا تُنفّذ.</small></div>{conditions.map((c,index)=><div className="rule-condition-row" key={index}><label>الحقل<select aria-label={`حقل شرط القاعدة ${ar(index+1)}`} value={c.field} disabled={offlineSimulation} onChange={e=>patch({conditions:conditions.map((x,i)=>i===index?{...x,field:e.target.value}:x),stage:'مسودة'})}><option>نوع الحدث</option><option>النتيجة</option><option>المصدر</option><option>المنفذ</option></select></label><label>المقارنة<select aria-label={`مقارنة شرط القاعدة ${ar(index+1)}`} value={c.operator} disabled={offlineSimulation} onChange={e=>patch({conditions:conditions.map((x,i)=>i===index?{...x,operator:e.target.value}:x),stage:'مسودة'})}><option>يساوي</option><option>يحتوي</option><option>لا يساوي</option></select></label><label>القيمة<input aria-label={`قيمة شرط القاعدة ${ar(index+1)}`} value={c.value} maxLength={80} disabled={offlineSimulation} onChange={e=>patch({conditions:conditions.map((x,i)=>i===index?{...x,value:e.target.value}:x),stage:'مسودة'})}/></label><button type="button" disabled={offlineSimulation} aria-label={`حذف شرط القاعدة ${ar(index+1)}`} onClick={()=>patch({conditions:conditions.filter((_,i)=>i!==index),stage:'مسودة'})}>حذف</button></div>)}<button type="button" disabled={offlineSimulation||conditions.length>=4} onClick={()=>patch({conditions:[...conditions,{field:'نوع الحدث',operator:'يساوي',value:''}],stage:'مسودة'})}>إضافة شرط وصفي</button>{!conditionsValid&&<small className="rule-condition-warning">أدخل قيمة لكل شرط قبل طلب المراجعة الشكلية.</small>}</div>
  <div className="studio-comparison"><div><small>الأساس · بيانات القاعدة</small><strong>{rule.name}</strong><p>{rule.desc}</p></div><div><small>المقترح · مسودة محلية</small><strong>{draft.name||'اسم غير محدد'}</strong><p>{draft.description||'وصف غير محدد'}</p></div></div>
  <div className="studio-status"><span><GitCompareArrows size={16}/> {changed?'توجد فروق في المسودة':'لا توجد فروق في المسودة'} · <strong>{draft.stage}</strong></span><Tag color="blue">لا نشر فعلي</Tag></div>
  <div className="extension-actions"><Button type="button" disabled={offlineSimulation||!changed||!draft.name.trim()||!conditionsValid||draft.stage!=='مسودة'} onClick={()=>patch({stage:'بانتظار مراجعة شكلية'})}>طلب مراجعة تجريبية</Button><Button type="button" disabled={offlineSimulation||draft.stage!=='بانتظار مراجعة شكلية'} onClick={()=>patch({stage:'مراجعة شكلية للجلسة'})}>تسجيل مراجعة شكلية</Button><Button type="button" disabled={offlineSimulation||!ruleDrafts[rule.id]} onClick={discard}>حذف المسودة</Button><Button type="button" onClick={()=>openDetail('rule',rule.id)}>فتح القاعدة الأصلية</Button></div>
  <p className="experience-footnote">تُحفظ المسودة في ذاكرة الجلسة حتى إعادة التحميل أو الخروج؛ لا تُعد المراجعة موافقة شخصية أو سياسة صلاحيات.</p>
 </Expandable>;
}

const integrations=[
 {id:'zeek',name:'Zeek / Suricata',kind:'محرك تحليل أو كشف',direction:'معالجة سجلات واردة',detail:'أدوات تحليل تستخدمها المستشعرات؛ ليست أجهزة المؤسسة نفسها.'},
 {id:'syslog',name:'Syslog',kind:'بروتوكول سجلات',direction:'استقبال وارد مقترح',detail:'طريقة نقل سجلات، لا اسمًا لجهاز أو اتصالًا قائمًا.'},
 {id:'netflow',name:'NetFlow',kind:'صيغة تدفقات',direction:'استقبال تدفقات مقترح',detail:'صيغة أو طريقة لتصدير بيانات التدفق من جهاز مُصدِّر.'},
 {id:'webhook',name:'Webhook',kind:'تكامل خارجي مقترح',direction:'إرسال صادر مقترح',detail:'واجهة لتصور إرسال إشعار مستقبلي؛ لا يوجد عنوان أو موصل مهيأ.'}
];
export function IntegrationHub(){
 const [selected,setSelected]=useState('zeek'),active=integrations.find(x=>x.id===selected);
 return <Expandable title="مركز التكاملات المقترحة" subtitle="أنواع وأدوار واتجاهات التكامل في التصميم" icon={Cable} badge="غير مهيأة" className="integration-hub">
  <InfoBox>اختر نوعًا لقراءة تصوره. لا يوجد اختبار اتصال أو ربط أو بيانات اعتماد، ولا تُعرض هذه الأمثلة كمصادر متصلة.</InfoBox>
  <div className="integration-grid">{integrations.map(item=><button type="button" key={item.id} aria-pressed={item.id===selected} onClick={()=>setSelected(item.id)}><Link2 size={17}/><span><strong dir="ltr">{item.name}</strong><small>{item.kind}</small></span><Tag>غير مختبر</Tag></button>)}</div>
  <div className="integration-explainer"><div><strong dir="ltr">{active.name}</strong><Tag color="blue">{active.direction}</Tag></div><p>{active.detail}</p><small>الإعداد والاتصال والتحقق وإدارة الأسرار تحتاج خدمات خلفية لاحقًا.</small></div>
 </Expandable>;
}

export function BusinessImpact({assetId,compact=false}){
 const landmark=useLandmarkScope();
 const context=BUSINESS_CONTEXT[assetId];
 return <section className={`business-context ${compact?'compact':''}`} aria-label={landmark('أثر الأعمال التجريبي')}><div className="context-heading"><span><Boxes size={17}/> سياق الخدمة وأثر الأعمال</span><Tag color="blue">وصف عينة</Tag></div>
  {context?<><div className="business-grid"><div><small>الخدمة</small><strong>{context.service}</strong></div><div><small>المالك</small><strong>{context.owner}</strong></div><div><small>الأولوية الوصفية</small><strong>{context.priority}</strong></div><div><small>المصدر</small><strong>{context.source}</strong></div></div><p>{context.effect} لا توجد خسارة مالية محسوبة أو تقييم أثر تشغيلي فعلي.</p></>:<p>لا تتوفر بيانات خدمة أو أثر لهذا الأصل في العينة؛ عدم التوفر لا يعني عدم وجود أثر.</p>}
 </section>;
}
export function VulnerabilityForAsset({assetId}){
 const landmark=useLandmarkScope();
 const rows=VULNERABILITY_SAMPLES.filter(x=>x.assetId===assetId);
 return <section className="vulnerability-context" aria-label={landmark('مراجعات الثغرات التوضيحية')}><div className="context-heading"><span><Fingerprint size={17}/> مراجعات ثغرات توضيحية</span><Tag>{ar(rows.length)} مثال</Tag></div><p className="experience-footnote">ليست نتائج فحص ولا معرّفات CVE؛ لا يمكن استنتاج وجود ثغرة أو خلو الأصل منها.</p>
  {rows.length?rows.map(row=><article className="vulnerability-record" key={row.id}><div><strong>{row.title}</strong><Tag color="amber">{row.status}</Tag></div><small><bdi dir="ltr">{row.id}</bdi> · {row.source} · وقت الرصد: {row.observedAt}</small><p>{row.next}</p></article>):<p className="detail-muted">لا تتوفر مراجعة في العينة لهذا الأصل؛ ليست نتيجة فحص سليمة.</p>}
 </section>;
}
export function VulnerabilityIntelligence({data,openDetail}){
 const [filter,setFilter]=useState('all');
 const examples=VULNERABILITY_SAMPLES.filter(x=>data.assets.some(a=>a.id===x.assetId));
 const rows=filter==='all'?examples:examples.filter(x=>x.assetId===filter);
 return <Expandable title="سياق مراجعات الثغرات" subtitle="أمثلة غير متحققة مرتبطة بالأصول" icon={Fingerprint} badge="ليست نتائج فحص" className="vuln-module">
  <InfoBox>الأمثلة أوصاف مدخلة يدويًا، وليست اكتشافًا أو CVE أو نتيجة فحص. الأصول الأخرى «غير متاحة البيانات» وليست خالية من الثغرات.</InfoBox>
  <label className="experience-field">الأصل<select aria-label="تصفية مراجعات الثغرات بالأصل" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">كل الأصول</option>{data.assets.map(asset=><option value={asset.id} key={asset.id}>{asset.name}</option>)}</select></label>
  <div className="module-record-list">{rows.map(row=>{const asset=data.assets.find(a=>a.id===row.assetId);return <button type="button" key={row.id} onClick={()=>openDetail('asset',row.assetId)}><span><strong>{row.title}</strong><small><bdi dir="ltr">{row.id}</bdi> · {asset?.name} · وقت الرصد غير متاح</small></span><Tag color="amber">غير متحقق</Tag><ArrowLeft size={14}/></button>})}{!rows.length&&<p className="detail-muted">لا توجد بيانات مثال لهذا الأصل، ولا يعني ذلك خلوه من الثغرات.</p>}</div>
 </Expandable>;
}

export function BackupRecovery(){
 const [view,setView]=useState('backup');
 return <section className="backup-recovery" aria-label="تصور النسخ والاستعادة"><div className="experience-intro"><span><DatabaseBackup size={19}/></span><div><strong>النسخ والاستعادة</strong><p>تصور لإدارة بيانات منصة مستقبلية، منفصل عن النسخة الاحتياطية لملفات المشروع.</p></div><Tag>غير متاح</Tag></div>
  <InfoBox tone="amber">لا يوجد خادم أو جدول نسخ أو مخزن أو اختبار سلامة أو استعادة لبيانات المنصة في هذا النموذج. الأزرار التشغيلية غير متاحة.</InfoBox>
  <div className="experience-pills" role="group" aria-label="معاينة النسخ أو الاستعادة"><button type="button" aria-pressed={view==='backup'} onClick={()=>setView('backup')}>خطة النسخ</button><button type="button" aria-pressed={view==='recovery'} onClick={()=>setView('recovery')}>خطة الاستعادة</button></div>
  {view==='backup'?<div className="backup-plan"><div><span>آخر نسخة لبيانات المنصة</span><strong>غير متاح</strong></div><div><span>الجدولة والتشفير</span><strong>تحتاج خادمًا وإعدادًا</strong></div><div><span>التحقق من السلامة</span><strong>لم يُنفّذ</strong></div></div>:<ol className="recovery-plan"><li>تحديد نسخة موثوقة ومصدرها.</li><li>التحقق من صلاحية الاستعادة والموافقات.</li><li>استعادة في بيئة مناسبة ثم مراجعة النتائج.</li></ol>}
  <div className="extension-actions"><Button type="button" disabled aria-describedby="backup-disabled-reason">بدء نسخ فعلي</Button><Button type="button" disabled aria-describedby="backup-disabled-reason">استعادة فعلية</Button></div><p id="backup-disabled-reason" className="experience-footnote">غير متاح دون تنفيذ خلفي وصلاحيات ومخزن بيانات؛ لم يُنفّذ أي إجراء.</p>
 </section>;
}
