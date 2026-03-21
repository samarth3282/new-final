import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../contexts/I18nContext';
import { useUser } from '../../contexts/UserContext';
import { useToast } from '../../components/Toast';
import { ArrowLeft, ShieldCheck, Pill, AlertCircle, Heart, Plus, X } from 'lucide-react';

export default function HealthProfile() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { state, dispatch } = useUser();
  const { addToast } = useToast();

  const [allergies, setAllergies] = useState(state.profile.allergies || []);
  const [conditions, setConditions] = useState(state.profile.conditions || []);
  const [medications, setMedications] = useState(state.profile.medications || []);

  const [allergyInput, setAllergyInput] = useState('');
  const [conditionInput, setConditionInput] = useState('');
  const [medicationInput, setMedicationInput] = useState('');

  function addItem(list, setList, input, setInput) {
    const val = input.trim();
    if (val && !list.includes(val)) {
      setList(prev => [...prev, val]);
    }
    setInput('');
  }

  function removeItem(list, setList, item) {
    setList(prev => prev.filter(i => i !== item));
  }

  function handleSave() {
    dispatch({
      type: 'UPDATE_PROFILE',
      payload: { allergies, conditions, medications },
    });
    addToast(t('profile.saved'), 'success');
    navigate('/patient/chat');
  }

  function TagList({ items, onRemove, color }) {
    if (items.length === 0) return null;
    const colorMap = {
      red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
      blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
      green: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    };
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {items.map(item => (
          <span key={item} className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${colorMap[color]}`}>
            {item}
            <button onClick={() => onRemove(item)} className="hover:opacity-70 min-w-[20px] min-h-[20px] flex items-center justify-center">
              <X size={14} />
            </button>
          </span>
        ))}
      </div>
    );
  }

  function InputRow({ value, onChange, onAdd, placeholder }) {
    return (
      <div className="flex gap-2 mt-3">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }}
          placeholder={placeholder}
          className="input-field flex-1"
        />
        <button type="button" onClick={onAdd} className="btn-ghost px-3 min-h-[48px] flex items-center justify-center">
          <Plus size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-surface border-b border-border px-4 py-3 flex items-center gap-3 min-h-[56px]">
        <button onClick={() => navigate(-1)} className="text-text-secondary hover:text-primary transition-colors min-h-[48px] flex items-center">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-body font-semibold text-lg text-text-primary">{t('profile.title')}</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Summary */}
        <div className="card p-5 flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/10 text-primary">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="text-sm text-text-primary font-medium">{t('profile.intro_title')}</p>
            <p className="text-xs text-text-secondary mt-1">{t('profile.intro_desc')}</p>
          </div>
        </div>

        {/* Allergies */}
        <section className="card p-5">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-1">
            <AlertCircle size={18} />
            <h2 className="font-semibold text-base">{t('profile.allergies')}</h2>
          </div>
          <p className="text-xs text-text-secondary mb-2">{t('profile.allergies_hint')}</p>
          <TagList items={allergies} onRemove={item => removeItem(allergies, setAllergies, item)} color="red" />
          <InputRow
            value={allergyInput}
            onChange={setAllergyInput}
            onAdd={() => addItem(allergies, setAllergies, allergyInput, setAllergyInput)}
            placeholder={t('profile.allergies_placeholder')}
          />
        </section>

        {/* Conditions */}
        <section className="card p-5">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
            <Heart size={18} />
            <h2 className="font-semibold text-base">{t('profile.conditions')}</h2>
          </div>
          <p className="text-xs text-text-secondary mb-2">{t('profile.conditions_hint')}</p>
          <TagList items={conditions} onRemove={item => removeItem(conditions, setConditions, item)} color="blue" />
          <InputRow
            value={conditionInput}
            onChange={setConditionInput}
            onAdd={() => addItem(conditions, setConditions, conditionInput, setConditionInput)}
            placeholder={t('profile.conditions_placeholder')}
          />
        </section>

        {/* Medications */}
        <section className="card p-5">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
            <Pill size={18} />
            <h2 className="font-semibold text-base">{t('profile.medications')}</h2>
          </div>
          <p className="text-xs text-text-secondary mb-2">{t('profile.medications_hint')}</p>
          <TagList items={medications} onRemove={item => removeItem(medications, setMedications, item)} color="green" />
          <InputRow
            value={medicationInput}
            onChange={setMedicationInput}
            onAdd={() => addItem(medications, setMedications, medicationInput, setMedicationInput)}
            placeholder={t('profile.medications_placeholder')}
          />
        </section>

        {/* Actions */}
        <div className="flex flex-col gap-3 pb-6">
          <button onClick={handleSave} className="btn-primary w-full">
            {t('profile.save_continue')}
          </button>
          <button onClick={() => navigate('/patient/chat')} className="btn-ghost">
            {t('profile.skip_to_chat')}
          </button>
        </div>
      </div>
    </div>
  );
}
