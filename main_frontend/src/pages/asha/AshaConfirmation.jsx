import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../../contexts/I18nContext';
import { CheckCircle, ArrowLeft, ClipboardList, UserCheck } from 'lucide-react';

export default function AshaConfirmation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const report = location.state?.report;

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-surface border-b border-border px-4 py-3 flex items-center gap-3 min-h-[56px]">
        <button onClick={() => navigate('/asha/form')} className="text-text-secondary hover:text-primary transition-colors min-h-[48px] flex items-center">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-body font-semibold text-lg text-text-primary">{t('asha.confirmation_title')}</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto px-4 py-8">
        {/* Success icon */}
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-6 animate-bounceIn">
          <CheckCircle size={40} className="text-green-600 dark:text-green-400" />
        </div>

        <h2 className="text-xl font-semibold text-text-primary text-center mb-2">
          {t('asha.report_submitted')}
        </h2>
        <p className="text-text-secondary text-center mb-8">
          {t('asha.report_submitted_desc')}
        </p>

        {/* Report summary */}
        {report && (
          <div className="card p-5 w-full space-y-3 mb-8">
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              <ClipboardList size={16} />
              {t('asha.report_summary')}
            </h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">{t('asha.patient_name')}</span>
                <span className="text-text-primary font-medium">{report.patientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">{t('asha.age')}</span>
                <span className="text-text-primary font-medium">{report.age}</span>
              </div>
              {report.gender && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">{t('asha.gender')}</span>
                  <span className="text-text-primary font-medium">{report.gender}</span>
                </div>
              )}
              {report.village && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">{t('asha.village')}</span>
                  <span className="text-text-primary font-medium">{report.village}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-text-secondary">{t('asha.symptoms_section')}</span>
                <span className="text-text-primary font-medium text-right max-w-[60%]">{report.symptoms.join(', ')}</span>
              </div>
              {report.temperature && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">{t('asha.temperature')}</span>
                  <span className="text-text-primary font-medium">{report.temperature}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 w-full">
          <button onClick={() => navigate('/asha/form')} className="btn-primary flex items-center justify-center gap-2">
            <UserCheck size={18} />
            {t('asha.new_report')}
          </button>
          <button onClick={() => navigate('/')} className="btn-ghost">
            {t('common.back')}
          </button>
        </div>
      </div>
    </div>
  );
}
