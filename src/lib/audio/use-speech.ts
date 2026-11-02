"use client";

import { useCallback, useEffect, useRef } from "react";

// 캐릭터 음성 (DLG-05): 브라우저 내장 음성합성. 기기마다 한국어 목소리 품질이 다르다.
// 시연 품질이 부족하면 서버 TTS로 바꾼다.

const PREFERRED = /Google|Yuna|SunHi|Heami|InJoon|유나|선희/;

function pickKoreanVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("ko"));
  return voices.find((v) => PREFERRED.test(v.name)) ?? voices[0] ?? null;
}

export function useSpeech() {
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => {
      voiceRef.current = pickKoreanVoice();
    };
    load();
    // 목소리 목록은 늦게 도착하는 경우가 많다
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window) || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 0.95;
    utterance.pitch = 1.15;
    if (voiceRef.current) utterance.voice = voiceRef.current;
    window.speechSynthesis.speak(utterance);
  }, []);

  return { speak, stop };
}
