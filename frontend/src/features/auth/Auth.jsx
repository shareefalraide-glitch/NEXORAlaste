import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Building2,
  ArrowRight,
  Check,
  CircleAlert,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Mail,
  Moon,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  UserRound,
} from 'lucide-react';
import { enterToSubmit } from '../../shared/ui/index';
import NeuralMesh from './NeuralMesh';
import logoDark from '../../assets/nexora-logo-dark.png';
import logoLight from '../../assets/nexora-logo-light.png';

// UI demonstration values only. These do not authenticate a real user.
const DEMO_EMAIL = 'analyst@example.test';
const DEMO_PASSWORD = 'NexoraDemo2026!';
const DEMO_CODE = '123456';
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const normalizeCode = value =>
  value
    .replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x6f0))
    .replace(/[^0-9]/g, '')
    .slice(0, 6);

function FieldError({ id, children }) {
  return children ? (
    <p id={id} className="auth-field-error" role="alert">
      <CircleAlert size={14} />
      {children}
    </p>
  ) : null;
}
function Stepper({ step }) {
  return (
    <ol className="auth-stepper" aria-label="خطوات الدخول التجريبية">
      <li
        className={step === 'login' ? 'current' : 'complete'}
        aria-current={step === 'login' ? 'step' : undefined}
      >
        <i>{step === 'verify' ? <Check size={13} /> : '١'}</i>
        <span>بيانات الدخول</span>
      </li>
      <li className="auth-step-line" aria-hidden="true" />
      <li
        className={step === 'verify' ? 'current' : ''}
        aria-current={step === 'verify' ? 'step' : undefined}
      >
        <i>٢</i>
        <span>التحقق</span>
      </li>
    </ol>
  );
}
function BackButton({ onClick, children = 'العودة لتسجيل الدخول' }) {
  return (
    <button type="button" className="auth-back" onClick={onClick}>
      <ArrowRight size={15} />
      {children}
    </button>
  );
}

