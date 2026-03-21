import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../contexts/I18nContext';
import { useUser } from '../../contexts/UserContext';
import ProgressBar from '../../components/ProgressBar';
import { ArrowLeft } from 'lucide-react';

const TOTAL_STEPS = 10;

export default function OnboardingFlow() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { state, dispatch } = useUser();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    preferredName: '',
    ageVerified: null,
    country: 'India',
    age: null,
    unitSystem: 'metric',
    heightCm: 160,
    heightFt: 5,
    heightIn: 6,
    weightKg: 65,
    weightLb: 143,
    gender: null,
  });

  function update(obj) {
    setForm(prev => ({ ...prev, ...obj }));
  }

  function next() {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
  }

  function back() {
    if (step > 0) setStep(step - 1);
    else navigate('/');
  }

  function skipToChat() {
    dispatch({ type: 'UPDATE_PROFILE', payload: form });
    navigate('/patient/chat');
  }

  function finishOnboarding(goToProfile = false) {
    dispatch({ type: 'UPDATE_PROFILE', payload: form });
    navigate(goToProfile ? '/patient/profile' : '/patient/chat');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') next();
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      {/* Progress bar */}
      <div className="sticky top-0 z-40 bg-surface px-4 pt-4 pb-2">
        <ProgressBar current={step} total={TOTAL_STEPS - 1} />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-2">
        <button onClick={back} className="btn-ghost flex items-center gap-1 min-h-[48px]">
          <ArrowLeft size={20} />
          <span>{t('common.back')}</span>
        </button>
        <button onClick={skipToChat} className="btn-ghost text-text-hint min-h-[48px]">
          {t('common.skipAll')}
        </button>
      </div>

      {/* Step Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 max-w-lg mx-auto w-full" onKeyDown={handleKeyDown}>
        {step === 0 && <StepWelcome t={t} onNext={next} onSkip={skipToChat} />}
        {step === 1 && <StepName t={t} form={form} update={update} onNext={next} />}
        {step === 2 && <StepAgeVerify t={t} form={form} update={update} onNext={next} navigate={navigate} />}
        {step === 3 && <StepCountry t={t} form={form} update={update} onNext={next} />}
        {step === 4 && <StepAge t={t} form={form} update={update} onNext={next} />}
        {step === 5 && <StepUnitSystem t={t} form={form} update={update} onNext={next} />}
        {step === 6 && <StepHeight t={t} form={form} update={update} onNext={next} />}
        {step === 7 && <StepWeight t={t} form={form} update={update} onNext={next} />}
        {step === 8 && <StepGender t={t} form={form} update={update} onNext={next} />}
        {step === 9 && <StepProfileBranch t={t} onComplete={() => finishOnboarding(true)} onSkip={() => finishOnboarding(false)} />}
      </div>
    </div>
  );
}

function StepWelcome({ t, onNext, onSkip }) {
  return (
    <div className="text-center">
      <svg width="80" height="80" viewBox="0 0 80 80" className="mx-auto mb-6">
        <circle cx="40" cy="40" r="36" fill="var(--color-primary-light)" />
        <path d="M28 40 C28 28, 52 28, 52 40 C52 52, 40 60, 40 60 C40 60, 28 52, 28 40Z" fill="var(--color-primary)" opacity="0.3" />
        <text x="40" y="46" textAnchor="middle" fontSize="28" fill="var(--color-primary)">👋</text>
      </svg>
      <h1 className="font-display text-2xl mb-3 text-text-primary">{t('onboarding.welcome_title')}</h1>
      <p className="text-text-secondary text-base mb-8 leading-relaxed">{t('onboarding.welcome_body')}</p>
      <div className="flex flex-col gap-3">
        <button onClick={onNext} className="btn-primary w-full">{t('common.letsStart')}</button>
        <button onClick={onSkip} className="btn-ghost">{t('common.skipAll')}</button>
      </div>
    </div>
  );
}

function StepName({ t, form, update, onNext }) {
  return (
    <div className="w-full text-center">
      <h1 className="font-display text-2xl mb-2 text-text-primary">{t('onboarding.name_title')}</h1>
      <p className="text-text-secondary text-base mb-6">{t('onboarding.name_sub')}</p>
      <input
        type="text"
        value={form.preferredName}
        onChange={(e) => update({ preferredName: e.target.value })}
        placeholder={t('onboarding.name_placeholder')}
        className="input-field text-center text-xl mb-4"
        autoFocus
      />
      <p className="text-text-hint text-sm mb-6">{t('onboarding.name_privacy')}</p>
      <div className="flex gap-3 justify-center">
        <button onClick={onNext} className="btn-ghost">{t('common.skip')}</button>
        <button onClick={onNext} className="btn-primary">{t('common.next')} →</button>
      </div>
    </div>
  );
}

function StepAgeVerify({ t, form, update, onNext, navigate }) {
  const [underage, setUnderage] = useState(false);

  function handleYes() {
    update({ ageVerified: true });
    onNext();
  }

  function handleNo() {
    update({ ageVerified: false });
    setUnderage(true);
  }

  if (underage) {
    return (
      <div className="w-full text-center">
        <h1 className="font-display text-2xl mb-2 text-text-primary">{t('onboarding.age_verify_title')}</h1>
        <div className="card p-6 mt-4">
          <p className="text-text-secondary text-base mb-4">{t('onboarding.age_underage')}</p>
          <button onClick={() => navigate('/asha')} className="btn-secondary w-full">{t('onboarding.age_asha_link')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full text-center">
      <h1 className="font-display text-2xl mb-2 text-text-primary">{t('onboarding.age_verify_title')}</h1>
      <p className="text-text-secondary text-base mb-8">{t('onboarding.age_verify_sub')}</p>
      <div className="flex flex-col gap-4">
        <button onClick={handleYes} className="btn-primary w-full text-lg flex items-center justify-center gap-2">
          ✓ {t('onboarding.age_yes')}
        </button>
        <button onClick={handleNo} className="btn-secondary w-full text-lg flex items-center justify-center gap-2">
          ✗ {t('onboarding.age_no')}
        </button>
      </div>
    </div>
  );
}

function StepCountry({ t, form, update, onNext }) {
  return (
    <div className="w-full text-center">
      <h1 className="font-display text-2xl mb-2 text-text-primary">{t('onboarding.country_title')}</h1>
      <div className="card p-6 mt-6 flex items-center gap-4">
        <span className="text-3xl">🇮🇳</span>
        <span className="text-xl font-semibold text-text-primary">{t('onboarding.country_india')}</span>
      </div>
      <select
        value={form.country}
        onChange={(e) => update({ country: e.target.value })}
        className="input-field mt-4 text-center"
      >
        <option value="India">🇮🇳 India</option>
        <option value="Nepal">🇳🇵 Nepal</option>
        <option value="Bangladesh">🇧🇩 Bangladesh</option>
        <option value="Sri Lanka">🇱🇰 Sri Lanka</option>
        <option value="Other">Other</option>
      </select>
      <button onClick={onNext} className="btn-primary mt-6 w-full">{t('common.next')} →</button>
    </div>
  );
}

function StepAge({ t, form, update, onNext }) {
  const age = form.age || 30;

  return (
    <div className="w-full text-center">
      <h1 className="font-display text-2xl mb-2 text-text-primary">{t('onboarding.age_title')}</h1>
      <p className="text-text-secondary text-base mb-6">{t('onboarding.age_sub')}</p>
      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          onClick={() => update({ age: Math.max(18, age - 1) })}
          className="w-12 h-12 rounded-full bg-surface-2 border border-border flex items-center justify-center text-xl font-bold text-text-primary min-h-[48px]"
        >
          −
        </button>
        <input
          type="number"
          min={18}
          max={120}
          value={age}
          onChange={(e) => update({ age: Math.max(18, Math.min(120, parseInt(e.target.value) || 18)) })}
          className="input-field w-24 text-center text-2xl font-bold"
        />
        <button
          onClick={() => update({ age: Math.min(120, age + 1) })}
          className="w-12 h-12 rounded-full bg-surface-2 border border-border flex items-center justify-center text-xl font-bold text-text-primary min-h-[48px]"
        >
          +
        </button>
      </div>
      <p className="text-text-secondary text-base mb-6">
        {t('onboarding.age_display').replace('{age}', age)}
      </p>
      <div className="flex gap-3 justify-center">
        <button onClick={onNext} className="btn-ghost">{t('common.skip')}</button>
        <button onClick={onNext} className="btn-primary">{t('common.next')} →</button>
      </div>
    </div>
  );
}

function StepUnitSystem({ t, form, update, onNext }) {
  return (
    <div className="w-full text-center">
      <h1 className="font-display text-2xl mb-6 text-text-primary">{t('onboarding.unit_title')}</h1>
      <div className="flex gap-4 mb-8">
        {['metric', 'imperial'].map((sys) => (
          <button
            key={sys}
            onClick={() => { update({ unitSystem: sys }); onNext(); }}
            className={`flex-1 card py-6 text-center text-base font-semibold transition-all min-h-[80px] ${
              form.unitSystem === sys ? 'border-primary border-2 text-primary' : 'text-text-primary'
            }`}
          >
            {sys === 'metric' ? t('onboarding.unit_metric') : t('onboarding.unit_imperial')}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepHeight({ t, form, update, onNext }) {
  const isMetric = form.unitSystem === 'metric';

  if (isMetric) {
    return (
      <div className="w-full text-center">
        <h1 className="font-display text-2xl mb-6 text-text-primary">{t('onboarding.height_title')}</h1>
        <div className="flex items-center justify-center gap-4 mb-2">
          <div className="flex-1">
            <input
              type="range"
              min={100}
              max={220}
              value={form.heightCm || 160}
              onChange={(e) => update({ heightCm: parseInt(e.target.value) })}
              className="w-full accent-[var(--color-primary)]"
              style={{ accentColor: 'var(--color-primary)' }}
            />
          </div>
        </div>
        <p className="text-2xl font-bold text-primary mb-2">{form.heightCm || 160} cm</p>
        {/* Simple silhouette */}
        <div className="flex justify-center mb-6">
          <div className="relative" style={{ height: `${Math.max(60, ((form.heightCm || 160) - 100) * 0.8 + 60)}px` }}>
            <svg width="40" viewBox="0 0 40 100" className="text-primary opacity-30" style={{ height: '100%' }}>
              <circle cx="20" cy="10" r="8" fill="currentColor" />
              <rect x="12" y="20" width="16" height="40" rx="4" fill="currentColor" />
              <rect x="10" y="60" width="8" height="30" rx="3" fill="currentColor" />
              <rect x="22" y="60" width="8" height="30" rx="3" fill="currentColor" />
            </svg>
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <button onClick={onNext} className="btn-ghost">{t('common.skip')}</button>
          <button onClick={onNext} className="btn-primary">{t('common.next')} →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full text-center">
      <h1 className="font-display text-2xl mb-6 text-text-primary">{t('onboarding.height_title')}</h1>
      <div className="flex gap-4 justify-center mb-6">
        <div>
          <label className="text-text-secondary text-sm block mb-1">{t('onboarding.height_feet')}</label>
          <input
            type="number"
            min={4}
            max={7}
            value={form.heightFt || 5}
            onChange={(e) => update({ heightFt: parseInt(e.target.value) || 5 })}
            className="input-field w-20 text-center text-xl"
          />
        </div>
        <div>
          <label className="text-text-secondary text-sm block mb-1">{t('onboarding.height_inches')}</label>
          <input
            type="number"
            min={0}
            max={11}
            value={form.heightIn || 6}
            onChange={(e) => update({ heightIn: parseInt(e.target.value) || 0 })}
            className="input-field w-20 text-center text-xl"
          />
        </div>
      </div>
      <div className="flex gap-3 justify-center">
        <button onClick={onNext} className="btn-ghost">{t('common.skip')}</button>
        <button onClick={onNext} className="btn-primary">{t('common.next')} →</button>
      </div>
    </div>
  );
}

