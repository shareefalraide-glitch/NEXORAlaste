<div dir="rtl" lang="ar">

# 📘 كتالوج API وحالة التنفيذ

هذه الجداول فهرس قابل للقراءة للملفين الرسميين في `contracts/`. المسارات المخططة غير موجودة في الخادم؛ العقود المقترحة قابلة للمراجعة والتغيير، ولا تُعد دليل تكامل أو كشف. عددها ليس وعدًا نهائيًا بأن جميع احتياجات المنصة قد حُسمت.

## 🔌 العمليات المنفذة في Go (32)

**الصلاحيات:** الصحة عامة؛ الدخول والتحديث عامان مع حد محلي؛ الاستقبال الداخلي برمز المصدر؛ المستخدمون وتعديل الأصول وإدارة رموز المصادر للمدير؛ قراءة القوائم للأدوار المسموحة؛ كتابة التحقيق للمدير أو المحلل أو المستجيب؛ التدقيق للمدير أو المدقق. تفاصيل الطلب والاستجابة والأخطاء في `contracts/openapi.json`.

| الطريقة | المسار | العملية |
|---|---|---|
| `GET` | `/health/live` | `healthLive` |
| `GET` | `/health/ready` | `healthReady` |
| `POST` | `/api/v1/auth/login` | `login` |
| `POST` | `/api/v1/auth/refresh` | `refresh` |
| `POST` | `/api/v1/auth/logout` | `logout` |
| `GET` | `/api/v1/auth/me` | `getCurrentUser` |
| `GET` | `/api/v1/users` | `listUsers` |
| `POST` | `/api/v1/users` | `createUser` |
| `GET` | `/api/v1/assets` | `listAssets` |
| `POST` | `/api/v1/assets` | `createAsset` |
| `GET` | `/api/v1/assets/{id}` | `getAsset` |
| `PATCH` | `/api/v1/assets/{id}` | `updateAsset` |
| `GET` | `/api/v1/sources` | `listSources` |
| `POST` | `/api/v1/sources` | `createSource` |
| `GET` | `/api/v1/sources/{id}` | `getSource` |
| `POST` | `/api/v1/sources/{id}/token-rotations` | `rotateSourceToken` |
| `POST` | `/api/v1/sources/{id}/token-revocations` | `revokeSourceToken` |
| `POST` | `/internal/v1/event-batches` | `ingestNormalizedEvents` |
| `GET` | `/api/v1/events` | `listEvents` |
| `GET` | `/api/v1/events/{id}` | `getEvent` |
| `GET` | `/api/v1/incidents` | `listIncidents` |
| `POST` | `/api/v1/incidents` | `createIncident` |
| `GET` | `/api/v1/incidents/{id}` | `getIncident` |
| `POST` | `/api/v1/incidents/{id}/transitions` | `transitionIncident` |
| `GET` | `/api/v1/incidents/{id}/notes` | `listIncidentNotes` |
| `POST` | `/api/v1/incidents/{id}/notes` | `createIncidentNote` |
| `GET` | `/api/v1/incidents/{id}/tasks` | `listIncidentTasks` |
| `POST` | `/api/v1/incidents/{id}/tasks` | `createIncidentTask` |
| `PATCH` | `/api/v1/incidents/{id}/tasks/{task_id}` | `updateIncidentTask` |
| `GET` | `/api/v1/dashboard/summary` | `getDashboardSummary` |
| `GET` | `/api/v1/audit` | `listAudit` |
| `GET` | `/api/v1/audit/verify` | `verifyAudit` |

ملخص اللوحة الحالي يحسب السجلات المخزنة والحوادث اليدوية والأصول الحالية فقط؛ `alerts: null` و`detection: not_implemented`. لا يُعد احتواءً أو كشفًا. تدقيق القاعدة لا يملك مرساة خارجية.

## 🔌 العمليات المخططة — غير منفذة (100)

كل صف أدناه مسودة بمالك **مسار** مقترح P1–P5، لا اسم شخص ولا موافقة نهائية على تصميمه. راجع `planning/TEAM_PLAN.md` وملف `planned.openapi.json` لحقول الطلب والاستجابة والقيود. يجب تثبيت مصفوفة صلاحية لكل عملية قبل التنفيذ.

