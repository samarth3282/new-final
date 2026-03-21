import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../contexts/I18nContext';
import { ArrowLeft, Users, Activity, AlertTriangle, TrendingUp, MapPin, UserCheck } from 'lucide-react';
import StatCard from '../../components/admin/StatCard';
import LineChart from '../../components/admin/LineChart';
import BarChart from '../../components/admin/BarChart';
import DonutChart from '../../components/admin/DonutChart';
import HeatmapLeaflet from '../../components/admin/HeatmapLeaflet';
import ASHATable from '../../components/admin/ASHATable';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  mockTrendData,
  mockHeatmapData,
  mockTriageDistribution,
  mockASHAWorkers,
  mockDiseaseCategories,
} from '../../utils/mockData';
import { getAnalytics } from '../../utils/api';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getAnalytics();
        setStats(data);
      } catch {
        // Use defaults
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const tabs = [
    { id: 'overview', label: t('admin.tab_overview') },
    { id: 'map', label: t('admin.tab_map') },
    { id: 'asha', label: t('admin.tab_asha') },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <LoadingSpinner text={t('common.loading')} />
      </div>
    );
  }

  const trendLineData = mockTrendData.labels.map((label, i) => ({
    date: label,
    count: (mockTrendData.emergency[i] || 0) + (mockTrendData.clinic[i] || 0) + (mockTrendData.selfcare[i] || 0),
  }));

  const triageBarData = Object.entries(mockTriageDistribution).map(([tier, count]) => ({
    label: tier,
    value: count,
  }));

  const diseaseBarData = mockDiseaseCategories.map(d => ({
    label: d.category.length > 10 ? d.category.slice(0, 10) + '…' : d.category,
    value: d.count,
  }));

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-surface border-b border-border px-4 py-3 flex items-center gap-3 min-h-[56px]">
        <button onClick={() => navigate('/')} className="text-text-secondary hover:text-primary transition-colors min-h-[48px] flex items-center">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-body font-semibold text-lg text-text-primary">{t('admin.title')}</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-surface sticky top-[56px] z-30">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-primary border-b-2 border-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={Users}
                label={t('admin.total_patients')}
                value={stats?.totalPatients || 247}
                change={12}
                color="primary"
              />
              <StatCard
                icon={Activity}
                label={t('admin.triages_today')}
                value={stats?.triagesToday || 34}
                change={8}
                color="green"
              />
              <StatCard
                icon={AlertTriangle}
                label={t('admin.emergencies')}
                value={stats?.emergencies || 3}
                change={-25}
                color="red"
              />
              <StatCard
                icon={TrendingUp}
                label={t('admin.avg_severity')}
                value={stats?.avgSeverity || '2.4'}
                color="yellow"
              />
            </div>

            {/* Trend Chart */}
            <div className="card p-5">
              <h3 className="font-semibold text-text-primary mb-4">{t('admin.weekly_trend')}</h3>
              <LineChart data={trendLineData} width={360} height={200} />
            </div>

            {/* Triage Distribution */}
            <div className="card p-5">
              <h3 className="font-semibold text-text-primary mb-4">{t('admin.triage_distribution')}</h3>
              <DonutChart data={triageBarData} labelKey="label" valueKey="value" />
            </div>

            {/* Disease Categories */}
            <div className="card p-5">
              <h3 className="font-semibold text-text-primary mb-4">{t('admin.disease_categories')}</h3>
              <BarChart data={diseaseBarData} width={360} height={220} />
            </div>
          </div>
        )}

        {activeTab === 'map' && (
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                <MapPin size={16} />
                {t('admin.disease_heatmap')}
              </h3>
              <HeatmapLeaflet data={mockHeatmapData} />
            </div>
          </div>
        )}

        {activeTab === 'asha' && (
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                <UserCheck size={16} />
                {t('admin.asha_workers')}
              </h3>
              <ASHATable data={mockASHAWorkers} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
