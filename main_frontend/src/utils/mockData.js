export const mockHospitals = [
  { id: 1, name: "Civil Hospital Ahmedabad", lat: 23.0395, lng: 72.5799, distance: "0.8 km", phone: "079-22681234", hours: "24/7 Emergency", type: "government", address: "Near Asarwa, Ahmedabad" },
  { id: 2, name: "Sola Civil Hospital", lat: 23.0892, lng: 72.5987, distance: "2.1 km", phone: "079-23270531", hours: "24/7 Emergency", type: "government", address: "Sola Road, Ahmedabad" },
  { id: 3, name: "VS Hospital", lat: 23.0173, lng: 72.5803, distance: "3.4 km", phone: "079-26300000", hours: "24/7 Emergency", type: "government", address: "Near Ellis Bridge, Ahmedabad" },
  { id: 4, name: "LG Hospital", lat: 23.0258, lng: 72.5874, distance: "1.5 km", phone: "079-25502123", hours: "24/7 Emergency", type: "government", address: "Maninagar, Ahmedabad" },
  { id: 5, name: "SVP Hospital", lat: 23.0350, lng: 72.5650, distance: "4.2 km", phone: "079-25507341", hours: "24/7 Emergency", type: "government", address: "Ellisbridge, Ahmedabad" },
];

export const mockHeatmapData = [
  { lat: 23.045, lng: 72.570, count: 12, type: "emergency", area: "Naranpura" },
  { lat: 23.030, lng: 72.580, count: 8, type: "moderate", area: "Maninagar" },
  { lat: 23.060, lng: 72.595, count: 22, type: "selfcare", area: "Bopal" },
  { lat: 23.020, lng: 72.560, count: 5, type: "emergency", area: "Ellisbridge" },
  { lat: 23.075, lng: 72.540, count: 15, type: "moderate", area: "Thaltej" },
  { lat: 23.010, lng: 72.600, count: 30, type: "selfcare", area: "Vatva" },
  { lat: 23.055, lng: 72.555, count: 3, type: "emergency", area: "Paldi" },
  { lat: 23.085, lng: 72.575, count: 18, type: "moderate", area: "Gota" },
  { lat: 23.040, lng: 72.610, count: 25, type: "selfcare", area: "Nikol" },
  { lat: 23.025, lng: 72.545, count: 7, type: "emergency", area: "Navrangpura" },
  { lat: 23.095, lng: 72.560, count: 11, type: "moderate", area: "Chandkheda" },
  { lat: 23.050, lng: 72.620, count: 19, type: "selfcare", area: "Naroda" },
  { lat: 23.035, lng: 72.530, count: 4, type: "emergency", area: "Ashram Road" },
  { lat: 23.070, lng: 72.585, count: 14, type: "moderate", area: "Satellite" },
  { lat: 23.015, lng: 72.575, count: 28, type: "selfcare", area: "Kankaria" },
  { lat: 23.080, lng: 72.610, count: 6, type: "emergency", area: "Vastral" },
  { lat: 23.065, lng: 72.550, count: 9, type: "moderate", area: "SG Highway" },
  { lat: 23.045, lng: 72.590, count: 20, type: "selfcare", area: "Sabarmati" },
];

export const mockTrendData = {
  labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"],
  emergency: [4, 7, 3, 9, 5, 8, 12],
  clinic: [28, 35, 22, 41, 30, 38, 44],
  selfcare: [62, 78, 55, 89, 71, 82, 95],
};

export const mockDiseaseCategories = [
  { category: "ENT", count: 45 },
  { category: "Cardiac", count: 18 },
  { category: "Fever", count: 67 },
  { category: "Respiratory", count: 34 },
  { category: "GI", count: 28 },
  { category: "Skin", count: 21 },
  { category: "Other", count: 15 },
];

export const mockASHAWorkers = [
  { id: 1, name: "Meena Patel", patients: 14, areas: ["Naranpura"], lastActive: "2 hours ago", patientList: [{ name: "Ramesh K.", condition: "Fever", status: "clinic" }, { name: "Priya S.", condition: "Cold", status: "self-care" }] },
  { id: 2, name: "Sunita Devi", patients: 8, areas: ["Vatva"], lastActive: "5 hours ago", patientList: [{ name: "Arjun M.", condition: "Chest pain", status: "emergency" }] },
  { id: 3, name: "Lakshmi Rao", patients: 22, areas: ["Bopal"], lastActive: "1 hour ago", patientList: [{ name: "Anjali D.", condition: "Skin rash", status: "clinic" }, { name: "Vijay R.", condition: "Headache", status: "self-care" }] },
  { id: 4, name: "Kamala Devi", patients: 11, areas: ["Maninagar"], lastActive: "3 hours ago", patientList: [] },
  { id: 5, name: "Geeta Sharma", patients: 19, areas: ["Thaltej", "Satellite"], lastActive: "30 mins ago", patientList: [{ name: "Suresh B.", condition: "Dengue", status: "emergency" }] },
];

