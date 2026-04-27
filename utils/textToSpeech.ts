
export const getAvailableVoices = (): Promise<SpeechSynthesisVoice[]> => {
    if (!('speechSynthesis' in window)) {
        return Promise.resolve([]);
    }
    
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
        return Promise.resolve(voices);
    }

    return new Promise((resolve) => {
        // Voices might load asynchronously
        const handler = () => {
            const v = window.speechSynthesis.getVoices();
            if (v.length > 0) {
                window.speechSynthesis.removeEventListener('voiceschanged', handler);
                resolve(v);
            }
        };
        
        window.speechSynthesis.addEventListener('voiceschanged', handler);

        // Fallback timeout: If no voices after 1s, return empty (don't block too long)
        // Android WebView often has issues here, so we shouldn't wait forever.
        setTimeout(() => {
             window.speechSynthesis.removeEventListener('voiceschanged', handler);
             resolve(window.speechSynthesis.getVoices());
        }, 1000);
    });
};

export const getCategorizedVoices = async () => {
    const voices = await getAvailableVoices();
    return {
        hindi: voices.filter(v => v.lang.includes('hi') || v.name.toLowerCase().includes('hindi')),
        indianEnglish: voices.filter(v => v.lang === 'en-IN' || (v.lang.includes('en') && v.name.toLowerCase().includes('india'))),
        others: voices.filter(v => !v.lang.includes('hi') && !v.name.toLowerCase().includes('hindi') && v.lang !== 'en-IN' && !v.name.toLowerCase().includes('india'))
    };
};

export const setPreferredVoice = (voiceURI: string) => {
    localStorage.setItem('nst_preferred_voice_uri', voiceURI);
};

export const getPreferredVoice = async (): Promise<SpeechSynthesisVoice | undefined> => {
    const uri = localStorage.getItem('nst_preferred_voice_uri');
    const voices = await getAvailableVoices();
    if (!uri) return undefined;
    return voices.find(v => v.voiceURI === uri);
};

export const stripHtml = (html: string): string => {
    if (!html) return "";

    // 1. Remove style and script blocks entirely (we don't want TTS reading CSS/JS)
    let clean = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
    clean = clean.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');

    // 2. Remove all HTML tags using regex as a first pass for safety
    clean = clean.replace(/<[^>]*>?/gm, ' ');

    // 3. Decode HTML entities (e.g. &nbsp; &amp;) using the DOM
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = clean;
    clean = tempDiv.textContent || tempDiv.innerText || "";

    // 4. Strip KaTeX/Math delimiters ($ and $$) so TTS doesn't say "dollar"
    clean = clean.replace(/\$\$/g, ' ');
    clean = clean.replace(/\$/g, ' ');

    // 5. Strip Markdown formatting characters so TTS doesn't read them aloud
    //    (e.g. "asterisk asterisk", "hash", "underscore", etc.)
    //    Order matters: handle multi-char tokens first.
    clean = clean.replace(/^\s{0,3}#{1,6}\s+/gm, ' '); // ATX headings: ###, ## etc at line start
    clean = clean.replace(/#+/g, ' ');                 // any other #
    clean = clean.replace(/\*+/g, ' ');                // *, **, ***, **** (bold/italic markers)
    clean = clean.replace(/(^|\s)_+(\S)/g, '$1$2');    // leading underscores around words
    clean = clean.replace(/(\S)_+(\s|$)/g, '$1$2');    // trailing underscores around words
    clean = clean.replace(/~{2,}/g, ' ');              // ~~ strikethrough
    clean = clean.replace(/`+/g, ' ');                 // `code`
    clean = clean.replace(/^\s*>+\s?/gm, ' ');         // > blockquotes
    clean = clean.replace(/^\s*[-+]\s+/gm, ' ');       // - / + list bullets at line start
    clean = clean.replace(/^\s*\d+\.\s+/gm, ' ');      // numbered list "1. " at line start (keep number reading? remove dot/space marker only — safer to drop)
    clean = clean.replace(/\|/g, ' ');                 // markdown table pipes
    clean = clean.replace(/\\([*_#`~])/g, '$1');       // unescape escaped markdown chars

    // 6. Clean up excessive whitespace and punctuation that TTS might misinterpret
    clean = clean.replace(/\s+/g, ' ').trim();

    return clean;
};

// Chrome bug workaround: speech stops after ~15s. Use a keep-alive interval.
let keepAliveInterval: any = null;
const startKeepAlive = () => {
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    keepAliveInterval = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
            return;
        }
        // Pause + resume keeps Chrome's TTS alive past ~15s
        try {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
        } catch (e) {}
    }, 10000);
};
const stopKeepAlive = () => {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
    }
};

export const speakText = async (
    text: string,
    voice?: SpeechSynthesisVoice | null,
    rate: number = 1.0,
    lang: string = 'en-US',
    onStart?: () => void,
    onEnd?: () => void
): Promise<SpeechSynthesisUtterance | null> => {
    if (!('speechSynthesis' in window)) {
        console.warn('Text-to-speech not supported.');
        if (onEnd) onEnd();
        return null;
    }

    // ROBUSTNESS: Cancel any existing speech immediately
    try {
        stopKeepAlive();
        window.speechSynthesis.cancel();
    } catch (e) {
        console.error("Error canceling speech:", e);
    }

    // Strip HTML if present
    const cleanText = stripHtml(text);
    if (!cleanText.trim()) {
        if (onEnd) onEnd();
        return null;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Priority: Explicit Voice -> User Preferred Voice -> Auto-Detect -> Default
    let selectedVoice = voice;
    
    if (!selectedVoice) {
        // Try to get preferred voice, but don't block if not available immediately
        // For WebView, we might just want to speak with default if voices aren't ready
        try {
             // We attempt to get voices, but if it takes too long, we proceed
             // This avoids the "TTS not working" perception if loading fails
             const voices = window.speechSynthesis.getVoices();
             if (voices.length > 0) {
                 const uri = localStorage.getItem('nst_preferred_voice_uri');
                 if (uri) selectedVoice = voices.find(v => v.voiceURI === uri);
             }
        } catch (e) {
            console.warn("Failed to retrieve voices synchronously:", e);
        }
    }

    if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
    } else {
        utterance.lang = lang;
    }
    
    utterance.rate = rate;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
        startKeepAlive();
        if (onStart) onStart();
    };

    // Robust onEnd handling
    utterance.onend = () => {
        stopKeepAlive();
        if (onEnd) onEnd();
    };

    // Error handling
    utterance.onerror = (e: any) => {
        // 'interrupted' / 'canceled' fire when we call cancel(); not real errors
        const err = e?.error || '';
        if (err !== 'interrupted' && err !== 'canceled') {
            console.error("Speech Error (TTS):", err || e);
        }
        stopKeepAlive();
        // Ensure onEnd is called even on error so UI doesn't get stuck
        if (onEnd) onEnd();
    };

    // Android WebView / Chrome Workaround:
    // Sometimes speaking immediately after cancel() fails.
    // We wrap in a small timeout to ensure the engine is ready.
    setTimeout(() => {
        try {
            window.speechSynthesis.speak(utterance);

            // Resume if paused (sometimes helps in Android/iOS)
            if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
            }
        } catch (e) {
            console.error("Speech Synthesis Failed:", e);
            stopKeepAlive();
            if (onEnd) onEnd();
        }
    }, 50);

    return utterance;
};

export const stopSpeech = () => {
    if ('speechSynthesis' in window) {
        stopKeepAlive();
        window.speechSynthesis.cancel();
    }
};
