<<<<<<< HEAD
<div dir="rtl" lang="ar">

# 📘 NEXORA — مستودع الواجهة وخدمات المنصة

نقطة بداية عملية لفريق NEXORA: واجهة React 1.6.1، وشريحة خلفية فعلية بـGo/Fiber وPostgreSQL 16، وعقود API وخطة عمل لخمسة أعضاء. تتبع الحدود المعمارية التقرير الأصلي في [`docs/reference/NEXORA_Project_Report_v3.docx`](docs/reference/NEXORA_Project_Report_v3.docx).

> **الحالة: بيئة تطوير، وليست منصة SOC جاهزة للإنتاج.** الواجهة ما زالت تستخدم بياناتها التجريبية ولم تُربط بالـAPI بعد. لا توجد مراقبة شبكة حية أو محرك قواعد أو نموذج تعلم آلي مدرّب أو ربط آلي للتنبيهات أو موصل احتواء. لا تستخدم بيانات حساسة أو تعرّض هذا الإصدار للإنترنت.

## 📖 ماذا يعمل الآن؟

- **Go / Fiber:** 32 عملية HTTP منفذة تشمل فحوص الصحة، الجلسات، المستخدمين، الأصول، المصادر وتجديد رموزها، استقبال دفعات أحداث موحّدة، الحوادث اليدوية وملاحظاتها ومهامها، ملخصًا حقيقيًا محدودًا، وسجل تدقيق متسلسلًا. تُحفظ البيانات في PostgreSQL وتُفحص صلاحيات الأدوار وعزل المؤسسة.
- محول محلي فعلي في `tools/import_sensor_logs.py` يحول Suricata EVE JSON وZeek JSON/TSV إلى دفعات متوافقة مع API، مع تحقق للحقول والتوقيت والعناوين وحد أقصى 100 حدث. لا يراقب الشبكة ولا يشغّل كشفًا. راجع [`docs/SENSOR_LOG_IMPORT.md`](docs/SENSOR_LOG_IMPORT.md).
- لا يسمح الخادم بالانتقال إلى حالة «محتواة»؛ تبقى مغلقة حتى يُنفَّذ مسار موافقة بشرية وموصل تؤكد نتيجته. عند عدم وجود كشف يعرض الملخص `alerts: null` و`detection: not_implemented`، وليس صفرًا يوحي بالسلامة.
- **Frontend:** يبقى وضع Demo معزولًا افتراضيًا، وأضيف وضع API اختياري بمصادقة حقيقية وواجهة منفصلة تقرأ الأصول والمصادر والأحداث والحوادث والملخص، وتتيح العمليات المدعومة حسب الدور. لا تعرض ميزات الكشف والتنبيهات غير المنفذة كأنها حقيقية؛ راجع [`docs/FRONTEND_API_MODE.md`](docs/FRONTEND_API_MODE.md).
- **Python / FastAPI:** خدمة مستقلة لمعاينة حساب معادلة الخطورة فقط؛ مخرجاتها `operational: false`. لا يوجد تدريب أو كشف أو معايرة، ولا يستدعيها خادم Go حاليًا.
- **العقود:** [`contracts/openapi.json`](contracts/openapi.json) للعمليات المنفذة، و[`contracts/planned.openapi.json`](contracts/planned.openapi.json) لـ100 عملية مستقبلية **مسودة غير منفذة**، و[`contracts/ml-preview.openapi.json`](contracts/ml-preview.openapi.json) لخدمة المعاينة. عدد العمليات يحدده فحص العقود ويمكن أن يتغير لاحقًا.
- **الفريق:** [خطة وتقسيم المسؤوليات](planning/TEAM_PLAN.md) و[31 بطاقة جاهزة للمراجعة](planning/issues/). لم تُنشأ Issues أو يُرفع أي شيء إلى GitHub تلقائيًا.

## 🏗️ هيكل المستودع

<div dir="ltr">

```text
frontend/                  واجهة React: Demo افتراضي ووضع API اختياري محدود
services/api/              خدمات أعمال Go/Fiber، الهجرات واختبارات PostgreSQL
services/ml/               خدمة Python مستقلة: حساب معاينة فقط، لا نموذج مدرّب
contracts/                 OpenAPI المنفذ ومسودة المستقبل ومخطط الحدث
infra/compose.yaml         تشغيل محلي للتطوير فقط
planning/                  خطة الأعضاء الخمسة وملفات مهام GitHub
.github/                   قوالب Issues وPR وتعريف CI
scripts/                   فحص العقود وعمليات المساعدة المحلية
```

</div>

[تقرير الفحص الأولي](docs/INITIAL_ASSESSMENT.md) · [وضع الواجهة المتصل بالـAPI](docs/FRONTEND_API_MODE.md) · [دليل استيراد Suricata وZeek](docs/SENSOR_LOG_IMPORT.md) · [تقرير التسليم](FINAL_DELIVERY_REPORT.md) · [دليل التشغيل لجميع البيئات](docs/RUN_GUIDE_ALL_ENVIRONMENTS.md) · [المعمارية الخماسية والتدفق](docs/ARCHITECTURE.md) · [كتالوج العمليات](docs/API_CATALOG.md) · [تتبع متطلبات التقرير](docs/REQUIREMENTS_TRACEABILITY.md) · [الأمن والفجوات](docs/SECURITY.md) · [الاختبارات وحدودها](docs/TEST_REPORT.md)

## 🚀 تشغيل محلي باستخدام Docker Compose