export default function Auth({ onLogin, theme, toggleTheme, mode = 'demo' }) {
  const [step, setStep] = useState('login'),
    [organization, setOrganization] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [showPassword, setShowPassword] = useState(false),
    [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState(''),
    [caret, setCaret] = useState(0),
    [errors, setErrors] = useState({});
  const organizationRef = useRef(null),
    emailRef = useRef(null),
    passwordRef = useRef(null),
    codeRef = useRef(null),
    headingRef = useRef(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);
  const move = next => {
    setErrors({});
    setStep(next);
  };
  const focus = ref => requestAnimationFrame(() => ref.current?.focus());
  const clearError = key => setErrors(current => ({ ...current, [key]: undefined }));
  const validateEmail = () =>
    !email.trim()
      ? mode === 'api'
        ? 'أدخل البريد الإلكتروني للحساب.'
        : 'أدخل البريد الإلكتروني التجريبي.'
      : !validEmail(email)
        ? 'أدخل بريدًا إلكترونيًا بصيغة صحيحة.'
        : '';
  const submitLogin = async e => {
    e.preventDefault();
    if (submitting) return;
    const emailError = validateEmail(),
      passwordError = !password ? 'أدخل كلمة المرور.' : '',
      organizationError =
        mode === 'api' && !/^[a-z0-9][a-z0-9-]{1,62}$/.test(organization.trim())
          ? 'أدخل معرّف مؤسسة صالحًا (حروف صغيرة وأرقام وشرطة، من حرفين إلى 63).'
          : '';
    if (emailError || passwordError || organizationError) {
      setErrors({ email: emailError, password: passwordError, organization: organizationError });
      focus(organizationError ? organizationRef : emailError ? emailRef : passwordRef);
      return;
    }
    if (mode === 'api') {
      setSubmitting(true);
      setErrors({});
      try {
        await onLogin({ organization: organization.trim(), email: email.trim(), password });
        setPassword('');
        setEmail('');
        setOrganization('');
      } catch (error) {
        setErrors({ form: error?.message || 'تعذر تسجيل الدخول إلى الخادم.' });
      } finally {
        setSubmitting(false);
      }
      return;
    }
    setPassword('');
    setShowPassword(false);
    setCode('');
    setCaret(0);
    move('verify');
  };
  const submitCode = e => {
    e.preventDefault();
    if (code.length !== 6) {
      setErrors({ code: 'أدخل رمزًا مكوّنًا من ٦ أرقام.' });
      focus(codeRef);
      return;
    }
    if (code !== DEMO_CODE) {
      setErrors({ code: 'الرمز لا يطابق رمز التجربة الموضّح أدناه.' });
      focus(codeRef);
      return;
    }
    setCode('');
    setEmail('');
    onLogin();
  };
  const submitRecovery = e => {
    e.preventDefault();
    const error = validateEmail();
    if (error) {
      setErrors({ email: error });
      focus(emailRef);
      return;
    }
    move('recoveryDone');
  };
  const fillDemo = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setErrors({});
    focus(passwordRef);
  };
  const setCodeAndCaret = value => {
    const normalized = normalizeCode(value);
    setCode(normalized);
    setCaret(normalized.length);
    clearError('code');
    requestAnimationFrame(() => {
      codeRef.current?.focus();
      codeRef.current?.setSelectionRange(normalized.length, normalized.length);
    });
  };
  const fillCode = () => setCodeAndCaret(DEMO_CODE);
  const emailField = (
    <div className="auth-field">
      <label htmlFor="auth-email">البريد الإلكتروني</label>
      <div className={`auth-input-wrap ${errors.email ? 'invalid' : ''}`}>
        <Mail size={18} />
        <input
          id="auth-email"
          ref={emailRef}
          required
          type="email"
          inputMode="email"
          dir="ltr"
          autoComplete={mode === 'api' ? 'username' : 'off'}
          spellCheck="false"
          placeholder={mode === 'api' ? 'analyst@example.com' : 'analyst@example.test'}
          value={email}
          onChange={e => {
            setEmail(e.target.value);
            clearError('email');
          }}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'auth-email-error' : undefined}
        />
      </div>
      <FieldError id="auth-email-error">{errors.email}</FieldError>
    </div>
  );
  return (
    <div className="auth-page" dir="rtl">
      <main className="auth-main">
        <div className="auth-top">
          <button
            type="button"
            className="auth-theme"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'تفعيل المظهر الفاتح' : 'تفعيل المظهر الداكن'}
            aria-label={theme === 'dark' ? 'تفعيل المظهر الفاتح' : 'تفعيل المظهر الداكن'}
            aria-pressed={theme === 'light'}
          >
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
        </div>
        <div className="auth-content">
          {mode === 'demo' && (step === 'login' || step === 'verify') && <Stepper step={step} />}
          {step === 'login' && (
            <section className="auth-stage" aria-labelledby="auth-heading">
              <div className="auth-heading">
                <span className="auth-eyebrow">
                  <i /> {mode === 'api' ? 'اتصال بخادم NEXORA' : 'مساحة العمل التجريبية'}
                </span>
                <h1 id="auth-heading" ref={headingRef} tabIndex={-1}>
                  مرحبًا بعودتك
                </h1>
                <p>
                  {mode === 'api'
                    ? 'سجّل الدخول بحساب المؤسسة للتحقق من بياناتها الحقيقية عبر API.'
                    : 'سجّل الدخول لمتابعة تجربة مركز العمليات الأمنية.'}
                </p>
              </div>
              <div className="auth-notice" role="note">
                <Shield size={18} />
                <p>
                  <strong>{mode === 'api' ? 'مصادقة فعلية عبر الخادم' : 'نموذج واجهات فقط'}</strong>
                  <span>
                    {mode === 'api'
                      ? 'لا تُحفظ الرموز في التخزين المحلي؛ تنتهي الجلسة عند إغلاق الصفحة.'
                      : 'لا تُستخدم بيانات حقيقية؛ لا توجد مصادقة أو اتصال بخادم.'}
                  </span>
                </p>
              </div>
              <form
                className="auth-form"
                onSubmit={submitLogin}
                onKeyDown={enterToSubmit(submitLogin)}
                noValidate
              >
                {mode === 'api' && (
                  <div className="auth-field">
                    <label htmlFor="auth-organization">معرّف المؤسسة</label>
                    <div className={`auth-input-wrap ${errors.organization ? 'invalid' : ''}`}>
                      <Building2 size={18} />
                      <input
                        id="auth-organization"
                        ref={organizationRef}
                        required
                        type="text"
                        dir="ltr"
                        autoComplete="organization"
                        spellCheck="false"
                        placeholder="example"
                        value={organization}
                        onChange={event => {
                          setOrganization(event.target.value);
                          clearError('organization');
                        }}
                        aria-invalid={!!errors.organization}
                        aria-describedby={
                          errors.organization ? 'auth-organization-error' : undefined
                        }
                      />
                    </div>
                    <FieldError id="auth-organization-error">{errors.organization}</FieldError>
                  </div>
                )}
                {emailField}
                <div className="auth-field">
                  <div className="auth-label-row">
                    <label htmlFor="auth-password">كلمة المرور</label>
                    {mode === 'demo' && (
                      <button
                        type="button"
                        className="auth-inline-link"
                        onClick={() => {
                          setPassword('');
                          setShowPassword(false);
                          move('recovery');
                        }}
                      >
                        نسيت كلمة المرور؟
                      </button>
                    )}
                  </div>
                  <div className={`auth-input-wrap ${errors.password ? 'invalid' : ''}`}>
                    <LockKeyhole size={18} />
                    <input
                      id="auth-password"
                      ref={passwordRef}
                      required
                      type={showPassword ? 'text' : 'password'}
                      dir="ltr"
                      autoComplete={mode === 'api' ? 'current-password' : 'new-password'}
                      placeholder={mode === 'api' ? 'كلمة مرور الحساب' : 'أدخل كلمة مرور تجريبية'}
                      value={password}
                      onChange={e => {
                        setPassword(e.target.value);
                        clearError('password');
                      }}
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? 'auth-password-error' : undefined}
                    />
                    <button
                      type="button"
                      className="auth-show-password"
                      aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword(v => !v)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <FieldError id="auth-password-error">{errors.password}</FieldError>
                </div>
                <FieldError id="auth-form-error">{errors.form}</FieldError>
                <button
                  className="auth-submit"
                  type="button"
                  onClick={submitLogin}
                  disabled={submitting}
                >
                  <span>
                    {submitting
                      ? 'جارٍ الاتصال...'
                      : mode === 'api'
                        ? 'تسجيل الدخول إلى NEXORA'
                        : 'المتابعة إلى التحقق'}
                  </span>
                  <ArrowLeft size={18} />
                </button>
              </form>
              {mode === 'demo' && (
                <>
                  <div className="auth-divider">
                    <span />
                    أو للتجربة السريعة
                    <span />
                  </div>
                  <button type="button" className="auth-demo-button" onClick={fillDemo}>
                    <Sparkles size={17} /> استخدام بيانات تجريبية <ArrowLeft size={16} />
                  </button>
                  <p className="auth-helper">
                    تُفحص صيغة الحقول فقط، ثم تُفتح مساحة عمل افتراضية موحّدة.
                  </p>
                </>
              )}
            </section>
          )}
          {step === 'verify' && (
            <section className="auth-stage" aria-labelledby="auth-heading">
              <BackButton
                onClick={() => {
                  setCode('');
                  move('login');
                }}
              />
              <div className="auth-heading auth-heading-verify">
                <span className="auth-eyebrow">
                  <i /> الخطوة الثانية
                </span>
                <h1 id="auth-heading" ref={headingRef} tabIndex={-1}>
                  التحقق بخطوتين
                </h1>
                <p>أدخل الرمز المكوّن من ٦ أرقام لإكمال تجربة الدخول.</p>
              </div>
              <div className="auth-account">
                <span className="auth-account-icon">
                  <UserRound size={18} />
                </span>
                <div>
                  <small>الحساب المدخل</small>
                  <bdi dir="ltr">{email.trim()}</bdi>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCode('');
                    move('login');
                  }}
                >
                  تعديل
                </button>
              </div>
              <form
                className="auth-form auth-verify-form"
                onSubmit={submitCode}
                onKeyDown={enterToSubmit(submitCode)}
                noValidate
              >
                <div className="auth-field">
                  <label htmlFor="auth-code">رمز التحقق التجريبي</label>
                  <p className="auth-field-hint" id="auth-code-hint">
                    اكتب الأرقام أو الصق الرمز كاملًا.
                  </p>
                  <div className={`auth-code-control ${errors.code ? 'invalid' : ''}`} dir="ltr">
                    <input
                      id="auth-code"
                      ref={codeRef}
                      required
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={code}
                      onChange={e => {
                        const normalized = normalizeCode(e.target.value);
                        setCode(normalized);
                        setCaret(
                          Math.min(e.target.selectionStart ?? normalized.length, normalized.length),
                        );
                        clearError('code');
                      }}
                      onSelect={e => setCaret(e.currentTarget.selectionStart ?? code.length)}
                      onClick={e => {
                        const input = e.currentTarget,
                          box = input.getBoundingClientRect(),
                          position = Math.min(
                            code.length,
                            Math.max(0, Math.floor(((e.clientX - box.left) / box.width) * 6)),
                          );
                        input.setSelectionRange(position, position);
                        setCaret(position);
                      }}
                      onPaste={e => {
                        e.preventDefault();
                        setCodeAndCaret(e.clipboardData.getData('text'));
                      }}
                      aria-label="رمز التحقق التجريبي، ستة أرقام"
                      aria-invalid={!!errors.code}
                      aria-describedby={`auth-code-hint${errors.code ? ' auth-code-error' : ''}`}
                    />
                    <div className="auth-code-slots" aria-hidden="true">
                      {Array.from({ length: 6 }, (_, i) => (
                        <span
                          key={i}
                          className={`${code[i] ? 'filled' : ''} ${i === Math.min(caret, 5) ? 'next' : ''}`}
                        >
                          {code[i] || ''}
                        </span>
                      ))}
                    </div>
                  </div>
                  <FieldError id="auth-code-error">{errors.code}</FieldError>
                </div>
                <div className="auth-demo-code">
                  <span>
                    <KeyRound size={15} /> رمز التجربة: <bdi dir="ltr">{DEMO_CODE}</bdi>
                  </span>
                  <button type="button" onClick={fillCode}>
                    ملء الرمز
                  </button>
                </div>
                <button className="auth-submit" type="button" onClick={submitCode}>
                  <span>التحقق والدخول</span>
                  <ArrowLeft size={18} />
                </button>
              </form>
              <div className="auth-notice auth-notice-compact" role="note">
                <CircleAlert size={18} />
                <p>
                  <strong>للإيضاح فقط</strong>
                  <span>الرمز ثابت محليًا ولا يتصل بتطبيق مصادقة أو يثبت الهوية.</span>
                </p>
              </div>
            </section>
          )}
          {step === 'recovery' && (
            <section className="auth-stage" aria-labelledby="auth-heading">
              <BackButton onClick={() => move('login')} />
              <div className="auth-heading auth-heading-verify">
                <span className="auth-eyebrow">
                  <i /> استعادة الوصول
                </span>
                <h1 id="auth-heading" ref={headingRef} tabIndex={-1}>
                  نسيت كلمة المرور؟
                </h1>
                <p>أدخل بريدًا تجريبيًا لمعاينة تجربة استعادة الوصول.</p>
              </div>
              <div className="auth-notice" role="note">
                <CircleAlert size={18} />
                <p>
                  <strong>معاينة فقط</strong>
                  <span>لن تُرسل رسالة، ولا توجد حسابات حقيقية مرتبطة بالواجهة.</span>
                </p>
              </div>
              <form
                className="auth-form"
                onSubmit={submitRecovery}
                onKeyDown={enterToSubmit(submitRecovery)}
                noValidate
              >
                {emailField}
                <button className="auth-submit" type="button" onClick={submitRecovery}>
                  <span>متابعة الاستعادة التجريبية</span>
                  <ArrowLeft size={18} />
                </button>
              </form>
            </section>
          )}
          {step === 'recoveryDone' && (
            <section className="auth-stage auth-recovery-done" aria-labelledby="auth-heading">
              <div className="auth-success-icon">
                <Check size={23} />
              </div>
              <div className="auth-heading">
                <span className="auth-eyebrow">
                  <i /> حالة توضيحية
                </span>
                <h1 id="auth-heading" ref={headingRef} tabIndex={-1}>
                  تم عرض حالة الاستعادة
                </h1>
                <p>هذه معاينة لشاشة التأكيد فقط؛ لم يتم إرسال أي رسالة أو تغيير كلمة مرور.</p>
              </div>
              <div className="auth-account">
                <span className="auth-account-icon">
                  <Mail size={18} />
                </span>
                <div>
                  <small>البريد المدخل</small>
                  <bdi dir="ltr">{email.trim()}</bdi>
                </div>
              </div>
              <button type="button" className="auth-submit" onClick={() => move('login')}>
                <span>العودة لتسجيل الدخول</span>
                <ArrowLeft size={18} />
              </button>
            </section>
          )}
        </div>
        <div className="auth-footer">
          <span>
            <ShieldCheck size={14} /> تجربة محلية دون اتصال بخادم
          </span>
          <span dir="ltr">NEXORA · UI DEMO</span>
        </div>
      </main>
      <aside className="auth-aside" aria-label="عن الواجهة التجريبية">
        <div className="mesh-frame" aria-hidden="true">
          <NeuralMesh theme={theme} motionMode="on" />
        </div>
        <div className="auth-aside-top">
          <div className="auth-aside-badges">
            <span className="auth-aside-badge">
              <i /> شبكة مرئية · تجريبي
            </span>
            <span className="auth-aside-badge" dir="ltr">
              NEXORA UI
            </span>
          </div>
          <img
            className="auth-aside-logo nexora-wordmark"
            src={theme === 'light' ? logoLight : logoDark}
            alt="NEXORA"
          />
        </div>
        <div className="auth-aside-copy">
          <span className="auth-aside-overline">
            <Fingerprint size={16} /> SECURITY, IN CONTEXT
          </span>
          <h2>
            رؤية أوضح.
            <br />
            <em>استجابة أكثر ثقة.</em>
          </h2>
          <p>اجمع الإشارات والسياق وقرارات فريقك في مساحة عمل واحدة مصمّمة للمحلل الأمني.</p>
          <div className="auth-feature-row">
            <span>
              <Activity size={15} /> سياق موحّد
            </span>
            <i />
            <span>
              <ShieldCheck size={15} /> قرارات واضحة
            </span>
            <i />
            <span>
              <Sparkles size={15} /> تجربة عربية
            </span>
          </div>
        </div>
        <div className="auth-aside-foot">
          <span>واجهة تصميمية · بيانات افتراضية</span>
          <span dir="ltr">NEXORA / 01</span>
        </div>
      </aside>
    </div>
  );
}
