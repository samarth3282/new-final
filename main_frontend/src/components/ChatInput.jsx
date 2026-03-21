import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../contexts/I18nContext';
import { Paperclip, Mic, MicOff, Send, X, Loader2, MessageSquare, Volume2 } from 'lucide-react';
import { SARVAM_LANG_CODES, speechToText, translateToEnglish } from '../utils/voiceUtils';

/**
 * ChatInput with Text/Voice mode toggle.
 *
 * Props:
 *  - onSend({ text, file })          — text mode: user typed + pressed send
 *  - onVoiceMessage(englishText, originalText, langCode)
 *                                      — voice mode: user spoke, STT + translate done
 *  - disabled                         — disables input while bot is processing
 *  - mode / onModeChange             — 'text' | 'voice', controlled from parent
 */
export default function ChatInput({ onSend, onVoiceMessage, disabled, mode, onModeChange }) {
  const { t, lang } = useTranslation();
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const textareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [text]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed && !file) return;
    onSend({ text: trimmed, file });
    setText('');
    setFile(null);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function toggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        setRecording(false);

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size === 0) return;

        setProcessing(true);
        try {
          const langCode = SARVAM_LANG_CODES[lang] || 'hi-IN';

          // Step 1: STT
          const transcribedText = await speechToText(audioBlob, langCode);
          if (!transcribedText) { setProcessing(false); return; }

          // Step 2: Translate to English
          const englishText = await translateToEnglish(transcribedText, langCode);

          if (mode === 'voice') {
            // Voice mode: send directly to chatbot pipeline (parent handles it)
            onVoiceMessage?.(englishText, transcribedText, langCode);
          } else {
            // Text mode: populate the input bar with original-language text
            // (handleUserSend will translate to English for the server)
            setText(prev => prev + transcribedText);
          }
        } catch (err) {
          console.error('Voice processing error:', err);
        } finally {
          setProcessing(false);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  }

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  const isBusy = disabled || processing;
  const isVoice = mode === 'voice';

  return (
    <div className="sticky bottom-0 bg-surface border-t border-border p-3 z-50">
      {file && !isVoice && (
        <div className="flex items-center gap-2 mb-2 px-2">
          <span className="text-sm text-text-secondary bg-surface-2 px-3 py-1 rounded-full border border-border truncate max-w-[200px]">
            {file.name}
          </span>
          <button onClick={() => setFile(null)} className="text-text-hint hover:text-danger min-h-[48px] min-w-[48px] flex items-center justify-center">
            <X size={16} />
          </button>
        </div>
      )}

      {processing && (
        <div className="flex items-center gap-2 mb-2 px-2 text-sm text-primary">
          <Loader2 size={16} className="animate-spin" />
          <span>{t('chatbot.processing_voice')}</span>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Mode toggle button */}
        <button
          onClick={() => onModeChange?.(isVoice ? 'text' : 'voice')}
          className={`flex-shrink-0 p-3 min-h-[48px] min-w-[48px] flex items-center justify-center transition-colors rounded-lg ${
            isVoice ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-primary'
          }`}
          aria-label={isVoice ? 'Switch to text mode' : 'Switch to voice mode'}
          title={isVoice ? t('chatbot.switch_text') : t('chatbot.switch_voice')}
        >
          {isVoice ? <MessageSquare size={20} /> : <Volume2 size={20} />}
        </button>

        {isVoice ? (
          /* ─── Voice Mode UI ─── */
          <div className="flex-1 flex items-center justify-center gap-4">
            <button
              onClick={toggleRecording}
              disabled={processing}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-md ${
                recording
                  ? 'recording-pulse bg-danger text-white scale-110'
                  : 'bg-primary text-white hover:bg-primary-hover'
              }`}
              aria-label={recording ? 'Stop recording' : 'Start speaking'}
            >
              {recording ? <MicOff size={28} /> : <Mic size={28} />}
            </button>
            <span className="text-sm text-text-hint">
              {recording ? t('chatbot.listening') : t('chatbot.tap_to_speak')}
            </span>
          </div>
        ) : (
          /* ─── Text Mode UI ─── */
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-shrink-0 p-3 text-text-secondary hover:text-primary transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center"
              aria-label="Attach file"
            >
              <Paperclip size={20} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />

            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('chatbot.input_placeholder')}
              disabled={isBusy}
              rows={1}
              className="input-field flex-1 resize-none min-h-[48px] max-h-[120px]"
              style={{ lineHeight: '1.5' }}
            />

            <button
              onClick={toggleRecording}
              disabled={processing}
              className={`flex-shrink-0 p-3 min-h-[48px] min-w-[48px] flex items-center justify-center transition-colors ${
                recording ? 'recording-pulse text-danger' : 'text-text-secondary hover:text-primary'
              }`}
              aria-label={recording ? 'Stop recording' : 'Start voice input'}
            >
              {recording ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            <button
              onClick={handleSend}
              disabled={(!text.trim() && !file) || isBusy}
              className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all"
              style={{
                background: (text.trim() || file) && !disabled ? 'var(--color-primary)' : 'var(--color-surface-3)',
                color: (text.trim() || file) && !disabled ? 'white' : 'var(--color-text-hint)',
              }}
              aria-label="Send message"
            >
              <Send size={20} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
