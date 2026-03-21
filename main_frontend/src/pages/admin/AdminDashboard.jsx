import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../contexts/I18nContext';
import {
  ArrowLeft, Users, Activity, AlertTriangle, Truck,
  MapPin, UserCheck, GitBranch, BarChart3, Network, X, RefreshCw,
} from 'lucide-react';
import StatCard from '../../components/admin/StatCard';
import PieChart from '../../components/admin/PieChart';
import HorizontalBarChart from '../../components/admin/HorizontalBarChart';
import ChordDiagram from '../../components/admin/ChordDiagram';
import BubbleChart from '../../components/admin/BubbleChart';
import PatientJourney from '../../components/admin/PatientJourney';
import StateHeatmap from '../../components/admin/StateHeatmap';
import ASHATable from '../../components/admin/ASHATable';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  mockAdminStats,
  mockTriageDistribution,
  mockTopSymptoms,
  mockSymptomCoOccurrence,
  mockDistrictSymptoms,
  mockPatientJourney,
  mockASHAWorkers,
  gujaratDistricts,
  mockHeatmapData,
} from '../../utils/mockData';
import { getAnalytics } from '../../utils/api';

const DATE_RANGES = ['Today', 'Week', 'Month'];

// Scale mock stats per date range to simulate real data variance
const RANGE_MULTIPLIERS = { Today: 1, Week: 6.5, Month: 28 };

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('Today');

  // Cross-chart filter state
  const [selectedTriage, setSelectedTriage] = useState(null);   // e.g. 'Emergency'
  const [selectedSymptom, setSelectedSymptom] = useState(null); // e.g. 'Fever'

  const tabs = [
    { id: 'overview', label: t('admin.tab_overview') || 'Overview' },
    { id: 'map',      label: t('admin.tab_map')      || 'Heatmap'  },
    { id: 'asha',     label: t('admin.tab_asha')     || 'ASHA Workers' },
  ];

  useEffect(() => {
    async function loadData() {
      try { setStats(await getAnalytics()); } catch { /* use defaults */ }
      finally { setLoading(false); }
    }
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 800));
    setRefreshing(false);
  };

  const mult = RANGE_MULTIPLIERS[dateRange];

  /* ── derived / filtered data ──────────────────────────────────── */
  const triagePieData = useMemo(() =>
    Object.entries(mockTriageDistribution).map(([label, value]) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      value: Math.round(value * mult),
    })), [mult]);

  const topSymptoms = useMemo(() => {
    const scaled = mockTopSymptoms.map(d => ({ ...d, count: Math.round(d.count * mult) }));
    return selectedTriage === 'Emergency'
      ? scaled.filter(d => ['Fever', 'Breathlessness', 'Body Pain'].includes(d.symptom))
      : scaled;
  }, [mult, selectedTriage]);

  const cooccurrence = useMemo(() => {
    if (!selectedSymptom) return mockSymptomCoOccurrence;
    return mockSymptomCoOccurrence.filter(
      d => d.source === selectedSymptom || d.target === selectedSymptom
    );
  }, [selectedSymptom]);

  const districtData = useMemo(() => {
    const scaled = mockDistrictSymptoms.map(d => ({ ...d, count: Math.round(d.count * mult) }));
    return selectedTriage === 'Emergency'
      ? scaled.filter(d => ['Fever', 'Breathlessness'].includes(d.symptom))
      : scaled;
  }, [mult, selectedTriage]);

  const districtCaseLookup = useMemo(() => {
    const lookup = {};
    mockHeatmapData.forEach(d => {
      lookup[d.area] = (lookup[d.area] || 0) + (d.count || 0);
    });
    return lookup;
  }, []);

  const heatmapDistricts = useMemo(() =>
    gujaratDistricts.map(d => ({
      ...d,
      cases: Math.round((districtCaseLookup[d.name] || Math.floor(Math.random() * 60 + 5)) * mult),
    })), [districtCaseLookup, mult]);

  const activeFilters = [
    selectedTriage  && { key: 'triage',  label: `Triage: ${selectedTriage}`,   clear: () => setSelectedTriage(null)  },
    selectedSymptom && { key: 'symptom', label: `Symptom: ${selectedSymptom}`,  clear: () => setSelectedSymptom(null) },
  ].filter(Boolean);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <LoadingSpinner text={t('common.loading')} />
    </div>
  );

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-surface border-b border-border px-4 py-3 flex items-center gap-3 min-h-[56px]">
        <button onClick={() => navigate('/')} className="text-text-secondary hover:text-primary transition-colors min-h-[48px] flex items-center">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-body font-semibold text-lg text-text-primary flex-1">{t('admin.title')}</h1>

        {/* Date range toggle */}
        <div className="flex gap-0.5 bg-surface-3 rounded-lg p-0.5">
          {DATE_RANGES.map(r => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                dateRange === r
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          className="p-2 rounded-lg hover:bg-surface-3 transition-colors text-text-secondary"
          title="Refresh data"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
        </button>
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
        {/* Active filter pills */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            <span className="text-xs text-text-hint self-center">Filters:</span>
            {activeFilters.map(f => (
              <span
                key={f.key}
                className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary rounded-full px-3 py-1 font-medium"
              >
                {f.label}
                <button onClick={f.clear} className="hover:opacity-70 transition-opacity">
                  <X size={12} />
                </button>
              </span>
            ))}
            {activeFilters.length > 1 && (
              <button
                onClick={() => { setSelectedTriage(null); setSelectedSymptom(null); }}
                className="text-xs text-text-secondary hover:text-danger underline"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* ── OVERVIEW TAB ───────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={Users}         label="Active Patients"     value={Math.round((stats?.totalPatients || mockAdminStats.totalActivePatients) * mult)} change={12}  color="primary" />
              <StatCard icon={AlertTriangle} label="Emergency Requests"  value={Math.round((stats?.emergencies  || mockAdminStats.emergencyRequests)   * mult)} change={-25} color="red" />
              <StatCard icon={Truck}         label="Ambulance Available" value={mockAdminStats.ambulanceAvailability}                                                 color="green" />
              <StatCard icon={Activity}      label="Avg Cases / ASHA"    value={mockAdminStats.avgCasesPerAsha}                                                       color="yellow" />
            </div>

            {/* Pie \u2014 Triage Distribution */}
            <div className="card p-5">
              <h3 className="font-semibold text-text-primary mb-1 flex items-center gap-2">
                <BarChart3 size={16} /> Triage Distribution
              </h3>
              <p className="text-xs text-text-hint mb-4">Click a slice to filter other charts by triage level</p>
              <PieChart
                data={triagePieData} labelKey="label" valueKey="value"
                selected={selectedTriage}
                onSelect={setSelectedTriage}
              />
            </div>

            {/* Horizontal Bar \u2014 Top Symptoms */}
            <div className="card p-5">
              <h3 className="font-semibold text-text-primary mb-1">Top Symptoms</h3>
              <p className="text-xs text-text-hint mb-4">Click a bar to focus the co-occurrence network</p>
              <HorizontalBarChart
                data={topSymptoms} labelKey="symptom" valueKey="count" height={280}
                selected={selectedSymptom}
                onSelect={setSelectedSymptom}
              />
            </div>

            {/* Patient Journey */}
            <div className="card p-5">
              <h3 className="font-semibold text-text-primary mb-1 flex items-center gap-2">
                <GitBranch size={16} /> Patient Journey
              </h3>
              <PatientJourney steps={mockPatientJourney} width={700} height={110} />
            </div>

            {/* Chord \u2014 Symptom Co-occurrence */}
            <div className="card p-5">
              <h3 className="font-semibold text-text-primary mb-1 flex items-center gap-2">
                <Network size={16} /> Symptom Co-occurrence Network
              </h3>
              <p className="text-xs text-text-hint mb-4">Hover an arc to isolate connections \u00b7 Hover a ribbon for pair details</p>
              <ChordDiagram data={cooccurrence} />
            </div>

            {/* Bubble \u2014 District-wise Symptoms */}
            <div className="card p-5">
              <h3 className="font-semibold text-text-primary mb-1">District-wise Symptom Distribution</h3>
              <p className="text-xs text-text-hint mb-4">Click a bubble or legend to filter by symptom</p>
              <BubbleChart
                data={districtData}
                selected={selectedSymptom}
                onSelect={setSelectedSymptom}
              />
            </div>
          </div>
        )}

        {/* ── MAP TAB ────────────────────────────────────────────── */}
        {activeTab === 'map' && (
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="font-semibold text-text-primary mb-1 flex items-center gap-2">
                <MapPin size={16} /> Gujarat \u2014 District Heatmap
              </h3>
              <p className="text-xs text-text-hint mb-3">Click a district to see case details</p>
              <StateHeatmap districtData={heatmapDistricts} height={460} />
            </div>
          </div>
        )}

        {/* ── ASHA TAB ───────────────────────────────────────────── */}
        {activeTab === 'asha' && (
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                <UserCheck size={16} /> ASHA Workers
              </h3>
              <ASHATable data={mockASHAWorkers} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
