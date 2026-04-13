import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, X, Zap, RefreshCw, AlertTriangle } from 'lucide-react';

const SMARTQUERY_KEY = 'smartquery_api_key';

const VoiceQueryModal = ({ isOpen = false, onClose = () => {}, onSqlGenerated = () => {}, selectedSchema }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [language, setLanguage] = useState('tr-TR');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) setSupported(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsListening(false);
      setTranscript('');
      setError(null);
    }
  }, [isOpen]);

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript(final || interim);
    };

    recognition.onend = () => setIsListening(false);

    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setError('Mikrofon erişimi reddedildi. Tarayıcı ayarlarından izin verin.');
      } else {
        setError(`Ses tanıma hatası: ${event.error}`);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const handleConvert = async () => {
    if (!transcript.trim()) return;

    const apiKey = localStorage.getItem(SMARTQUERY_KEY);
    if (!apiKey) {
      setError('API Key gerekli. Smart Query sayfasından OpenRouter API anahtarınızı girin.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/generate-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          prompt: transcript,
          schema: selectedSchema || 'DWC_GLOBAL',
        })
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || 'SQL oluşturulamadı');
      }

      onSqlGenerated(data.sql);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setTranscript('');
    setError(null);
    startListening();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md mx-4 bg-[#0f1117] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25">
              <Mic className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Sesli Sorgu</h3>
              <p className="text-[11px] text-slate-500">Konuş, SQL'e çevirelim</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-white/[0.06] rounded-lg p-0.5 text-xs font-semibold">
              <button
                onClick={() => { if (isListening) stopListening(); setLanguage('tr-TR'); setTranscript(''); }}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  language === 'tr-TR'
                    ? 'bg-violet-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                TR
              </button>
              <button
                onClick={() => { if (isListening) stopListening(); setLanguage('en-US'); setTranscript(''); }}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  language === 'en-US'
                    ? 'bg-violet-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                EN
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {!supported ? (
            <div className="flex items-center gap-3 p-4 bg-red-500/[0.08] border border-red-500/20 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">
                Tarayıcınız ses tanımayı desteklemiyor. Chrome veya Edge kullanın.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center py-4 gap-3">
                <button
                  onClick={isListening ? stopListening : startListening}
                  className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                    isListening
                      ? 'bg-red-500 shadow-lg shadow-red-500/40'
                      : 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50'
                  }`}
                >
                  {isListening && (
                    <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30" />
                  )}
                  {isListening
                    ? <MicOff className="w-8 h-8 text-white" />
                    : <Mic className="w-8 h-8 text-white" />
                  }
                </button>
                <p className="text-xs text-slate-400 text-center">
                  {isListening
                    ? (language === 'tr-TR'
                        ? 'Türkçe dinleniyor... (durdurmak için tıkla)'
                        : 'Listening in English... (click to stop)')
                    : 'Mikrofona tıkla ve konuş'
                  }
                </p>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
                  Tanınan Metin
                </label>
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder={language === 'tr-TR'
                    ? 'Konuştuktan sonra metin burada görünür...'
                    : 'Your speech will appear here...'}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-slate-200 placeholder-slate-600 outline-none resize-none focus:border-violet-500/50 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.15)]"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-500/[0.08] border border-red-500/20 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleRetry}
                  disabled={isListening || loading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 bg-white/[0.04] hover:bg-white/[0.07] hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Tekrar Kaydet
                </button>
                <button
                  onClick={handleConvert}
                  disabled={!transcript.trim() || loading}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    !transcript.trim() || loading
                      ? 'bg-white/[0.04] text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40'
                  }`}
                >
                  {loading ? (
                    <>
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      SQL'e Çevir
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceQueryModal;
