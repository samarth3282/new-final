import { createContext, useContext, useReducer } from 'react';

const initialState = {
  role: null,
  profile: {
    preferredName: '',
    ageVerified: false,
    country: 'India',
    age: null,
    heightCm: null,
    heightFt: null,
    heightIn: null,
    weightKg: null,
    weightLb: null,
    gender: null,
    unitSystem: 'metric',
  },
  chatHistory: [],
  symptomData: {
    symptoms: [],
    symptom_severity: null,
    symptom_count: 0,
    duration: null,
    patient_age_risk: null,
    comorbidity_flag: null,
    comorbidities: '',
  },
  diagnosisResult: null,
};

function userReducer(state, action) {
  switch (action.type) {
    case 'SET_ROLE':
      return { ...state, role: action.payload };
    // Sync role (and optionally profile) from the authenticated user object
    case 'LOAD_AUTH_USER': {
      const authUser = action.payload;
      return {
        ...state,
        role: authUser?.role ?? state.role,
        profile: {
          ...state.profile,
          preferredName: authUser?.firstName || authUser?.username || state.profile.preferredName,
          gender: authUser?.gender || state.profile.gender,
        },
      };
    }
    case 'UPDATE_PROFILE':
      return { ...state, profile: { ...state.profile, ...action.payload } };
    case 'ADD_CHAT_MESSAGE':
      return { ...state, chatHistory: [...state.chatHistory, action.payload] };
    case 'CLEAR_CHAT':
      return { ...state, chatHistory: [], symptomData: initialState.symptomData, diagnosisResult: null };
    case 'UPDATE_SYMPTOM_DATA':
      return { ...state, symptomData: { ...state.symptomData, ...action.payload } };
    case 'SET_DIAGNOSIS':
      return { ...state, diagnosisResult: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const UserContext = createContext();

export function UserProvider({ children }) {
  const [state, dispatch] = useReducer(userReducer, initialState);

  return (
    <UserContext.Provider value={{ state, dispatch }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