function StepWeight({ t, form, update, onNext }) {
  const isMetric = form.unitSystem === 'metric';

  return (
    <div className="w-full text-center">
      <h1 className="font-display text-2xl mb-6 text-text-primary">{t('onboarding.weight_title')}</h1>
      {isMetric ? (
        <>
          <input
            type="range"
            min={30}
            max={200}
            value={form.weightKg || 65}
            onChange={(e) => update({ weightKg: parseInt(e.target.value) })}
            className="w-full mb-4"
            style={{ accentColor: 'var(--color-primary)' }}
          />
          <p className="text-2xl font-bold text-primary mb-6">{form.weightKg || 65} kg</p>
        </>
      ) : (
        <>
          <input
            type="number"
            min={66}
            max={440}
            value={form.weightLb || 143}
            onChange={(e) => update({ weightLb: parseInt(e.target.value) || 143 })}
            className="input-field w-32 text-center text-xl mx-auto mb-2"
          />
          <p className="text-text-secondary text-base mb-6">lbs</p>
        </>
      )}
      <div className="flex gap-3 justify-center">
        <button onClick={onNext} className="btn-ghost">{t('common.skip')}</button>
        <button onClick={onNext} className="btn-primary">{t('common.next')} →</button>
      </div>
    </div>
  );
}

