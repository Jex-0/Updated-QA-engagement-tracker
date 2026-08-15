import { useCallback, useEffect, useRef, useState } from "react";
import { KEYWORD_MAP } from "../lib/checklist";

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: { isFinal: boolean; [0]: { transcript: string } } };
}

function getSpeechAPI(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export interface UseSpeechResult {
  supported: boolean;
  listening: boolean;
  transcript: string;
  error: string | null;
  toggle(): void;
  reset(): void;
}

export function useSpeech(onKeyword: (category: string) => void): UseSpeechResult {
  const [supported] = useState<boolean>(() => getSpeechAPI() != null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const fullRef = useRef("");
  const matchedRef = useRef<Set<string>>(new Set());
  const listeningRef = useRef(false);
  const onKeywordRef = useRef(onKeyword);

  useEffect(() => {
    onKeywordRef.current = onKeyword;
  }, [onKeyword]);

  const stop = useCallback(() => {
    listeningRef.current = false;
    setListening(false);
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
  }, []);

  const start = useCallback(() => {
    if (!supported) return;
    const API = getSpeechAPI();
    if (!API) return;
    listeningRef.current = true;
    setListening(true);
    setError(null);
    if (!recRef.current) {
      const rec = new API();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-ZA";
      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const chunk = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            fullRef.current += " " + chunk;
            const lower = fullRef.current.toLowerCase();
            for (const [category, phrases] of Object.entries(KEYWORD_MAP)) {
              if (matchedRef.current.has(category)) continue;
              if (phrases.some((p) => lower.includes(p))) {
                matchedRef.current.add(category);
                onKeywordRef.current(category);
              }
            }
          } else {
            interim += chunk;
          }
        }
        setTranscript(fullRef.current.trim() + (interim ? ` ${interim}` : ""));
      };
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          listeningRef.current = false;
          setListening(false);
          setError("Microphone access denied. Allow the microphone and try again.");
        } else if (e.error !== "aborted" && e.error !== "no-speech") {
          setError(`Speech error: ${e.error}`);
        }
      };
      rec.onend = () => {
        if (listeningRef.current) {
          try {
            rec.start();
          } catch {
            /* restart failed — user can retry */
          }
        }
      };
      recRef.current = rec;
    }
    fullRef.current = "";
    matchedRef.current = new Set();
    setTranscript("");
    try {
      recRef.current.start();
    } catch {
      /* already running */
    }
  }, [supported]);

  const toggle = useCallback(() => {
    if (listeningRef.current) stop();
    else start();
  }, [start, stop]);

  const reset = useCallback(() => {
    stop();
    fullRef.current = "";
    matchedRef.current = new Set();
    setTranscript("");
    setError(null);
  }, [stop]);

  useEffect(() => () => stop(), [stop]);

  return { supported, listening, transcript, error, toggle, reset };
}
