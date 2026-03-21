import { useState } from 'react';
import { useTranslation } from '../../contexts/I18nContext';
import { ChevronDown, ChevronUp, Eye } from 'lucide-react';

export default function ASHATable({ data }) {
  const { t } = useTranslation();
  const [expandedRow, setExpandedRow] = useState(null);

  function toggleRow(id) {
    setExpandedRow(prev => prev === id ? null : id);
  }

  if (!data || data.length === 0) {
    return <p className="text-text-secondary text-sm">{t('admin.no_asha_data')}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-2 px-3 text-text-secondary font-medium">{t('admin.asha_name')}</th>
            <th className="py-2 px-3 text-text-secondary font-medium">{t('admin.asha_area')}</th>
            <th className="py-2 px-3 text-text-secondary font-medium text-center">{t('admin.asha_patients')}</th>
            <th className="py-2 px-3 text-text-secondary font-medium text-center">{t('admin.asha_actions')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map(worker => (
            <>
              <tr key={worker.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                <td className="py-3 px-3 text-text-primary font-medium">{worker.name}</td>
                <td className="py-3 px-3 text-text-secondary">{worker.area}</td>
                <td className="py-3 px-3 text-center text-text-primary">{worker.patientList?.length || 0}</td>
                <td className="py-3 px-3 text-center">
                  <button
                    onClick={() => toggleRow(worker.id)}
                    className="inline-flex items-center gap-1 text-primary hover:text-primary-hover text-xs min-h-[36px]"
                  >
                    <Eye size={14} />
                    {expandedRow === worker.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </td>
              </tr>
              {expandedRow === worker.id && worker.patientList && (
                <tr key={`${worker.id}-exp`}>
                  <td colSpan={4} className="px-3 py-3 bg-muted/30">
                    <div className="space-y-2">
                      {worker.patientList.map((patient, i) => (
                        <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5 bg-surface rounded">
                          <span className="text-text-primary">{patient.name}</span>
                          <span className="text-text-secondary">{patient.condition || patient.symptoms}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            patient.status === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                            : patient.status === 'stable' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                          }`}>
                            {patient.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
