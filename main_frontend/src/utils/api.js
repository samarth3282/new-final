import { mockDiagnosisResult, mockHospitals } from './mockData';

const MOCK_DELAY = 1500;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function postTriage(data) {
  await delay(MOCK_DELAY);
  return mockDiagnosisResult;
}

export async function getFacilities({ lat, lng, tier }) {
  await delay(800);
  return { facilities: mockHospitals };
}

export async function postAshaReport(data) {
  await delay(1000);
  const date = new Date();
  const refId = `AW-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
  return { referenceId: refId, status: 'submitted' };
}

export async function getAnalytics({ from, to, district }) {
  await delay(800);
  return {
    counters: { emergency: 24, clinic: 156, selfcare: 312, ashaActive: 18 },
  };
}
