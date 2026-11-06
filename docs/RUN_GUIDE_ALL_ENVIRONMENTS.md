<div dir="rtl" lang="ar">

# 📘 دليل تشغيل NEXORA على Windows وmacOS وLinux

دليل لتشغيل **نسخة التطوير الحالية** على جهازك الشخصي، باستخدام VS Code أو أي طرفية مشابهة. اختر القسم المناسب لنظامك، ولا تحتاج إلى تنفيذ أوامر جميع الأنظمة.

---

## 📖 1. اقرأ هذا أولًا

| الجزء | حالته الحالية |
|---|---|
| الواجهة React | تعمل ببيانات تجريبية محلية، **وليست مربوطة بالـBackend** بعد. |
| Backend وPostgreSQL | توجد 32 عملية API منفذة، مثل الجلسات والأصول والأحداث والحوادث والمهام والتدقيق. |
| خدمة Python | معاينة حسابية غير تشغيلية فقط؛ لا يوجد نموذج ML مدرَّب، وهي غير مربوطة بالـBackend. |
| الوظائف المستقبلية | 100 عملية في عقد مخطط **غير منفذ**. |

**هذا إعداد تطوير محلي، وليس تشغيلًا إنتاجيًا.** لا تضع فيه بيانات حساسة حقيقية، ولا تعرّض الخدمات للإنترنت. اختُبرت الحاويات وPostgreSQL على Linux؛ لم يُختبر التشغيل مباشرة على كل إصدار من Windows أو macOS أو معمارية جهاز. إعدادات GitHub Actions موجودة، لكنها لم تُشغّل على GitHub في هذا التسليم.

## 🚀 2. اختر طريقة التشغيل

1. **عرض الواجهة فقط:** افتح ملف HTML الجاهز، دون تثبيت أدوات.
2. **تطوير الواجهة والـBackend — الموصى به:** شغّل React عبر Node.js، وشغّل Go وPostgreSQL باستخدام Docker Compose.
3. **تشغيل الـBackend دون Docker:** ثبّت Go وPostgreSQL على جهازك واتبع القسم 10. هذه طريقة اختيارية للمطورين.

إذا كنت تستخدم **WSL 2**، افتح مجلد المشروع داخل بيئة WSL عبر VS Code، واستخدم أوامر Linux/Bash. لتشغيل Docker من WSL فعّل تكامل توزيعتك في Docker Desktop. لا تخلط بين طرفية PowerShell وأوامر Bash في نفس الخطوة.

---

## 📖 3. فتح المشروع في VS Code

1. فك ضغط `NEXORA_Platform_GitHub.zip`.
2. من VS Code اختر **File → Open Folder**.
3. اختر مجلد `nexora-platform`، وهو المجلد الذي يحتوي على:

<div dir="ltr">

```text
README.md
frontend/
services/
contracts/
infra/
planning/
```

</div>

4. افتح الطرفية من **Terminal → New Terminal**.
   - Windows: استخدم **PowerShell**.
   - Linux: استخدم **Bash**.
   - macOS: افتح الطرفية واكتب `bash` إذا كانت تعمل بـzsh، لأن أمثلة macOS أدناه مكتوبة لـBash.

كل أوامر Docker في هذا الدليل تبدأ من **المجلد الرئيسي** `nexora-platform`، وليس من داخل `frontend` أو `infra`. افتح طرفية ثانية عند الحاجة إلى ترك خدمة تعمل في الأولى.

---

## 📖 4. عرض الواجهة فورًا دون تثبيت

بعد فك الضغط افتح هذا الملف بالنقر المزدوج أو باستخدام Chrome أو Edge أو Firefox:

<div dir="ltr">

```text
nexora-platform/frontend/demo/NEXORA_UI_Demo.html
```

</div>

للدخول اضغط **«استخدام بيانات تجريبية»** ثم أدخل:

<div dir="ltr">

```text
123456
```

</div>

هذه بيانات عرض للواجهة فقط وليست حساب Backend. لا تحتاج هذه الطريقة إلى Node.js أو Docker، ولا تشغّل API أو قاعدة بيانات.