المتطلبات: Docker مع Compose، و`openssl`، وNode.js 20.19+ ضمن سلسلة 20 أو 22.13+ ضمن سلسلة 22 أو 24+ للواجهة. ملف Compose **للتطوير المحلي فقط**: يستخدم اتصالات داخلية غير مشفرة ودور قاعدة بيانات بصلاحيات واسعة. اختُبرت حاويات الشريحة محليًا على Linux، ولم يُختبر كل نظام أو جهاز. راجع [دليل التشغيل](docs/DEVELOPMENT.md) لبديل PostgreSQL المحلي.

من جذر المستودع، أنشئ أسرار تطوير فريدة (الملف `.env` مستثنى من Git):

<div dir="ltr">

```bash
umask 077
printf 'POSTGRES_PASSWORD=%s\nNEXORA_JWT_SECRET=%s\nNEXORA_ML_SERVICE_TOKEN=%s\n' \
  "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env

docker compose --env-file .env -f infra/compose.yaml up -d postgres
docker compose --env-file .env -f infra/compose.yaml run --rm api migrate
```

</div>

أنشئ مديرًا للمؤسسة **بكلمة مرور تختارها**؛ المثال التالي لـBash ولا يضع كلمة المرور داخل الملف أو الأمر المكتوب:

<div dir="ltr">

```bash
read -r -s -p 'Development admin password (14+ characters, max 72 UTF-8 bytes): ' NEXORA_BOOTSTRAP_PASSWORD; echo
export NEXORA_BOOTSTRAP_PASSWORD
docker compose --env-file .env -f infra/compose.yaml run --rm \
  -e NEXORA_BOOTSTRAP_ORG_SLUG=example \
  -e NEXORA_BOOTSTRAP_ORG_NAME='Example organization' \
  -e NEXORA_BOOTSTRAP_EMAIL=admin@example.invalid \
  -e NEXORA_BOOTSTRAP_PASSWORD api bootstrap
unset NEXORA_BOOTSTRAP_PASSWORD

docker compose --env-file .env -f infra/compose.yaml up -d api
curl http://127.0.0.1:8080/health/ready
```

</div>

قد تستغرق الخدمة لحظات بعد `up -d`؛ إذا فشل طلب الجاهزية مباشرة فأعده بعد اكتمال البدء، وراجع سجلات Compose عند استمرار الفشل. استبدل البريد والمجموعة بمعلومات تطوير مناسبة. وضع المدير في هذا الإصدار تأسيس محلي، وليس نظام دعوات أو استعادة حساب مكتملًا. تدوين كلمة المرور في سجلات أو ملفات مشتركة غير آمن. خدمة Python الاختيارية لا تنشر منفذًا للمضيف:

<div dir="ltr">

```bash
docker compose --env-file .env -f infra/compose.yaml --profile ml-preview up -d ml-preview
```

</div>

لتشغيل وضع Demo الافتراضي، أو وضع API بعد تشغيل Go/PostgreSQL وإعداد مستخدم حقيقي (راجع [`docs/FRONTEND_API_MODE.md`](docs/FRONTEND_API_MODE.md)):

<div dir="ltr">

```bash
cd frontend
npm ci
npm run dev
# اختياريًا قبل التشغيل: انسخ .env.example إلى .env.local ثم اضبط VITE_NEXORA_AUTH_MODE=api
```

</div>

## ✅ التحقق والتطوير

تحتاج اختبارات تكامل Go إلى قاعدة PostgreSQL **مخصصة للاختبار فقط** تسمح بإنشاء schema مؤقتة:

<div dir="ltr">

```bash
cd services/api
export NEXORA_TEST_DATABASE_URL='postgres://USER:PASSWORD@127.0.0.1:5432/TEST_DB?sslmode=disable'
go test -race ./...
go vet ./...
```

</div>

دون `NEXORA_TEST_DATABASE_URL` تتخطى اختبارات التكامل قاعدة البيانات؛ لا يُعد ذلك نجاحًا لها. لا تضع العنوان الحقيقي في Git. لاختبار Python والعقود:

<div dir="ltr">

```bash
cd services/ml
python -m venv .venv
. .venv/bin/activate
pip install -r requirements-dev.lock
python -m pytest -q
```

</div>

<div dir="ltr">

```bash
# من جذر المستودع، داخل بيئة Python ملائمة
pip install -r tools/requirements-contracts.txt
python scripts/check_contracts.py
```

</div>

راجع `docs/DEVELOPMENT.md` لاختبار HTTP الفعلي وشرح أدوار البيئة. توجد إعدادات CI لخدمات المشروع وCompose في `.github/workflows/`؛ لم تُشغّل على GitHub في هذا التسليم.

لفحص أغلفة Markdown وروابط المستودع المحلية وبطاقات المهام، شغّل من جذر المشروع بعد تثبيت Python 3:

<div dir="ltr">

```bash
python scripts/check_markdown.py
```

</div>

هذا فحص بنيوي محلي؛ لا يحل محل مراجعة العرض والمحتوى على GitHub.

## 📖 الرفع وتوزيع العمل

<div dir="ltr">

```bash
git init
git add .
git status                 # راجع الملفات؛ لا تضف .env أو بيانات حساسة
git commit -m 'Initial NEXORA platform foundation'
# أنشئ مستودعك الخاص على GitHub ثم أضف عنوانه وادفعه بالطريقة المناسبة لفريقك.
```

</div>

راجع البطاقات أولًا في `planning/issues/`. يعرض `sh scripts/prepare-github-issues.sh` خطة محلية فقط افتراضيًا؛ تشرح [خطة الفريق](planning/TEAM_PLAN.md) طريقة إنشائها اختياريًا بعد رفع المستودع. لا تُنشأ المدد أو أسماء الأعضاء أو الصلاحيات الفعلية تلقائيًا.

</div>
=======
# NEXORAlaste
>>>>>>> 625eb38c87f5e1a48b1d3aa54a58b86fb51698d1
