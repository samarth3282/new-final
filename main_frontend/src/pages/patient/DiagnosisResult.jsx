import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../contexts/I18nContext';
import { useUser } from '../../contexts/UserContext';
import DiseaseCard from '../../components/DiseaseCard';
import HospitalCarousel from '../../components/HospitalCarousel';
import EmergencyBanner from '../../components/EmergencyBanner';
import { ArrowLeft, MessageCircle, MapPin, Download, AlertTriangle, CheckCircle, Activity } from 'lucide-react';
import { mockHospitals, mockDiagnosisResult } from '../../utils/mockData';
import { downloadReport, generateReport } from '../../utils/reportGenerator';

const TRIAGE_CONFIG = {
  'self-care': {
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    border: 'border-green-500',
    icon: CheckCircle,
    key: 'results.triage_self_care',
    descKey: 'results.triage_self_care_desc',
  },
  clinic: {
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    border: 'border-yellow-500',
    icon: Activity,
    key: 'results.triage_clinic',
    descKey: 'results.triage_clinic_desc',
  },
  emergency: {
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    border: 'border-red-500',
    icon: AlertTriangle,
    key: 'results.triage_emergency',
    descKey: 'results.triage_emergency_desc',
  },
};

export default function DiagnosisResult() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { state, dispatch } = useUser();

  const diagnosis = state.diagnosisResult || mockDiagnosisResult;
  const triageTier = diagnosis.triage_tier || 'clinic';
  const diseases = diagnosis.diseases || [];
  const topDiseases = diseases.slice(0, 3);
  const otherDiseases = diseases.slice(3, 5);
  const config = TRIAGE_CONFIG[triageTier] || TRIAGE_CONFIG.clinic;
  const TriageIcon = config.icon;

  function handleChatAgain() {
    dispatch({ type: 'CLEAR_CHAT' });
    navigate('/patient/chat');
  }

  function handleFindClinic() {
    window.open(
      `https://www.google.com/maps/search/clinic+near+me`,
      '_blank',
      'noopener,noreferrer'
    );
  }

  function handleDownloadReport() {
    generateReport({
      userProfile: state.profile,
      chatSummary: state.symptomData?.symptoms?.join(', ') || 'N/A',
      triageTier,
      diseases,
    });
    downloadReport();
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-surface border-b border-border px-4 py-3 flex items-center gap-3 min-h-[56px]">
        <button onClick={() => navigate('/patient/chat')} className="text-text-secondary hover:text-primary transition-colors min-h-[48px] flex items-center">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-body font-semibold text-lg text-text-primary">{t('results.title')}</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Emergency banner for emergency tier */}
        {triageTier === 'emergency' && (
          <EmergencyBanner
            onCallAmbulance={() => { window.location.href = 'tel:108'; }}
            onSeeHospitals={() => {}}
          />
        )}

        {/* Triage Banner */}
        <div className={`card p-5 border-l-4 ${config.border}`}>
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-full ${config.color}`}>
              <TriageIcon size={24} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-text-primary">{t(config.key)}</h2>
              <p className="text-sm text-text-secondary mt-1">{t(config.descKey)}</p>
            </div>
          </div>
        </div>

        {/* Top probable diseases */}
        <section>
          <h3 className="font-body font-semibold text-text-primary mb-3">{t('results.possible_conditions')}</h3>
          <div className="space-y-3">
            {topDiseases.map((disease, i) => (
              <DiseaseCard key={disease.name} disease={disease} rank={i + 1} />
            ))}
          </div>
        </section>

        {/* Other possibilities */}
        {otherDiseases.length > 0 && (
          <section>
            <h3 className="font-body text-sm font-medium text-text-secondary mb-2">{t('results.other_possibilities')}</h3>
            <div className="space-y-2">
              {otherDiseases.map((disease, i) => (
                <DiseaseCard key={disease.name} disease={disease} rank={i + 4} />
              ))}
            </div>
          </section>
        )}

        {/* Hospital carousel for clinic/emergency tier */}
        {(triageTier === 'clinic' || triageTier === 'emergency') && (
          <section>
            <h3 className="font-body font-semibold text-text-primary mb-3">{t('results.nearby_clinics')}</h3>
            <HospitalCarousel hospitals={mockHospitals} />
          </section>
        )}

        {/* Disclaimer */}
        <div className="card p-4 bg-muted">
          <p className="text-xs text-text-secondary leading-relaxed">{t('results.disclaimer')}</p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3 pb-6">
          <button onClick={handleChatAgain} className="btn-primary flex items-center justify-center gap-2">
            <MessageCircle size={18} />
            {t('results.chat_again')}
          </button>
          <button onClick={handleFindClinic} className="btn-secondary flex items-center justify-center gap-2">
            <MapPin size={18} />
            {t('results.find_clinic')}
          </button>
          <button onClick={handleDownloadReport} className="btn-ghost flex items-center justify-center gap-2">
            <Download size={18} />
            {t('results.download_report')}
          </button>
        </div>
      </div>
    </div>
  );
}
