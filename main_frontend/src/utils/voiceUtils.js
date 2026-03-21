/**
 * Voice utilities: STT (Sarvam), Translation (MyMemory), TTS (Sarvam)
 * Shared across ChatInput and ChatBot for voice mode.
 */

const SARVAM_API_KEY = import.meta.env.VITE_SARVAM_API_KEY || '';

// Sarvam language codes for STT/TTS
export const SARVAM_LANG_CODES = {
  en: 'en-IN',
  hi: 'hi-IN',
  gu: 'gu-IN',
  mr: 'mr-IN',
  ta: 'ta-IN',
};

// MyMemory 2-letter codes
const MYMEMORY_LANG_CODES = {
  'hi-IN': 'hi',
  'gu-IN': 'gu',
  'mr-IN': 'mr',
  'ta-IN': 'ta',
  'en-IN': 'en',
};

/**
 * Speech-to-Text via Sarvam.ai
 */
export async function speechToText(audioBlob, langCode) {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.wav');
  formData.append('language_code', langCode);
  formData.append('model', 'saarika:v2.5');
  formData.append('with_timestamps', 'false');

  const res = await fetch('https://api.sarvam.ai/speech-to-text', {
    method: 'POST',
    headers: { 'api-subscription-key': SARVAM_API_KEY },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sarvam STT failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.transcript || '';
}

/**
 * Translate to English via MyMemory
 */
export async function translateToEnglish(text, sarvamLangCode) {
  const srcLang = MYMEMORY_LANG_CODES[sarvamLangCode] || 'hi';
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${srcLang}|en`;
  const res = await fetch(url);

  if (!res.ok) throw new Error(`Translation failed (${res.status})`);

  const data = await res.json();
  if (data.responseStatus === 200 && data.responseData?.translatedText) {
    return data.responseData.translatedText;
  }
  return text;
}

/**
 * Translate from English to user's language via MyMemory
 */
export async function translateFromEnglish(text, sarvamLangCode) {
  const targetLang = MYMEMORY_LANG_CODES[sarvamLangCode] || 'hi';
  if (targetLang === 'en') return text;

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`;
  const res = await fetch(url);

  if (!res.ok) throw new Error(`Translation failed (${res.status})`);

  const data = await res.json();
  if (data.responseStatus === 200 && data.responseData?.translatedText) {
    return data.responseData.translatedText;
  }
  return text;
}

/**
 * Text-to-Speech via Sarvam.ai
 * Returns an audio Blob that can be played.
 */
export async function textToSpeech(text, langCode) {
  const res = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': SARVAM_API_KEY,
    },
    body: JSON.stringify({
      inputs: [text],
      target_language_code: langCode,
      speaker: 'anushka',
      model: 'bulbul:v2',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sarvam TTS failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  // Sarvam returns base64-encoded audio
  if (data.audios && data.audios[0]) {
    const binaryStr = atob(data.audios[0]);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return new Blob([bytes], { type: 'audio/wav' });
  }
  throw new Error('No audio in TTS response');
}

/**
 * Play an audio blob and return a promise that resolves when playback ends.
 */
export function playAudio(audioBlob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(audioBlob);
    const audio = new Audio(url);
    audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
    audio.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    audio.play();
  });
}
