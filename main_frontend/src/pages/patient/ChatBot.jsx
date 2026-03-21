import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../contexts/I18nContext';
import { useUser } from '../../contexts/UserContext';
import { useToast } from '../../components/Toast';
import ChatMessage from '../../components/ChatMessage';
import ChatInput from '../../components/ChatInput';
import EmergencyBanner from '../../components/EmergencyBanner';
import HospitalCarousel from '../../components/HospitalCarousel';
import LoadingSpinner from '../../components/LoadingSpinner';
import { ArrowLeft, Settings } from 'lucide-react';
import { mockHospitals, mockDiagnosisResult, EMERGENCY_KEYWORDS } from '../../utils/mockData';
import { postTriage } from '../../utils/api';
import { generateReport } from '../../utils/reportGenerator';
import { sendChatMessage } from '../../utils/chatbotService';
import { SARVAM_LANG_CODES, translateToEnglish, translateFromEnglish, textToSpeech, playAudio } from '../../utils/voiceUtils';

const QUESTION_FLOW = [
  'severity',
  'additional_symptoms',
  'duration',
  'age_risk',
  'comorbidity',
];

export default function ChatBot() {
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const { state, dispatch } = useUser();
  const { addToast } = useToast();
  const [messages, setMessages] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(-1);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [showHospitals, setShowHospitals] = useState(false);
  const [symptomCollected, setSymptomCollected] = useState(false);
  const [chatMode, setChatMode] = useState('text'); // 'text' | 'voice'
  const [isSpeaking, setIsSpeaking] = useState(false);
  const chatModeRef = useRef('text');
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const symptomDataRef = useRef({
    symptoms: [],
    symptom_severity: null,
    symptom_count: 1,
    duration: null,
    patient_age_risk: null,
    comorbidity_flag: null,
    comorbidities: '',
  });

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  // Keep chatModeRef in sync with state
  useEffect(() => { chatModeRef.current = chatMode; }, [chatMode]);

  /**
   * Speaks a bot message via TTS if currently in voice mode.
   * Non-blocking — sets isSpeaking while audio plays.
   */
  async function speakIfVoiceMode(text) {
    if (chatModeRef.current !== 'voice') return;
    const langCode = SARVAM_LANG_CODES[lang] || 'hi-IN';
    setIsSpeaking(true);
    try {
      const audioBlob = await textToSpeech(text, langCode);
      await playAudio(audioBlob);
    } catch (err) {
      console.error('TTS failed:', err);
    } finally {
      setIsSpeaking(false);
    }
  }

  // Initial greeting
  useEffect(() => {
    const name = state.profile.preferredName ? ` ${state.profile.preferredName}` : '';
    const greeting = t('chatbot.greeting').replace('{name}', name);
    addBotMessage(greeting);
  }, []);

  function addBotMessage(text, options = null, extra = {}) {
    const msg = {
      id: Date.now() + Math.random(),
      sender: 'bot',
      text,
      options,
      answered: false,
      selectedOption: null,
      showSkip: extra.showSkip ?? false,
      orText: t('chatbot.or_type'),
      skipText: t('chatbot.skip_question'),
      onSkip: extra.onSkip,
      component: extra.component,
      ...extra,
    };
    setMessages(prev => [...prev, msg]);
    scrollToBottom();
    return msg;
  }

  function addUserMessage(text) {
    setMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      sender: 'user',
      text,
    }]);
    scrollToBottom();
  }

  function addTypingIndicator() {
    const id = Date.now() + Math.random();
    setMessages(prev => [...prev, { id, type: 'typing', sender: 'bot' }]);
    scrollToBottom();
    return id;
  }

  function removeTypingIndicator(id) {
    setMessages(prev => prev.filter(m => m.id !== id));
  }

  function markAnswered(msgId, selectedOption) {
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, answered: true, selectedOption } : m
    ));
  }

  function checkEmergencyKeywords(text) {
    const lower = text.toLowerCase();
    return EMERGENCY_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
  }

  /**
   * Helper: translate server English response to UI language for display + TTS.
   */
  async function translateServerResponse(englishText) {
    if (lang === 'en') return englishText;
    try {
      const langCode = SARVAM_LANG_CODES[lang] || 'hi-IN';
      return await translateFromEnglish(englishText, langCode);
    } catch (err) {
      console.error('Server response translation failed:', err);
      return englishText;
    }
  }

  /**
   * Text mode handler.
   * - Displays user's text as-is (in whatever language they typed)
   * - Translates to English for symptomData (server always gets English)
   */
  async function handleUserSend({ text }) {
    if (!text) return;
    addUserMessage(text);

    if (checkEmergencyKeywords(text)) {
      setShowEmergency(true);
    }

    // Translate to English for server
    let englishText = text;
    if (lang !== 'en') {
      try {
        const langCode = SARVAM_LANG_CODES[lang] || 'hi-IN';
        englishText = await translateToEnglish(text, langCode);
      } catch (err) {
        console.error('Translation failed, using original:', err);
      }
    }

    if (!symptomCollected) {
      symptomDataRef.current.symptoms.push(englishText);
      setSymptomCollected(true);
      setTimeout(() => askNextQuestion(0), 800);
    } else if (currentQuestion === 1) {
      symptomDataRef.current.symptoms.push(englishText);
      symptomDataRef.current.symptom_count = symptomDataRef.current.symptoms.length;
      setQuestionsAnswered(prev => prev + 1);
      setTimeout(() => askNextQuestion(currentQuestion + 1), 800);
    } else if (currentQuestion === 4 && symptomDataRef.current.comorbidity_flag === true) {
      symptomDataRef.current.comorbidities = englishText;
      setQuestionsAnswered(prev => prev + 1);
    } else {
      setQuestionsAnswered(prev => prev + 1);
      setTimeout(() => askNextQuestion(currentQuestion + 1), 800);
    }
  }

  /**
   * Voice mode handler: user spoke → STT (originalText in selected lang) → translated English.
   * - Shows originalText in chat (user's selected language)
   * - Stores englishText in symptomData (server always gets English)
   * - Continues the question flow, speaking bot questions aloud
   */
  function handleVoiceMessage(englishText, originalText, langCode) {
    if (!englishText) return;

    // Display user message in their selected language
    addUserMessage(originalText);

    if (checkEmergencyKeywords(englishText)) {
      setShowEmergency(true);
    }

    // Store English in symptomData (server always receives English)
    if (!symptomCollected) {
      symptomDataRef.current.symptoms.push(englishText);
      setSymptomCollected(true);
      setTimeout(() => askNextQuestion(0), 800);
    } else if (currentQuestion === 1) {
      symptomDataRef.current.symptoms.push(englishText);
      symptomDataRef.current.symptom_count = symptomDataRef.current.symptoms.length;
      setQuestionsAnswered(prev => prev + 1);
      setTimeout(() => askNextQuestion(currentQuestion + 1), 800);
    } else if (currentQuestion === 4 && symptomDataRef.current.comorbidity_flag === true) {
      symptomDataRef.current.comorbidities = englishText;
      setQuestionsAnswered(prev => prev + 1);
    } else {
      setQuestionsAnswered(prev => prev + 1);
      setTimeout(() => askNextQuestion(currentQuestion + 1), 800);
    }
  }

  function askNextQuestion(qIndex) {
    if (qIndex >= QUESTION_FLOW.length) return;
    setCurrentQuestion(qIndex);

    // Skip age_risk if we already have age from onboarding
    if (QUESTION_FLOW[qIndex] === 'age_risk' && state.profile.age) {
      askNextQuestion(qIndex + 1);
      return;
    }

    const typingId = addTypingIndicator();

    setTimeout(() => {
      removeTypingIndicator(typingId);

      switch (QUESTION_FLOW[qIndex]) {
        case 'severity':
          askSeverity(qIndex);
          break;
        case 'additional_symptoms':
          askAdditionalSymptoms(qIndex);
          break;
        case 'duration':
          askDuration(qIndex);
          break;
        case 'age_risk':
          askAgeRisk(qIndex);
          break;
        case 'comorbidity':
          askComorbidity(qIndex);
          break;
      }
    }, 1000);
  }

  function askSeverity(qIndex) {
    const msgId = Date.now() + Math.random();
    const questionText = t('chatbot.severity_question');
    const options = [
      { label: t('chatbot.severity_mild'), onClick: () => handleOptionSelect(msgId, 'mild', t('chatbot.severity_mild'), qIndex, 'symptom_severity') },
      { label: t('chatbot.severity_moderate'), onClick: () => handleOptionSelect(msgId, 'moderate', t('chatbot.severity_moderate'), qIndex, 'symptom_severity') },
      { label: t('chatbot.severity_severe'), onClick: () => handleOptionSelect(msgId, 'severe', t('chatbot.severity_severe'), qIndex, 'symptom_severity') },
    ];
    setMessages(prev => [...prev, {
      id: msgId, sender: 'bot', text: questionText, options, answered: false, selectedOption: null,
      showSkip: true, orText: t('chatbot.or_type'), skipText: t('chatbot.skip_question'),
      onSkip: () => handleSkip(msgId, qIndex),
    }]);
    scrollToBottom();
    speakIfVoiceMode(questionText);
  }

  function askAdditionalSymptoms(qIndex) {
    const msgId = Date.now() + Math.random();
    const questionText = t('chatbot.additional_symptoms');
    const options = [
      { label: t('chatbot.no_more_symptoms'), onClick: () => { markAnswered(msgId, t('chatbot.no_more_symptoms')); addUserMessage(t('chatbot.no_more_symptoms')); setQuestionsAnswered(prev => prev + 1); setTimeout(() => askNextQuestion(qIndex + 1), 800); } },
    ];
    setMessages(prev => [...prev, {
      id: msgId, sender: 'bot', text: questionText, options, answered: false, selectedOption: null,
      showSkip: true, orText: t('chatbot.or_type'), skipText: t('chatbot.skip_question'),
      onSkip: () => handleSkip(msgId, qIndex),
    }]);
    scrollToBottom();
    speakIfVoiceMode(questionText);
  }

  function askDuration(qIndex) {
    const msgId = Date.now() + Math.random();
    const questionText = t('chatbot.duration_question');
    const options = [
      { label: t('chatbot.duration_today'), onClick: () => handleOptionSelect(msgId, 'today', t('chatbot.duration_today'), qIndex, 'duration') },
      { label: t('chatbot.duration_2_3_days'), onClick: () => handleOptionSelect(msgId, '2-3 days', t('chatbot.duration_2_3_days'), qIndex, 'duration') },
      { label: t('chatbot.duration_week'), onClick: () => handleOptionSelect(msgId, 'a week', t('chatbot.duration_week'), qIndex, 'duration') },
      { label: t('chatbot.duration_more_week'), onClick: () => handleOptionSelect(msgId, 'more than a week', t('chatbot.duration_more_week'), qIndex, 'duration') },
    ];
    setMessages(prev => [...prev, {
      id: msgId, sender: 'bot', text: questionText, options, answered: false, selectedOption: null,
      showSkip: true, orText: t('chatbot.or_type'), skipText: t('chatbot.skip_question'),
      onSkip: () => handleSkip(msgId, qIndex),
    }]);
    scrollToBottom();
    speakIfVoiceMode(questionText);
  }

  function askAgeRisk(qIndex) {
    const msgId = Date.now() + Math.random();
    const questionText = t('chatbot.age_risk_question');
    const options = [
      { label: t('chatbot.age_under_18'), onClick: () => handleOptionSelect(msgId, 'under_18', t('chatbot.age_under_18'), qIndex, 'patient_age_risk') },
      { label: t('chatbot.age_18_40'), onClick: () => handleOptionSelect(msgId, '18-40', t('chatbot.age_18_40'), qIndex, 'patient_age_risk') },
      { label: t('chatbot.age_41_60'), onClick: () => handleOptionSelect(msgId, '41-60', t('chatbot.age_41_60'), qIndex, 'patient_age_risk') },
      { label: t('chatbot.age_over_60'), onClick: () => handleOptionSelect(msgId, 'over_60', t('chatbot.age_over_60'), qIndex, 'patient_age_risk') },
    ];
    setMessages(prev => [...prev, {
      id: msgId, sender: 'bot', text: questionText, options, answered: false, selectedOption: null,
      showSkip: true, orText: t('chatbot.or_type'), skipText: t('chatbot.skip_question'),
      onSkip: () => handleSkip(msgId, qIndex),
    }]);
    scrollToBottom();
    speakIfVoiceMode(questionText);
  }

  function askComorbidity(qIndex) {
    const msgId = Date.now() + Math.random();
    const questionText = t('chatbot.comorbidity_question');
    const options = [
      { label: t('chatbot.comorbidity_yes'), onClick: () => handleComorbidityYes(msgId, qIndex) },
      { label: t('chatbot.comorbidity_no'), onClick: () => handleOptionSelect(msgId, false, t('chatbot.comorbidity_no'), qIndex, 'comorbidity_flag') },
      { label: t('chatbot.comorbidity_not_sure'), onClick: () => handleOptionSelect(msgId, null, t('chatbot.comorbidity_not_sure'), qIndex, 'comorbidity_flag') },
    ];
    setMessages(prev => [...prev, {
      id: msgId, sender: 'bot', text: questionText, options, answered: false, selectedOption: null,
      showSkip: true, orText: t('chatbot.or_type'), skipText: t('chatbot.skip_question'),
      onSkip: () => handleSkip(msgId, qIndex),
    }]);
    scrollToBottom();
    speakIfVoiceMode(questionText);
  }

  function handleComorbidityYes(msgId, qIndex) {
    markAnswered(msgId, t('chatbot.comorbidity_yes'));
    addUserMessage(t('chatbot.comorbidity_yes'));
    symptomDataRef.current.comorbidity_flag = true;
    setQuestionsAnswered(prev => prev + 1);

    setTimeout(() => {
      const whichText = t('chatbot.comorbidity_which');
      addBotMessage(whichText);
      speakIfVoiceMode(whichText);
    }, 800);
  }

  function handleOptionSelect(msgId, value, label, qIndex, field) {
    markAnswered(msgId, label);
    addUserMessage(label);
    if (field) symptomDataRef.current[field] = value;
    setQuestionsAnswered(prev => prev + 1);
    setTimeout(() => askNextQuestion(qIndex + 1), 800);
  }

  function handleSkip(msgId, qIndex) {
    markAnswered(msgId, 'skipped');
    setQuestionsAnswered(prev => prev + 1);
    setTimeout(() => askNextQuestion(qIndex + 1), 400);
  }

  async function handleDiagnose() {
    setIsAnalysing(true);
    const typingId = addTypingIndicator();

    try {
      const result = await postTriage({
        ...symptomDataRef.current,
        patient_age: state.profile.age,
        patient_gender: state.profile.gender,
      });

      removeTypingIndicator(typingId);
      dispatch({ type: 'SET_DIAGNOSIS', payload: result });

      if (result.triage_tier === 'emergency') {
        setShowEmergency(true);
      }

      navigate('/patient/result');
    } catch {
      removeTypingIndicator(typingId);
      addToast(t('common.error'), 'error');
      setIsAnalysing(false);
    }
  }

  function handleCallAmbulance() {
    window.location.href = 'tel:108';
  }

  function handleBookAmbulance(hospital) {
    generateReport({
      userProfile: state.profile,
      chatSummary: symptomDataRef.current.symptoms.join(', '),
      triageTier: 'emergency',
      hospitalSelected: hospital,
    });
    addToast(t('hospitals.report_sent').replace('{hospital}', hospital.name), 'success');
  }

  return (
    <div className="h-screen flex flex-col bg-surface">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-surface border-b border-border px-4 py-3 flex items-center justify-between min-h-[56px]">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-text-secondary hover:text-primary transition-colors min-h-[48px]">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-body font-semibold text-lg text-text-primary">{t('chatbot.title')}</h1>
        <button className="text-text-secondary min-h-[48px] min-w-[48px] flex items-center justify-center">
          <Settings size={20} />
        </button>
      </div>

      {/* Emergency banner */}
      {showEmergency && (
        <div className="px-4 pt-4">
          <EmergencyBanner
            onCallAmbulance={handleCallAmbulance}
            onSeeHospitals={() => setShowHospitals(!showHospitals)}
          />
          {showHospitals && (
            <div className="mb-4">
              <HospitalCarousel
                hospitals={mockHospitals}
                onBookAmbulance={handleBookAmbulance}
              />
            </div>
          )}
        </div>
      )}

      {/* Chat messages area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {isAnalysing && (
          <LoadingSpinner text={t('chatbot.analysing')} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Diagnose Now button */}
      {questionsAnswered >= 1 && !isAnalysing && (
        <div className="sticky bottom-[72px] flex justify-end px-4 pb-2 z-30">
          <button
            onClick={handleDiagnose}
            className="btn-secondary flex items-center gap-2 shadow-elevated"
          >
            {t('chatbot.diagnose_now')}
          </button>
        </div>
      )}

      {/* Chat input */}
      <ChatInput
        onSend={handleUserSend}
        onVoiceMessage={handleVoiceMessage}
        disabled={isAnalysing || isSpeaking}
        mode={chatMode}
        onModeChange={setChatMode}
      />
    </div>
  );
}