---

## 🚀 5. المتطلبات حسب النظام

### 🔹 Windows

- ثبّت [Node.js](https://nodejs.org/en/download) — إصدار **24 LTS** مناسب، ويشمل npm.
- ثبّت [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/) إذا ستستخدم طريقة Docker، وأكمل إعداد WSL 2 إن طلبه المثبّت.
- شغّل Docker Desktop وانتظر حتى يصبح المحرك جاهزًا.
- أعد فتح VS Code بعد تثبيت الأدوات إن لم تتعرف الطرفية عليها.

### 🔹 macOS

- ثبّت [Node.js](https://nodejs.org/en/download) بإصدار 24 LTS.
- ثبّت [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/) المناسب لمعالج جهازك، ثم شغّله.
- تأكد من توفر `openssl`؛ يستخدمه الدليل لتوليد أسرار محلية. استخدم Bash للأوامر أدناه.

### 🔹 Linux

- ثبّت Node.js 24 أو إصدارًا تدعمه الواجهة، مع npm.
- ثبّت [Docker Engine وCompose plugin](https://docs.docker.com/engine/install/) بالطريقة المناسبة لتوزيعتك، وشغّل خدمة Docker. قد تحتاج `sudo` أو إعداد صلاحيات Docker وفق وثائق توزيعتك.
- تأكد من توفر `openssl` وBash.

**إصدارات Node المدعومة بحسب المشروع:** `20.19+` ضمن سلسلة 20، أو `22.13+` ضمن سلسلة 22، أو `24+`. إذا استخدمت Docker للـBackend فلا تحتاج تثبيت Go أو Python أو PostgreSQL على الجهاز لتشغيل هذه الخدمات داخل الحاويات.

### 🔹 التحقق من الأدوات

Windows / PowerShell:

<div dir="ltr">

```powershell
node -v
npm.cmd -v
docker --version
docker compose version
```

</div>

macOS أو Linux / Bash:

<div dir="ltr">

```bash
node -v
npm -v
docker --version
docker compose version
openssl version
```

</div>

إذا كنت تريد الواجهة فقط، لا تحتاج أوامر Docker. إذا كانت الأداة مثبتة لكن الطرفية لا تعرفها، أغلق VS Code وافتحه مجددًا.

---

## 🚀 6. تشغيل واجهة React للتطوير

هذه الخطوات مفيدة عندما تريد تعديل الواجهة من VS Code. تُنفَّذ من مجلد المشروع الرئيسي.

### 🔹 Windows / PowerShell

<div dir="ltr">

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1
```

</div>

### 🔹 macOS أو Linux / Bash

<div dir="ltr">

```bash
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

</div>

افتح **العنوان الذي يظهر في الطرفية**؛ غالبًا `http://127.0.0.1:5173`. إذا كان المنفذ مشغولًا قد يعرض Vite عنوانًا آخر. اترك الطرفية مفتوحة، ولإيقاف الواجهة اضغط `Ctrl + C` فيها.

`npm ci` يُحتاج عادةً عند التثبيت الأول أو بعد تغير `package-lock.json`؛ بعد ذلك يكفي أمر `npm run dev` المناسب لنظامك. دخول العرض: زر «استخدام بيانات تجريبية» ثم `123456`.

> على Windows استُخدم `npm.cmd` لتجنب مشكلة سياسة تشغيل `npm.ps1` في PowerShell. لا يلزم تغيير سياسة الأمان لتشغيل هذه الأوامر.

---

## 🔐 7. أنشئ ملف الأسرار المحلي مرة واحدة

استخدم طريقة **نظامك فقط** من جذر المشروع. سيُنشئ الأمر ملف `.env` بقيم عشوائية إذا لم يكن موجودًا، ولن يستبدله إذا كان موجودًا.

- لا تشارك `.env`، ولا ترفعه إلى GitHub. يستبعده `.gitignore`، لكن راجع الملفات قبل `git add`.
- لا تُعد توليد الملف بعد بدء استخدام قاعدة البيانات: تغيير كلمة مرور PostgreSQL في `.env` لا يغيّر كلمة المرور داخل وحدة تخزين موجودة تلقائيًا، وتغيير مفتاح JWT يبطل الرموز الحالية.
- هذه الأسرار للتطوير المحلي فقط.

### 🔹 Windows / PowerShell

انسخ المقطع كاملًا:

<div dir="ltr">

```powershell
function New-NexoraSecret {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return ([System.BitConverter]::ToString($bytes) -replace '-', '').ToLowerInvariant()
}

if (-not (Test-Path .env)) {
    @(
        "POSTGRES_PASSWORD=$(New-NexoraSecret)"
        "NEXORA_JWT_SECRET=$(New-NexoraSecret)"
        "NEXORA_ML_SERVICE_TOKEN=$(New-NexoraSecret)"
    ) | Set-Content -Path .env -Encoding ascii
    Write-Host "Created .env"
} else {
    Write-Host ".env already exists; keeping it"
}
```

</div>

### 🔹 macOS أو Linux / Bash

<div dir="ltr">

```bash
if [ ! -e .env ]; then
  umask 077
  printf 'POSTGRES_PASSWORD=%s\nNEXORA_JWT_SECRET=%s\nNEXORA_ML_SERVICE_TOKEN=%s\n' \
    "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env
  echo 'Created .env'
else
  echo '.env already exists; keeping it'
fi
```

</div>

إذا كنت تستخدم طريقة التشغيل دون Docker في القسم 10، أنشئ `.env` بهذه الخطوة أيضًا للاحتفاظ بمفتاح JWT ورمز خدمة المعاينة. كلمة مرور قاعدة PostgreSQL المحلية التي تختارها في القسم 10 مستقلة عن قيمة `POSTGRES_PASSWORD` الخاصة بـCompose.

---

## 🚀 8. تشغيل Backend وPostgreSQL باستخدام Docker

### 🔹 8.1 شغّل قاعدة البيانات وطبّق الهجرات

من جذر المشروع وبعد تشغيل Docker Desktop أو Docker Engine، يمكن تنفيذ الأمرين التاليين في PowerShell أو Bash:

<div dir="ltr">

```text
docker compose --env-file .env -f infra/compose.yaml up -d postgres
docker compose --env-file .env -f infra/compose.yaml run --rm api migrate
```

</div>

ينتظر الأمر الثاني جاهزية PostgreSQL ويبني صورة Go عند الحاجة. رسالة `database migrations applied` تعني أن الهجرات نجحت. **لا تنتقل لإنشاء الحساب إذا ظهر خطأ.**

### 🔹 8.2 أنشئ مديرًا للـAPI — مرة واحدة لكل قاعدة جديدة

اختر كلمة مرور تطوير من **14 حرفًا على الأقل** و72 بايت UTF-8 كحد أقصى. يُسهّل استخدام أحرف إنجليزية وأرقام فهم حد البايتات. لا ترسل كلمة المرور في المحادثات أو صور الشاشة.

بيانات المثال:

| الحقل | القيمة |
|---|---|
| معرّف المؤسسة `organization` | `nexora` |
| البريد | `admin@example.invalid` |
| كلمة المرور | التي تختارها أثناء التنفيذ |

البريد عنوان محلي مثالي للاختبار؛ لا توجد خدمة بريد أو استعادة حساب مكتملة. حساب Backend لا يُستخدم للدخول إلى الواجهة التجريبية.

#### 🔹 Windows / PowerShell

<div dir="ltr">

```powershell
$securePassword = Read-Host "Choose a development admin password" -AsSecureString
$env:NEXORA_BOOTSTRAP_PASSWORD = [System.Net.NetworkCredential]::new("", $securePassword).Password

docker compose --env-file .env -f infra/compose.yaml run --rm -e NEXORA_BOOTSTRAP_ORG_SLUG=nexora -e NEXORA_BOOTSTRAP_ORG_NAME=NEXORA -e NEXORA_BOOTSTRAP_EMAIL=admin@example.invalid -e NEXORA_BOOTSTRAP_PASSWORD api bootstrap

Remove-Item Env:\NEXORA_BOOTSTRAP_PASSWORD
$securePassword = $null
```

</div>

#### 🔹 macOS أو Linux / Bash

<div dir="ltr">

```bash
read -r -s -p 'Choose a development admin password: ' NEXORA_BOOTSTRAP_PASSWORD; echo
export NEXORA_BOOTSTRAP_PASSWORD

docker compose --env-file .env -f infra/compose.yaml run --rm \
  -e NEXORA_BOOTSTRAP_ORG_SLUG=nexora \
  -e NEXORA_BOOTSTRAP_ORG_NAME=NEXORA \
  -e NEXORA_BOOTSTRAP_EMAIL=admin@example.invalid \
  -e NEXORA_BOOTSTRAP_PASSWORD api bootstrap

unset NEXORA_BOOTSTRAP_PASSWORD
```

</div>

إذا ظهر `administrator created` فقد نجح الإنشاء. إذا ظهر أن البريد موجود، فقد يكون الحساب أُنشئ سابقًا؛ لا تكرر الأمر في كل تشغيل. لا توجد استعادة كلمة مرور متكاملة في هذا الإصدار.

### 🔹 8.3 شغّل الـAPI

في PowerShell أو Bash، من جذر المشروع:

<div dir="ltr">

```text
docker compose --env-file .env -f infra/compose.yaml up -d api
```

</div>

انتظر لحظات، ثم افتح على **جهازك نفسه**:

<div dir="ltr">

```text
http://127.0.0.1:8080/health/ready
```

</div>

النتيجة المتوقعة:

<div dir="ltr">

```json
{"status":"ready"}
```

</div>

إذا فشل الطلب مباشرة، أعده بعد اكتمال البدء. لقراءة سجلات الخدمات:

<div dir="ltr">

```text
docker compose --env-file .env -f infra/compose.yaml ps
docker compose --env-file .env -f infra/compose.yaml logs api
docker compose --env-file .env -f infra/compose.yaml logs postgres
```

</div>

راجع السجلات واحذف أي معلومات حساسة قبل مشاركتها. ملف Compose ينشر الـAPI محليًا على `127.0.0.1:8080`، وPostgreSQL على `127.0.0.1:5433`، ولا يجهز TLS للإنتاج.

### 🔹 8.4 خدمة Python الاختيارية

لا تحتاج هذه الخدمة لتشغيل الواجهة أو الـBackend. إذا أردت تشغيل المعاينة داخل Docker:

<div dir="ltr">

```text
docker compose --env-file .env -f infra/compose.yaml --profile ml-preview up -d ml-preview
```

</div>

هي خدمة حسابية غير تشغيلية وليست نموذجًا مدرّبًا، ولا ينشر إعداد Compose منفذها على جهاز المضيف ولا يربطها بـGo.

### 🔹 8.5 الإيقاف وإعادة التشغيل

أوقف الواجهة بـ`Ctrl + C` في طرفيتها. أوقف الحاويات من جذر المشروع:

<div dir="ltr">

```text
docker compose --env-file .env -f infra/compose.yaml --profile ml-preview stop
```

</div>

تحتفظ `stop` بالبيانات. في التشغيل التالي:

<div dir="ltr">

```text
docker compose --env-file .env -f infra/compose.yaml up -d api
```

</div>

ثم شغّل الواجهة بأمر نظامك في القسم 6. لا تكرر إنشاء المدير. **لا تستخدم `down -v` إلا إذا كنت تقصد حذف وحدة تخزين قاعدة البيانات وبياناتها.**

---

## 🔌 9. تجربة API عبر Postman أو Insomnia

1. تأكد أن `/health/ready` يعرض `ready`.
2. استورد ملف `contracts/openapi.json` من المشروع، واضبط العنوان الأساسي على `http://127.0.0.1:8080`.
3. لتسجيل الدخول، أنشئ طلب `POST` إلى:

<div dir="ltr">

```text
http://127.0.0.1:8080/api/v1/auth/login
```

</div>

بنوع محتوى `application/json`، وضع القيم التي استخدمتها في خطوة إنشاء المدير. **استبدل وصف كلمة المرور أدناه بكلمة مرورك محليًا؛ لا تحفظها في مستودع Git.**

<div dir="ltr">

```json
{
  "organization": "nexora",
  "email": "admin@example.invalid",
  "password": "ضع كلمة المرور التي اخترتها هنا"
}
```

</div>

يعيد الطلب `access_token` و`refresh_token`. أرسل رمز الوصول في ترويسة `Authorization: Bearer ...` للعمليات المحمية، مثل `GET /api/v1/auth/me`. تعامل مع الرموز كأسرار، ولا تضعها في صور الشاشة أو القضايا العامة.

ملف `contracts/planned.openapi.json` يمثل عمليات **مخططة غير منفذة**؛ لا تتوقع أن تعمل عند استدعائها.

---

## 🚀 10. تشغيل Backend دون Docker — للمطورين

هذا المسار اختياري. ستحتاج قاعدة PostgreSQL 16 **منفصلة ومخصصة للتطوير**، وGo 1.26 أو أحدث؛ اختُبر Go 1.27.3. ثبّت Node للواجهة وPython 3.13 فقط إذا أردت تشغيل خدمة المعاينة منفصلة. تأكد من أن المنفذ `8080` لا تستخدمه نسخة Docker من الـAPI في الوقت نفسه.

### 🔹 10.1 أنشئ قاعدة تطوير ومستخدمًا

ثبّت [PostgreSQL 16](https://www.postgresql.org/download/) وشغّله محليًا. افتح `psql` بحساب إداري مناسب لتثبيتك، مثل:

- **Windows:** شغّل `psql` من PostgreSQL أو من مساره الفعلي، مثل `C:\Program Files\PostgreSQL\16\bin\psql.exe`، واتصل بحساب الإدارة الذي أنشأته عند التثبيت.
- **Ubuntu/Debian:** غالبًا `sudo -u postgres psql -d postgres`.
- **macOS:** اتصل بالحساب الإداري المحلي المناسب لطريقة تثبيتك؛ في بعض تثبيتات Homebrew يكون اسم مستخدم النظام هو الحساب الإداري.

داخل `psql`، ولمرة واحدة فقط، أنشئ مستخدمًا وقاعدة اختبار محلية:

<div dir="ltr">

```sql
CREATE ROLE nexora_dev WITH LOGIN;
\password nexora_dev
CREATE DATABASE nexora_dev OWNER nexora_dev;
\q
```

</div>

سيطلب `\password` كلمة مرور المستخدم مرتين دون وضعها في SQL المكتوب. اختر كلمة مرور تطوير قوية واحتفظ بها محليًا. إذا كان الدور أو القاعدة موجودين بالفعل، لا تكرر الإنشاء بلا مراجعة. تأكد من سماح إعداد PostgreSQL المحلي بالاتصال لهذا المستخدم على `127.0.0.1:5432`.

> لا تشغّل الهجرات على قاعدة تحتوي بيانات مهمة أو على قاعدة إنتاج. تُمنح صلاحيات مالك قاعدة التطوير هنا لتسهيل التطوير، وليست سياسة صلاحيات إنتاجية.

### 🔹 10.2 جهّز متغيرات Go وشغّله

أنشئ `.env` أولًا وفق القسم 7 من جذر المشروع. تُقرأ قيمة `NEXORA_JWT_SECRET` منه لهذه الطريقة؛ لا يقرأ برنامج Go ملف `.env` تلقائيًا. كلمة مرور PostgreSQL تُطلب محليًا وتوضع مؤقتًا في متغير `PGPASSWORD`.

#### 🔹 Windows / PowerShell

من جذر المشروع:

<div dir="ltr">

```powershell
$line = Get-Content .env | Where-Object { $_ -like 'NEXORA_JWT_SECRET=*' } | Select-Object -First 1
if (-not $line) { throw 'NEXORA_JWT_SECRET is missing from .env' }
$env:NEXORA_JWT_SECRET = $line.Substring('NEXORA_JWT_SECRET='.Length)
$env:NEXORA_ENV = 'development'
$env:DATABASE_URL = 'postgres://nexora_dev@127.0.0.1:5432/nexora_dev?sslmode=disable'

$pgSecure = Read-Host 'Local PostgreSQL password for nexora_dev' -AsSecureString
$env:PGPASSWORD = [System.Net.NetworkCredential]::new('', $pgSecure).Password
$pgSecure = $null

cd services/api
go run ./cmd/nexora migrate
```

</div>

لإنشاء مدير الـAPI **للمرة الأولى فقط** على هذه القاعدة المستقلة:

<div dir="ltr">

```powershell
$env:NEXORA_BOOTSTRAP_ORG_SLUG = 'nexora'
$env:NEXORA_BOOTSTRAP_ORG_NAME = 'NEXORA'
$env:NEXORA_BOOTSTRAP_EMAIL = 'admin@example.invalid'
$adminSecure = Read-Host 'Choose a development admin password' -AsSecureString
$env:NEXORA_BOOTSTRAP_PASSWORD = [System.Net.NetworkCredential]::new('', $adminSecure).Password

go run ./cmd/nexora bootstrap
Remove-Item Env:\NEXORA_BOOTSTRAP_PASSWORD
$adminSecure = $null
```

</div>

ثم شغّل الخادم في الطرفية نفسها:

<div dir="ltr">

```powershell
go run ./cmd/nexora serve
```

</div>

#### 🔹 macOS أو Linux / Bash

من جذر المشروع:

<div dir="ltr">

```bash
export NEXORA_ENV=development
export NEXORA_JWT_SECRET="$(awk -F= '$1 == "NEXORA_JWT_SECRET" {print $2; exit}' .env)"
export DATABASE_URL='postgres://nexora_dev@127.0.0.1:5432/nexora_dev?sslmode=disable'
read -r -s -p 'Local PostgreSQL password for nexora_dev: ' PGPASSWORD; echo
export PGPASSWORD

cd services/api
go run ./cmd/nexora migrate
```

</div>

لإنشاء مدير الـAPI **للمرة الأولى فقط**:

<div dir="ltr">

```bash
export NEXORA_BOOTSTRAP_ORG_SLUG=nexora
export NEXORA_BOOTSTRAP_ORG_NAME=NEXORA
export NEXORA_BOOTSTRAP_EMAIL=admin@example.invalid
read -r -s -p 'Choose a development admin password: ' NEXORA_BOOTSTRAP_PASSWORD; echo
export NEXORA_BOOTSTRAP_PASSWORD

go run ./cmd/nexora bootstrap
unset NEXORA_BOOTSTRAP_PASSWORD
```

</div>

ثم شغّل الخادم في الطرفية نفسها:

<div dir="ltr">

```bash
go run ./cmd/nexora serve
```

</div>

في الطريقتين افتح `http://127.0.0.1:8080/health/ready`. أغلق الخادم بـ`Ctrl + C`. المتغيرات السابقة تخص الطرفية الحالية؛ في طرفية جديدة يجب إعدادها مجددًا قبل تشغيله. امسح `PGPASSWORD` عند الانتهاء (`Remove-Item Env:\PGPASSWORD` في PowerShell أو `unset PGPASSWORD` في Bash). لا تشارك `.env` أو متغيرات البيئة أو رموز JWT.

### 🔹 10.3 تشغيل معاينة Python دون Docker — اختياري

هذه ليست خدمة كشف وليست متصلة بـGo. تحتاج Python 3.13 ومفتاح `NEXORA_ML_SERVICE_TOKEN` من `.env`.

**Windows / PowerShell، من جذر المشروع:**

<div dir="ltr">

```powershell
$line = Get-Content .env | Where-Object { $_ -like 'NEXORA_ML_SERVICE_TOKEN=*' } | Select-Object -First 1
if (-not $line) { throw 'NEXORA_ML_SERVICE_TOKEN is missing from .env' }
$env:NEXORA_ML_SERVICE_TOKEN = $line.Substring('NEXORA_ML_SERVICE_TOKEN='.Length)
cd services/ml
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 9000
```

</div>

**macOS أو Linux / Bash، من جذر المشروع:**

<div dir="ltr">

```bash
export NEXORA_ML_SERVICE_TOKEN="$(awk -F= '$1 == "NEXORA_ML_SERVICE_TOKEN" {print $2; exit}' .env)"
cd services/ml
python3.13 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 9000
```

</div>

في هذه الطريقة المحلية فقط يمكنك فتح `http://127.0.0.1:9000/health/ready`. النتيجة تشير إلى `model_status: not_implemented` و`mode: preview_only`. أوقف الخدمة بـ`Ctrl + C` واحذف متغير الرمز من الطرفية بعد الانتهاء. لا تعرض هذه الخدمة للإنترنت.

---

## ⚠️ 11. المشكلات الشائعة

| المشكلة | ما تفحصه أولًا |
|---|---|
| `docker` غير معروف | ثبّت Docker Desktop/Engine، أعد فتح VS Code، وشغّل Docker Desktop. |
| Docker يعمل لكن المحرك غير متصل | انتظر جاهزية Docker Desktop؛ على Linux راجع حالة الخدمة وصلاحيات المستخدم. |
| PowerShell يمنع `npm.ps1` | استخدم `npm.cmd` كما في القسم 6، دون تغيير سياسة النظام. |
| `.env` غير موجود | أنت غالبًا في مجلد خاطئ أو لم تنفذ القسم 7؛ افتح جذر المشروع. |
| فشل الاتصال بقاعدة Docker | تأكد من تشغيل Docker، وراجع `docker compose ... ps` و`logs postgres`، ولا تغيّر `.env` عشوائيًا إذا كانت البيانات موجودة. |
| `/health/ready` يعيد خطأ | انتظر بدء PostgreSQL، وراجع سجلات `api`، وتأكد من نجاح `migrate`. |
| `administrator ... already exists` | الحساب موجود غالبًا؛ استخدمه ولا تكرر bootstrap في كل تشغيل. |
| المنفذ `8080` أو `5433` مشغول | أغلق الخدمة المتعارضة أو راجع إعدادات المنافذ؛ لا تشغّل نسختي API محلية وDocker على 8080 في الوقت نفسه. |
| الواجهة لا تعرض بيانات قاعدة البيانات | هذا متوقع: الواجهة الحالية غير مربوطة بالـBackend بعد. |
| رابط Python في Docker لا يفتح على `localhost:9000` | متوقع: ملف Compose لا ينشر منفذ خدمة المعاينة للمضيف. القسم 10.3 بديل محلي اختياري. |
| `python3.13` أو `py -3.13` غير معروف | ثبّت Python 3.13 أو استخدم مسار نسختك الفعلي. خدمة Python اختيارية. |

إذا احتجت مساعدة، أرسل **اسم النظام والخطوة ورسالة الخطأ فقط** بعد إخفاء كلمات المرور والرموز وملف `.env`.

---

## 📌 12. ملفات مهمة داخل المشروع

| الملف | الاستخدام |
|---|---|
| `README.md` | نظرة عامة على المستودع. |
| `frontend/README.md` | تعليمات الواجهة ونطاق نموذجها. |
| `docs/DEVELOPMENT.md` | تفاصيل تطوير الـBackend والاختبارات. |
| `docs/API_CATALOG.md` | فهرس العمليات المنفذة والمخططة. |
| `docs/SECURITY.md` | فجوات الأمن وموانع النشر الإنتاجي. |
| `docs/TEST_REPORT.md` | الاختبارات المنفذة وحدودها. |
| `planning/TEAM_PLAN.md` | توزيع المسؤوليات والمهام على خمسة أعضاء. |

توجد نسخة من هذا الدليل أيضًا داخل مشروع GitHub في `docs/RUN_GUIDE_ALL_ENVIRONMENTS.md`. راجع `git status` واستبعد `.env` قبل الرفع.

</div>
