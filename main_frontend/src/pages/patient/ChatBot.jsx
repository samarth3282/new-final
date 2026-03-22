import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../contexts/I18nContext';
import { useUser } from '../../contexts/UserContext';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../components/Toast';
import ChatMessage from '../../components/ChatMessage';
import ChatInput from '../../components/ChatInput';
import EmergencyBanner from '../../components/EmergencyBanner';
import HospitalCarousel from '../../components/HospitalCarousel';
import LoadingSpinner from '../../components/LoadingSpinner';
import { ArrowLeft, Settings } from 'lucide-react';
import { EMERGENCY_KEYWORDS } from '../../utils/mockData';
import { sendChatMessage } from '../../utils/chatbotService';
import { getOrCreatePatientId } from '../../utils/patientId';
import { SARVAM_LANG_CODES, translateToEnglish, translateFromEnglish, textToSpeech, playAudio } from '../../utils/voiceUtils';

export default function ChatBot() {
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const { state } = useUser();
  const { accessToken } = useAuth();
  const { addToast } = useToast();
  const [messages, setMessages] = useState([]);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [showHospitals, setShowHospitals] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [sosSuccess, setSosSuccess] = useState(false);
  const lastEmergencyResponseRef = useRef(null);
  const [chatMode, setChatMode] = useState('text'); // 'text' | 'voice'
  const [isSpeaking, setIsSpeaking] = useState(false);
  const chatModeRef = useRef('text');

  const [patientId] = useState(() => getOrCreatePatientId());
  const [sessionId, setSessionId] = useState(() => {
    const stored = localStorage.getItem('aetrix_session_id');
    const complete = localStorage.getItem('aetrix_session_complete');
    if (!stored || complete === 'true') {
      const newId = crypto.randomUUID();
      localStorage.setItem('aetrix_session_id', newId);
      localStorage.removeItem('aetrix_session_complete');
      return newId;
    }
    return stored;
  });
  const [userLat, setUserLat] = useState(null);
  const [userLng, setUserLng] = useState(null);
  const [hospitalData, setHospitalData] = useState(null);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [emergencySuccess, setEmergencySuccess] = useState(false);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  // Keep chatModeRef in sync with state
  useEffect(() => { chatModeRef.current = chatMode; }, [chatMode]);

  // Geolocation on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLat(pos.coords.latitude);
          setUserLng(pos.coords.longitude);
        },
        (err) => {
          console.warn('Geolocation denied or unavailable:', err.message);
          // Fallback to PDPU, Gandhinagar so hospital finder still works
          setUserLat(23.1567);
          setUserLng(72.6639);
        }
      );
    } else {
      // No geolocation support — use fallback
      setUserLat(23.1567);
      setUserLng(72.6639);
    }
  }, []);

  /**
   * Speaks text via Sarvam TTS when in voice mode.
   * Translates from English to user's language first if needed.
   */
  async function speakIfVoiceMode(text) {
    if (chatModeRef.current !== 'voice' || !text) return;
    const langCode = SARVAM_LANG_CODES[lang] || 'hi-IN';
    setIsSpeaking(true);
    try {
      // Translate to user's language before speaking if not already translated
      let textToSpeak = text;
      if (lang !== 'en') {
        try {
          textToSpeak = await translateFromEnglish(text, langCode);
        } catch {
          // Fall back to original text if translation fails
        }
      }
      const audioBlob = await textToSpeech(textToSpeak, langCode);
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

  function addBotMessage(text, extra = {}) {
    const msg = {
      id: Date.now() + Math.random(),
      sender: 'bot',
      text,
      answered: false,
      selectedOption: null,
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

  function checkEmergencyKeywords(text) {
    const lower = text.toLowerCase();
    return EMERGENCY_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
  }

  /**
   * Core handler: sends any user message directly to the chatbot API.
   * The chatbot handles all follow-up questions dynamically.
   */
  async function sendMessageToChatbot(englishText) {
    setIsAnalysing(true);
    const typingId = addTypingIndicator();
    try {
      const response = await sendChatMessage({
        user_id: patientId,
        session_id: sessionId,
        message: englishText,
        lat: userLat,
        lng: userLng,
        language: lang,
      });
      removeTypingIndicator(typingId);
      setSessionId(response.session_id);
      localStorage.setItem('aetrix_session_id', response.session_id);
      if (response.session_complete) {
        localStorage.setItem('aetrix_session_complete', 'true');
        setSessionComplete(true);
      }
      await handleChatbotResponse(response);
    } catch (err) {
      removeTypingIndicator(typingId);
      addToast(t('common.error'), 'error');
      console.error('Chatbot API error:', err);
    } finally {
      setIsAnalysing(false);
    }
  }

  /**
   * Text mode: user typed message → translate to English → send to chatbot.
   */
  async function handleUserSend({ text }) {
    if (!text) return;
    addUserMessage(text);

    if (checkEmergencyKeywords(text)) {
      setShowEmergency(true);
    }

    let englishText = text;
    if (lang !== 'en') {
      try {
        const langCode = SARVAM_LANG_CODES[lang] || 'hi-IN';
        englishText = await translateToEnglish(text, langCode);
      } catch (err) {
        console.error('Translation failed, using original:', err);
      }
    }

    await sendMessageToChatbot(englishText);
  }

  /**
   * Voice mode: STT + translation already done by ChatInput.
   * originalText shown in chat, englishText sent to chatbot.
   */
  async function handleVoiceMessage(englishText, originalText) {
    if (!englishText) return;
    addUserMessage(originalText);

    if (checkEmergencyKeywords(englishText)) {
      setShowEmergency(true);
    }

    await sendMessageToChatbot(englishText);
  }

  // ── handleChatbotResponse (response router) ──────────────────────────────
  async function handleChatbotResponse(response) {
    if (response.session_complete) {
      setSessionComplete(true);
      localStorage.setItem('aetrix_session_complete', 'true');
    }

    switch (response.output_type) {
      case 'clinic':
        await translateAndDisplay(response);
        if (response.hospital_info?.length) {
          setHospitalData(normalizeHospitals(response.hospital_info));
          setShowHospitals(true);
        }
        break;
      case 'emergency':
        setShowEmergency(true);
        lastEmergencyResponseRef.current = response;
        await translateAndDisplay(response);
        if (response.hospital_info?.length) {
          setHospitalData(normalizeHospitals(response.hospital_info));
          setShowHospitals(true);
        }
        break;
      case 'suggestions':
        await translateAndDisplay(response);
        if (response.hospital_info?.length) {
          setHospitalData(normalizeHospitals(response.hospital_info));
          setShowHospitals(true);
        }
        break;
      default:
        await translateAndDisplay(response);
    }
  }

  // ── translateAndDisplay: display response in chat → speak aloud ─
  async function translateAndDisplay(response) {
    const langCode = SARVAM_LANG_CODES[lang] || 'hi-IN';

    // The backend now responds in the user's language directly,
    // so we display the message as-is without translation.
    const translatedMessage = response.message || '';

    let translatedItems = response.action_items || [];

    const translatedDisclaimer = response.disclaimer || null;

    // Build display text
    let displayText = translatedMessage || '';
    if (translatedItems.length) {
      displayText += '\n\n' + translatedItems.map((item, i) => `${i + 1}. ${item}`).join('\n');
    }
    if (translatedDisclaimer) {
      displayText += `\n\n_${translatedDisclaimer}_`;
    }
    if (response.session_complete) {
      displayText += `\n\n${t('chatbot.session_complete')}`;
    }

    addBotMessage(displayText);

    // Speak the chatbot's response (question or answer) aloud in voice mode
    // Use already-translated text so TTS gets the user's language directly
    if (chatModeRef.current === 'voice' && translatedMessage) {
      const langCode2 = SARVAM_LANG_CODES[lang] || 'hi-IN';
      setIsSpeaking(true);
      try {
        const audioBlob = await textToSpeech(translatedMessage, langCode2);
        await playAudio(audioBlob);
      } catch (err) {
        console.error('TTS failed:', err);
      } finally {
        setIsSpeaking(false);
      }
    }
  }

  // ── normalizeHospitals ───────────────────────────────────────────────────
  function normalizeHospitals(hospitalInfoList) {
    return hospitalInfoList.map((h, i) => ({
      id: i + 1,
      name: h.name,
      address: h.address,
      distance: h.distance_km != null ? `${h.distance_km.toFixed(1)} km` : 'Unknown',
      phone: h.phone || 'N/A',
      hours: h.open_now === true ? 'Open Now' : h.open_now === false ? 'Closed' : 'Unknown',
      type: 'hospital',
      lat: h.lat ?? null,
      lng: h.lng ?? null,
    }));
  }

  // ── handleSOS — alerts all linked relatives via SMS + call ─────────────
  async function handleSOS() {
    if (sosLoading || sosSuccess) return;
    setSosLoading(true);

    let location = 'Unknown location';
    if (userLat !== null && userLng !== null) {
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${userLat}&lon=${userLng}&format=json`,
          { headers: { 'User-Agent': 'AetrixHealthApp/1.0' } }
        );
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          location = geoData.display_name || `${userLat}, ${userLng}`;
        } else {
          location = `${userLat}, ${userLng}`;
        }
      } catch {
        location = `${userLat}, ${userLng}`;
      }
    }

    const emergencyResponse = lastEmergencyResponseRef.current;
    const summary = emergencyResponse?.session_summary || {};

    try {
      const res = await fetch('http://localhost:3000/api/emergency/sos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          patientName: state.profile.preferredName || state.profile.firstName || 'Patient',
          symptoms: summary.symptoms || [],
          urgency: emergencyResponse?.urgency_label || 'Emergency',
          severity: summary.severity ?? null,
          duration: summary.duration || 'unknown',
          location,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
      setSosSuccess(true);
      addToast(t('emergency.sos_success').replace('{n}', data.notified ?? ''), 'success');
    } catch (err) {
      console.error('SOS failed:', err);
      addToast(t('emergency.sos_failed'), 'error');
    } finally {
      setSosLoading(false);
    }
  }

  // ── handleEmergencyCall — POSTs directly to the emergency API ────────────
  async function handleEmergencyCall() {
    if (emergencyLoading) return;
    setEmergencyLoading(true);

    const name = 'SAHIL';

    // Use readable address if we have coords, otherwise fall back to PDPU, Gandhinagar
    let location = 'PDPU, Gandhinagar';
    if (userLat !== null && userLng !== null) {
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${userLat}&lon=${userLng}&format=json`,
          { headers: { 'User-Agent': 'AetrixHealthApp/1.0' } }
        );
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          location = geoData.display_name || `${userLat}, ${userLng}`;
        } else {
          location = `${userLat}, ${userLng}`;
        }
      } catch {
        location = `${userLat}, ${userLng}`;
      }
    }

    try {
      const res = await fetch(
        'http://localhost:3000/api/emergency/call',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, location }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEmergencySuccess(true);
      addToast(t('emergency.call_success'), 'success');
    } catch (err) {
      console.error('Emergency call failed:', err);
      addToast(t('emergency.call_failed'), 'error');
    } finally {
      setEmergencyLoading(false);
    }
  }

  // ── handleStartNewChat ─────────────────────────────────────────────────
  function handleStartNewChat() {
    localStorage.removeItem('aetrix_session_complete');
    const newId = crypto.randomUUID();
    localStorage.setItem('aetrix_session_id', newId);
    setSessionId(newId);
    setSessionComplete(false);
    setShowEmergency(false);
    setShowHospitals(false);
    setHospitalData(null);
    setEmergencySuccess(false);
    setEmergencyLoading(false);
    setSosLoading(false);
    setSosSuccess(false);
    lastEmergencyResponseRef.current = null;
    setMessages([]);
    // Directly add greeting — cannot rely on mount useEffect re-firing
    const name = state.profile.preferredName ? ` ${state.profile.preferredName}` : '';
    const greeting = t('chatbot.greeting').replace('{name}', name);
    addBotMessage(greeting);
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
            onCallAmbulance={handleEmergencyCall}
            onSOS={handleSOS}
            sosLoading={sosLoading}
            sosSuccess={sosSuccess}
          />
        </div>
      )}

      {/* Hospital carousel — shown automatically whenever chatbot provides hospital data */}
      {hospitalData?.length > 0 && (
        <div className="px-4 pb-2">
          <HospitalCarousel
            hospitals={hospitalData}
            onBookAmbulance={handleEmergencyCall}
          />
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

      {/* Start New Chat button — shown when session ends */}
      {sessionComplete && (
        <div className="sticky bottom-[72px] flex justify-center px-4 pb-2 z-30">
          <button
            onClick={handleStartNewChat}
            className="btn-primary flex items-center gap-2 shadow-elevated"
          >
            {t('chatbot.start_new_chat')}
          </button>
        </div>
      )}

      {/* Chat input — disabled while bot is speaking/analysing or session has ended */}
      <ChatInput
        onSend={handleUserSend}
        onVoiceMessage={handleVoiceMessage}
        disabled={isAnalysing || isSpeaking || sessionComplete}
        mode={chatMode}
        onModeChange={setChatMode}
      />
    </div>
  );
}