function StepGender({ t, form, update, onNext }) {
  const genders = [
    { value: 'male', label: t('onboarding.gender_male') },
    { value: 'female', label: t('onboarding.gender_female') },
    { value: 'other', label: t('onboarding.gender_other') },
    { value: 'prefer_not', label: t('onboarding.gender_prefer_not') },
  ];

  function select(val) {
    update({ gender: val });
    onNext();
  }

  return (
    <div className="w-full text-center">
      <h1 className="font-display text-2xl mb-6 text-text-primary">{t('onboarding.gender_title')}</h1>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {genders.map((g) => (
          <button
            key={g.value}
            onClick={() => select(g.value)}
            className={`card py-5 text-center text-base font-semibold transition-all min-h-[60px] ${
              form.gender === g.value ? 'border-primary border-2 text-primary' : 'text-text-primary hover:border-primary'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
      <button onClick={onNext} className="btn-ghost">{t('common.skip')}</button>
    </div>
  );
}

function StepProfileBranch({ t, onComplete, onSkip }) {
  return (
    <div className="w-full text-center">
      <h1 className="font-display text-2xl mb-2 text-text-primary">{t('onboarding.profile_title')}</h1>
      <p className="text-text-secondary text-base mb-6">{t('onboarding.profile_sub')}</p>
      <div className="card p-4 mb-6 text-left">
        <p className="text-text-secondary text-base">📋 {t('onboarding.profile_preview')}</p>
      </div>
      <div className="flex flex-col gap-3">
        <button onClick={onComplete} className="btn-primary w-full">{t('onboarding.profile_complete')}</button>
        <button onClick={onSkip} className="btn-ghost">{t('onboarding.profile_skip')}</button>
      </div>
    </div>
  );
}
