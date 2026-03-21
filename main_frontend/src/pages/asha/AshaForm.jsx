import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../contexts/I18nContext';
import { useUser } from '../../contexts/UserContext';
import { useToast } from '../../components/Toast';
import { ArrowLeft, User, MapPin, Thermometer, FileText, Send } from 'lucide-react';
import { postAshaReport } from '../../utils/api';

const COMMON_SYMPTOMS = [
  'Fever', 'Cough', 'Headache', 'Vomiting', 'Diarrhea',
  'Body pain', 'Skin rash', 'Breathlessness', 'Fatigue',
];

export default function AshaForm() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { state } = useUser();
  const { addToast } = useToast();

  const [form, setForm] = useState({
    patientName: '',
    age: '',
    gender: '',
    village: '',
    symptoms: [],
    customSymptom: '',
    temperature: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  function updateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function toggleSymptom(symptom) {
    setForm(prev => ({
      ...prev,
      symptoms: prev.symptoms.includes(symptom)
        ? prev.symptoms.filter(s => s !== symptom)
        : [...prev.symptoms, symptom],
    }));
  }

  function addCustomSymptom() {
    if (form.customSymptom.trim() && !form.symptoms.includes(form.customSymptom.trim())) {
      setForm(prev => ({
        ...prev,
        symptoms: [...prev.symptoms, prev.customSymptom.trim()],
        customSymptom: '',
      }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.patientName.trim()) {
      addToast(t('asha.name_required'), 'warning');
      return;
    }
    if (!form.age || Number(form.age) < 0 || Number(form.age) > 120) {
      addToast(t('asha.valid_age_required'), 'warning');
      return;
    }
    if (form.symptoms.length === 0) {
      addToast(t('asha.symptoms_required'), 'warning');
      return;
    }

    setSubmitting(true);
    try {
      await postAshaReport({
        ...form,
        ashaId: state.profile.preferredName || 'ASHA Worker',
        submittedAt: new Date().toISOString(),
      });
      navigate('/asha/confirm', { state: { report: form } });
    } catch {
      addToast(t('common.error'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-surface border-b border-border px-4 py-3 flex items-center gap-3 min-h-[56px]">
        <button onClick={() => navigate('/')} className="text-text-secondary hover:text-primary transition-colors min-h-[48px] flex items-center">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-body font-semibold text-lg text-text-primary">{t('asha.form_title')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Patient Info */}
        <section className="card p-5 space-y-4">
          <div className="flex items-center gap-2 text-primary mb-1">
            <User size={18} />
            <h2 className="font-semibold text-base">{t('asha.patient_info')}</h2>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">{t('asha.patient_name')}</label>
            <input
              type="text"
              value={form.patientName}
              onChange={e => updateField('patientName', e.target.value)}
              className="input-field w-full"
              placeholder={t('asha.patient_name_placeholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">{t('asha.age')}</label>
              <input
                type="number"
                min="0"
                max="120"
                value={form.age}
                onChange={e => updateField('age', e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">{t('asha.gender')}</label>
              <select value={form.gender} onChange={e => updateField('gender', e.target.value)} className="input-field w-full">
                <option value="">{t('asha.select_gender')}</option>
                <option value="male">{t('common.male')}</option>
                <option value="female">{t('common.female')}</option>
                <option value="other">{t('common.other')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1 flex items-center gap-1">
              <MapPin size={14} /> {t('asha.village')}
            </label>
            <input
              type="text"
              value={form.village}
              onChange={e => updateField('village', e.target.value)}
              className="input-field w-full"
              placeholder={t('asha.village_placeholder')}
            />
          </div>
        </section>

        {/* Symptoms */}
        <section className="card p-5 space-y-4">
          <div className="flex items-center gap-2 text-primary mb-1">
            <Thermometer size={18} />
            <h2 className="font-semibold text-base">{t('asha.symptoms_section')}</h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {COMMON_SYMPTOMS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSymptom(s)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  form.symptoms.includes(s)
                    ? 'bg-primary text-white'
                    : 'bg-muted text-text-secondary hover:bg-primary/10'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={form.customSymptom}
              onChange={e => updateField('customSymptom', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomSymptom(); } }}
              className="input-field flex-1"
              placeholder={t('asha.other_symptom')}
            />
            <button type="button" onClick={addCustomSymptom} className="btn-ghost px-3">+</button>
          </div>

          {form.symptoms.length > 0 && (
            <div className="text-xs text-text-secondary">
              {t('asha.selected')}: {form.symptoms.join(', ')}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">{t('asha.temperature')}</label>
            <input
              type="text"
              value={form.temperature}
              onChange={e => updateField('temperature', e.target.value)}
              className="input-field w-full"
              placeholder="e.g. 101°F"
            />
          </div>
        </section>

        {/* Notes */}
        <section className="card p-5 space-y-4">
          <div className="flex items-center gap-2 text-primary mb-1">
            <FileText size={18} />
            <h2 className="font-semibold text-base">{t('asha.notes_section')}</h2>
          </div>
          <textarea
            value={form.notes}
            onChange={e => updateField('notes', e.target.value)}
            className="input-field w-full min-h-[100px] resize-y"
            placeholder={t('asha.notes_placeholder')}
            rows={4}
          />
        </section>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Send size={18} />
          {submitting ? t('common.loading') : t('asha.submit_report')}
        </button>
      </form>
    </div>
  );
}
