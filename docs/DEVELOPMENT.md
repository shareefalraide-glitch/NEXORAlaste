<div dir="rtl" lang="ar">

# 📘 دليل التطوير المحلي

## 🚀 المتطلبات

- Go 1.26+؛ اختُبر الكود بـGo 1.27.3. PostgreSQL 16 للاختبار؛ لا يلزم Timescale للشريحة الحالية.
- Python 3.13 لخدمة المعاينة المستقلة. React يحتاج Node حسب `frontend/README.md`.
- Docker Compose اختياري لتوفير البيئة المحلية. اختُبر الإصدار 2.26.1 على Linux محليًا ببناء حاويتي Go وPython وPostgreSQL 16، وتظل مراجعة صور الحاويات والتكوين مطلوبة قبل أي اعتماد.

## 🚀 تشغيل Go دون Docker

أنشئ قاعدة ومستخدم تطوير منفصلين بنفسك. المثال التالي **يستخدم قاعدة محلية مخصصة للتطوير فقط**. استخدم كلمة مرور URL-safe أو شفّر مكونات العنوان، ولا تضع العنوان الحقيقي في Git:

<div dir="ltr">

```bash
cd services/api
export NEXORA_ENV=development
export DATABASE_URL='postgres://USER:PASSWORD@127.0.0.1:5432/DEV_DATABASE?sslmode=disable'
export NEXORA_JWT_SECRET="$(openssl rand -hex 32)"
go run ./cmd/nexora migrate

export NEXORA_BOOTSTRAP_ORG_SLUG=example
export NEXORA_BOOTSTRAP_ORG_NAME='Example organization'
export NEXORA_BOOTSTRAP_EMAIL=admin@example.invalid
read -r -s -p 'Development password: ' NEXORA_BOOTSTRAP_PASSWORD; echo
export NEXORA_BOOTSTRAP_PASSWORD
go run ./cmd/nexora bootstrap
unset NEXORA_BOOTSTRAP_PASSWORD

go run ./cmd/nexora serve
```

</div>

احتفظ بسر JWT طوال جلسة التطوير وإلا تنتهي الرموز بعد إعادة التشغيل. لا تستخدم عناوين أو كلمات مرور فعلية. الخدمات تستمع افتراضيًا على `127.0.0.1:8080`؛ `/health/live` لا يضمن قاعدة صالحة و`/health/ready` يتحقق من الهجرات. `migrate` يحفظ بصمة ملفات SQL ويرفض تعديل هجرة سابقة؛ أضف ملفًا مرقمًا جديدًا بدل تعديل هجرة منشورة.

## 🔌 الاستخدام المبدئي للـAPI

1. `POST /api/v1/auth/login` يستقبل `organization`, `email`, `password` ويعيد `access_token` و`refresh_token`؛ `POST /api/v1/auth/refresh` يدوّر الثاني. الاستجابة JSON لبيئة الاختبار فقط؛ سياسة المتصفح الآمنة لم تُنفّذ بعد.
2. أرسل `Authorization: Bearer <access_token>` لكل مسار محمي. `GET /api/v1/auth/me` يوضح الهوية والدور. صلاحيات الإدارة ليست مستمدة من عرض الواجهة.
3. `POST /api/v1/sources` ينشئ كيان جهاز/باعث ويعيد `ingest_token` مرة واحدة. ضعه في مخزن أسرار محلي، لا في ملف اختبار مشترك. يمكن إلغاء الرمز أو تدويره من المسارات الموثقة.
4. L2 مستقبلي يرسل الدفعة المطبّعة إلى `POST /internal/v1/event-batches` باستخدام `X-Source-Token`. الحد 100 حدث؛ المعرّف الفريد للمصدر والطابع والتسلسل يمنع تكرار الحدث. لا يعالج هذا المسار سجلات خام أو يشغّل كشفًا.
5. الحوادث تُنشأ يدويًا في الأساس الحالي. `POST /incidents/{id}/transitions` يقبل الانتقالات المسموحة، لكن `contained` يعيد 409 حتى تتوفر الموافقة والنتيجة المتحقق منها. تدعم الحادثة ملاحظات ومهامًا مخزنة.
6. يستورد Postman أو Insomnia ملف `contracts/openapi.json`. المسودة `planned.openapi.json` ليست خادمًا يعمل؛ لا تختبرها كعمليات منفذة. `docs/API_CATALOG.md` يوضح التقسيم.

## ✅ اختبارات التكامل وHTTP

خصص قاعدة اختبار لا تحتوي بيانات مهمة؛ كل اختبار Go ينشئ schema عشوائية ويحذفها. سيُتخطى اختبار قاعدة البيانات دون المتغير، لذلك اضبطه صراحةً:

<div dir="ltr">

```bash
cd services/api
export NEXORA_TEST_DATABASE_URL='postgres://USER:PASSWORD@127.0.0.1:5432/TEST_DATABASE?sslmode=disable'
go test -race -v ./...
go vet ./...
```

</div>

يفحص `scripts/contract_smoke.py` استجابات العمليات المنفذة مع مخططات OpenAPI عبر HTTP حقيقي، لكنه **ينشئ مستخدمًا وأصلًا ومصدرًا وأحداثًا وحادثة** ولا ينظفها. لا يعمل إلا عند وضع `NEXORA_SMOKE_ALLOW_WRITES=1`، ويقبل عنوان localhost فقط. استخدم قاعدة مؤقتة بعد `migrate` و`bootstrap`، وخادم تطوير نشطًا، ثم من الجذر:

<div dir="ltr">

```bash
python -m pip install -r tools/requirements-contracts.txt
export NEXORA_SMOKE_ALLOW_WRITES=1 NEXORA_SMOKE_BASE_URL=http://127.0.0.1:8080
export NEXORA_SMOKE_ORG=example NEXORA_SMOKE_EMAIL=admin@example.invalid
read -r -s -p 'Development password: ' NEXORA_SMOKE_PASSWORD; echo
export NEXORA_SMOKE_PASSWORD
python scripts/contract_smoke.py
unset NEXORA_SMOKE_PASSWORD NEXORA_SMOKE_ALLOW_WRITES
```

</div>

راجع [تقرير الاختبار](TEST_REPORT.md) وحدود الاختبارات الأمنية. لا يتصل أي من أوامر الاختبار ببيانات الشبكة الفعلية.

</div>