| المجال | الطريقة | المسار | العملية | المسار المسؤول | المتطلبات |
|---|---|---|---|---|---|
| Identity | `POST` | `/api/v1/auth/mfa/challenges` | `createMfaChallenge` | P1 | SR-01 |
| Identity | `POST` | `/api/v1/auth/mfa/verify` | `verifyMfaChallenge` | P1 | SR-01 |
| Identity | `POST` | `/api/v1/auth/password-resets` | `requestPasswordReset` | P1 | SR-01 |
| Identity | `POST` | `/api/v1/auth/password-resets/confirm` | `confirmPasswordReset` | P1 | SR-01 |
| Identity | `GET` | `/api/v1/auth/sessions` | `listSessions` | P1 | SR-01 |
| Identity | `POST` | `/api/v1/auth/sessions/{id}/revoke` | `revokeSession` | P1 | SR-01 |
| Identity | `PATCH` | `/api/v1/users/{id}` | `updateUser` | P1 | FR-15, SR-02 |
| Identity | `GET` | `/api/v1/users/{id}` | `getUser` | P1 | FR-15 |
| Identity | `GET` | `/api/v1/roles` | `listRoles` | P1 | FR-15, SR-02 |
| Identity | `POST` | `/api/v1/roles` | `createRole` | P1 | FR-15, SR-02 |
| Identity | `PATCH` | `/api/v1/roles/{id}` | `updateRole` | P1 | FR-15, SR-02 |
| Assets | `GET` | `/api/v1/assets/{id}/interfaces` | `listAssetInterfaces` | P2 | FR-16 |
| Assets | `POST` | `/api/v1/assets/{id}/interfaces` | `createAssetInterface` | P2 | FR-16 |
| Assets | `PATCH` | `/api/v1/assets/{id}/interfaces/{interface_id}` | `updateAssetInterface` | P2 | FR-16 |
| Assets | `DELETE` | `/api/v1/assets/{id}/interfaces/{interface_id}` | `deleteAssetInterface` | P2 | FR-16 |
| Assets | `GET` | `/api/v1/assets/{id}/context` | `getAssetContext` | P2 | FR-03 |
| Assets | `GET` | `/api/v1/assets/{id}/vulnerabilities` | `listAssetVulnerabilities` | P2 |  |
| Assets | `POST` | `/api/v1/asset-imports/preview` | `previewAssetImport` | P2 | FR-16 |
| Assets | `POST` | `/api/v1/asset-imports/{id}/commit` | `commitAssetImport` | P2 | FR-16 |
| Sources | `PATCH` | `/api/v1/sources/{id}` | `updateSource` | P2 | FR-01 |
| Sources | `GET` | `/api/v1/sources/{id}/health` | `getSourceHealth` | P2 | FR-01 |
| Events | `POST` | `/api/v1/events/search` | `searchEvents` | P2 | FR-14 |
| Alerts | `GET` | `/api/v1/alerts` | `listAlerts` | P4 | FR-08, FR-14 |
| Alerts | `GET` | `/api/v1/alerts/{id}` | `getAlert` | P4 | FR-08 |
| Alerts | `POST` | `/api/v1/alerts/{id}/triage` | `triageAlert` | P4 | FR-08, FR-12 |
| Alerts | `POST` | `/api/v1/alerts/bulk-triage` | `bulkTriage` | P4 | FR-12 |
| Investigations | `GET` | `/api/v1/incidents/{id}/timeline` | `getIncidentTimeline` | P4 | FR-09, FR-19 |
| Investigations | `GET` | `/api/v1/incidents/{id}/alerts` | `listIncidentAlerts` | P4 | FR-08 |
| Investigations | `POST` | `/api/v1/incidents/{id}/alerts` | `linkIncidentAlert` | P4 | FR-08 |
| Evidence | `GET` | `/api/v1/incidents/{id}/evidence` | `listEvidence` | P4 | FR-12, SR-02 |
| Evidence | `POST` | `/api/v1/incidents/{id}/evidence` | `stageEvidence` | P4 | FR-12, SR-02 |
| Evidence | `GET` | `/api/v1/evidence/{id}/custody` | `listCustody` | P4 | FR-12 |
| Evidence | `POST` | `/api/v1/evidence/{id}/custody` | `recordCustody` | P4 | FR-12 |
| Evidence | `POST` | `/api/v1/evidence/{id}/verify` | `verifyEvidence` | P4 | FR-12 |
| Response | `GET` | `/api/v1/incidents/{id}/response-actions` | `listResponseActions` | P4 | FR-11, FR-12 |
| Response | `POST` | `/api/v1/incidents/{id}/response-actions` | `proposeResponseAction` | P4 | FR-11, FR-12 |
| Response | `POST` | `/api/v1/response-actions/{id}/approvals` | `reviewResponseAction` | P4 | FR-11, SR-02 |
| Response | `POST` | `/api/v1/response-actions/{id}/execute` | `executeApprovedAction` | P4 | FR-11, SR-02 |
| Investigations | `GET` | `/api/v1/incidents/{id}/notebook` | `getNotebook` | P4 |  |
| Investigations | `GET` | `/api/v1/notebook-templates` | `listNotebookTemplates` | P5 |  |
| Investigations | `POST` | `/api/v1/notebook-templates` | `createNotebookTemplate` | P5 |  |
| Investigations | `GET` | `/api/v1/incidents/{id}/graph` | `getInvestigationGraph` | P4 |  |
| Investigations | `POST` | `/api/v1/investigation-comparisons` | `compareInvestigations` | P5 |  |
| Investigations | `POST` | `/api/v1/incidents/{id}/timeline-comparisons` | `compareIncidentPeriods` | P5 |  |
| Investigations | `POST` | `/api/v1/graph-comparisons` | `compareGraphs` | P5 |  |
| Detection | `GET` | `/api/v1/rules` | `listRules` | P3 | FR-05, FR-17 |
| Detection | `POST` | `/api/v1/rules` | `createRuleDraft` | P3 | FR-17 |
| Detection | `GET` | `/api/v1/rules/{id}` | `getRule` | P3 | FR-17 |
| Detection | `PATCH` | `/api/v1/rules/{id}` | `updateRuleDraft` | P3 | FR-17 |
| Detection | `POST` | `/api/v1/rules/{id}/tests` | `testRule` | P3 | FR-17 |
| Detection | `POST` | `/api/v1/rules/{id}/reviews` | `reviewRule` | P3 | FR-17 |
| Detection | `POST` | `/api/v1/rules/{id}/activation` | `activateRule` | P3 | FR-17 |
| Intelligence | `GET` | `/api/v1/indicators` | `listIndicators` | P3 | FR-18 |
| Intelligence | `POST` | `/api/v1/indicator-imports` | `importIndicators` | P3 | FR-18 |
| Detection | `GET` | `/api/v1/mitre/coverage` | `getMitreCoverage` | P3 | FR-23 |
| ML | `GET` | `/api/v1/ml/models` | `listModels` | P3 | FR-25–29 |
| ML | `GET` | `/api/v1/ml/models/{id}` | `getModel` | P3 | FR-25–29 |
| ML | `POST` | `/api/v1/ml/training-jobs` | `requestModelTraining` | P3 | FR-25–28 |
| ML | `GET` | `/api/v1/ml/training-jobs/{id}` | `getTrainingJob` | P3 | FR-27–28 |
| ML | `POST` | `/api/v1/ml/models/{id}/approve` | `approveModel` | P3 | FR-28, FR-12 |
| ML | `POST` | `/api/v1/ml/models/{id}/rollback` | `rollbackModel` | P3 | FR-28, FR-12 |
| Network | `GET` | `/api/v1/network/metrics` | `getNetworkMetrics` | P2 | FR-13–14 |
| Network | `GET` | `/api/v1/network/protocols` | `getNetworkProtocols` | P2 | FR-13–14 |
| Network | `GET` | `/api/v1/network/geography` | `getNetworkGeography` | P2 | FR-03 |
| Search | `GET` | `/api/v1/search` | `globalSearch` | P5 | FR-14 |
| Reports | `GET` | `/api/v1/report-templates` | `listReportTemplates` | P5 | FR-19 |
| Reports | `POST` | `/api/v1/report-templates` | `createReportTemplate` | P5 | FR-19 |
| Reports | `POST` | `/api/v1/report-jobs` | `renderReport` | P5 | FR-19 |
| Reports | `GET` | `/api/v1/report-jobs/{id}` | `getReportJob` | P5 | FR-19 |
| Reports | `POST` | `/api/v1/exports` | `createExport` | P5 | FR-24 |
| Reports | `GET` | `/api/v1/exports/{id}` | `getExport` | P5 | FR-24 |
| Notifications | `GET` | `/api/v1/notifications` | `listNotifications` | P5 | FR-21 |
| Notifications | `PATCH` | `/api/v1/notifications/{id}` | `updateNotificationRead` | P5 | FR-21 |
| Notifications | `POST` | `/api/v1/stream-tickets` | `issueStreamTicket` | P1 | FR-21 |
| Notifications | `GET` | `/api/v1/streams` | `connectNotificationStream` | P5 | FR-21 |
| Preferences | `GET` | `/api/v1/me/preferences` | `getPreferences` | P5 |  |
| Preferences | `PUT` | `/api/v1/me/preferences` | `putPreferences` | P5 |  |
| Preferences | `GET` | `/api/v1/saved-views` | `listSavedViews` | P5 |  |
| Preferences | `POST` | `/api/v1/saved-views` | `createSavedView` | P5 |  |
| Operations | `GET` | `/api/v1/handovers` | `listHandovers` | P4 |  |
| Operations | `POST` | `/api/v1/handovers` | `createHandover` | P4 |  |
| Integrations | `GET` | `/api/v1/integrations` | `listIntegrations` | P2 | FR-01, FR-11 |
| Integrations | `POST` | `/api/v1/integrations` | `configureIntegration` | P2 | FR-01, FR-11 |
| Integrations | `GET` | `/api/v1/webhook-subscriptions` | `listWebhooks` | P2 |  |
| Integrations | `POST` | `/api/v1/webhook-subscriptions` | `createWebhook` | P2 |  |
| Operations | `GET` | `/api/v1/retention-policy` | `getRetentionPolicy` | P1 | FR-22 |
| Operations | `PUT` | `/api/v1/retention-policy` | `setRetentionPolicy` | P1 | FR-22, FR-12 |
| Operations | `GET` | `/api/v1/backup-jobs` | `listBackups` | P1 | NFR-08 |
| Operations | `POST` | `/api/v1/backup-jobs` | `requestBackup` | P1 | NFR-08 |
| Assets | `POST` | `/api/v1/assets/{id}/archive` | `archiveAsset` | P2 | FR-16 |
| Investigations | `POST` | `/api/v1/incidents/{id}/classification` | `classifyIncident` | P4 | FR-09, FR-12 |
| Investigations | `POST` | `/api/v1/incidents/{id}/assignment` | `assignIncident` | P4 | FR-10, FR-12 |
| Investigations | `PATCH` | `/api/v1/incidents/{id}/notes/{note_id}` | `updateIncidentNote` | P4 | FR-12 |
| Evidence | `GET` | `/api/v1/evidence/{id}/content` | `downloadEvidence` | P4 | FR-12, SR-02 |
| Reports | `GET` | `/api/v1/report-jobs/{id}/file` | `downloadReport` | P5 | FR-19 |
| Reports | `GET` | `/api/v1/exports/{id}/file` | `downloadExport` | P5 | FR-24 |
| Notifications | `POST` | `/api/v1/notifications/mark-all-read` | `markAllNotificationsRead` | P5 | FR-21 |
| Investigations | `GET` | `/api/v1/relationships/graph` | `getRelationshipGraph` | P4 |  |
| Detection | `GET` | `/api/v1/risk-configuration` | `getRiskConfiguration` | P3 | FR-07, FR-12 |
| Detection | `PUT` | `/api/v1/risk-configuration` | `updateRiskConfiguration` | P3 | FR-07, FR-12 |