export const mockDiagnosisResult = {
  triage_tier: "clinic",
  diseases: [
    { rank: 1, title: "Viral Fever", description: "A common viral infection causing fever, body ache, and fatigue. Usually resolves in 5–7 days with rest, hydration, and paracetamol." },
    { rank: 2, title: "Dengue Fever", description: "A mosquito-borne illness with high fever, severe headache, and joint pain. Requires medical supervision and platelet monitoring." },
    { rank: 3, title: "Malaria", description: "A parasitic infection spread by mosquitoes, common in monsoon season. Needs immediate blood test and antimalarial treatment." },
    { rank: 4, title: "Typhoid", description: "Bacterial infection causing prolonged fever, abdominal discomfort, and weakness. Treated with antibiotics." },
    { rank: 5, title: "Chikungunya", description: "Viral disease causing fever and severe joint pain, spread by Aedes mosquitoes." },
  ],
  immediate_steps: [
    "Rest and drink plenty of fluids (ORS, coconut water)",
    "Take paracetamol for fever (do not take ibuprofen without doctor advice)",
    "Visit your nearest PHC if fever persists beyond 3 days",
  ],
  confidence: 0.78,
};

export const mockTriageDistribution = {
  emergency: 24,
  clinic: 156,
  selfcare: 312,
};

// ── Admin Dashboard — additional data ─────────────────────────────────────────

export const mockAdminStats = {
  totalActivePatients: 247,
  emergencyRequests: 3,
  ambulanceAvailability: 8,
  avgCasesPerAsha: 14.2,
};

export const mockTopSymptoms = [
  { symptom: 'Fever', count: 67 },
  { symptom: 'Cough', count: 52 },
  { symptom: 'Headache', count: 48 },
  { symptom: 'Body Pain', count: 41 },
  { symptom: 'Diarrhea', count: 34 },
  { symptom: 'Breathlessness', count: 28 },
  { symptom: 'Skin Rash', count: 21 },
  { symptom: 'Fatigue', count: 19 },
];

export const mockSymptomCoOccurrence = [
  { source: 'Fever', target: 'Headache', value: 38 },
  { source: 'Fever', target: 'Body Pain', value: 32 },
  { source: 'Fever', target: 'Cough', value: 29 },
  { source: 'Cough', target: 'Breathlessness', value: 24 },
  { source: 'Headache', target: 'Fatigue', value: 18 },
  { source: 'Diarrhea', target: 'Fatigue', value: 15 },
  { source: 'Body Pain', target: 'Fatigue', value: 22 },
  { source: 'Skin Rash', target: 'Fever', value: 11 },
  { source: 'Breathlessness', target: 'Fatigue', value: 13 },
  { source: 'Cough', target: 'Headache', value: 17 },
  { source: 'Diarrhea', target: 'Fever', value: 20 },
];

export const mockDistrictSymptoms = [
  { district: 'Ahmedabad', symptom: 'Fever', count: 42 },
  { district: 'Ahmedabad', symptom: 'Cough', count: 28 },
  { district: 'Gandhinagar', symptom: 'Fever', count: 18 },
  { district: 'Gandhinagar', symptom: 'Diarrhea', count: 25 },
  { district: 'Surat', symptom: 'Skin Rash', count: 31 },
  { district: 'Surat', symptom: 'Fever', count: 36 },
  { district: 'Vadodara', symptom: 'Headache', count: 22 },
  { district: 'Vadodara', symptom: 'Cough', count: 19 },
  { district: 'Rajkot', symptom: 'Body Pain', count: 27 },
  { district: 'Rajkot', symptom: 'Fever', count: 33 },
  { district: 'Bhavnagar', symptom: 'Fatigue', count: 14 },
  { district: 'Bhavnagar', symptom: 'Breathlessness', count: 11 },
];

export const mockPatientJourney = [
  { id: 'symptom', label: 'Symptom Entry', desc: 'Patient enters symptoms via chatbot' },
  { id: 'triage', label: 'AI Triage', desc: 'Model classifies severity' },
  { id: 'diagnosis', label: 'Diagnosis', desc: 'Top 5 possible conditions shown' },
  { id: 'action', label: 'Action Plan', desc: 'Immediate steps & hospital referral' },
  { id: 'followup', label: 'Follow-up', desc: 'ASHA worker reviews & tracks' },
];

// Gujarat state — districts with approximate centroids for the heatmap
export const gujaratDistricts = [
  { name: 'Ahmedabad', lat: 23.02, lng: 72.57 },
  { name: 'Gandhinagar', lat: 23.22, lng: 72.68 },
  { name: 'Surat', lat: 21.17, lng: 72.83 },
  { name: 'Vadodara', lat: 22.30, lng: 73.19 },
  { name: 'Rajkot', lat: 22.30, lng: 70.80 },
  { name: 'Bhavnagar', lat: 21.76, lng: 72.15 },
  { name: 'Jamnagar', lat: 22.47, lng: 70.07 },
  { name: 'Junagadh', lat: 21.52, lng: 70.46 },
  { name: 'Anand', lat: 22.56, lng: 72.96 },
  { name: 'Mehsana', lat: 23.59, lng: 72.38 },
];

export const EMERGENCY_KEYWORDS = [
  'chest pain', 'heart attack', 'unconscious', 'seizure', 'stroke',
  'not breathing', 'severe bleeding', 'paralysis', 'suicide',
  'poisoning', 'burn', 'accident', 'fracture',
  'सीने में दर्द', 'बेहोश', 'दौरा', 'साँस नहीं',
];