### 🔹 نقاط مراجعة مهمة

- **1.7:** يتضمن العقد مقترحات مقارنة التحقيق والفترات والرسوم والقوالب والتقارير؛ لم ترد المواصفات التفصيلية الكاملة للمقترحات الست في مستندات المشروع المتاحة، فيجب تثبيتها مع الفريق والمحللين قبل تحويلها إلى مهام نهائية.
- **الاستجابة والأدلة:** لا يكفي وجود URI لإثبات صلاحية أو تكامل. الموافقة على هدف محدد والموصل والتحقق من النتيجة وسلسلة الحيازة وتشفير الأدلة ما زالت مطلوبة.
- **الكشف وML:** لا تدريب ولا قواعد تشغيلية ولا ربط موجود. تظل استجابة Python `operational: false`، وإشاراتها المدخلة يدويًا ليست دليلًا.
- **التواريخ والبيانات:** الفترات نصف مفتوحة، والسجلات غير المؤرخة لا تُعطى وقتًا افتراضيًا، والمصدر والحدود يرافقان كل معلومة.
- **القناة الفورية:** WebSocket مستقبلية وتحتاج تذكرة قصيرة لمرة واحدة وسياسة Origin وتوصيل واستعادة؛ لا تمرر JWT طويلة في عنوان قابل للتسجيل.

## 📖 Python L3 — معاينة فقط

`GET /health/live`, `GET /health/ready`, `POST /internal/v1/risk-preview` منفذة في خدمة منفصلة. لا توجد شبكة من Go إليها ولا نموذج ML. راجع `contracts/ml-preview.openapi.json`.

</div>
