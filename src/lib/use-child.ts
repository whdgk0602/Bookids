"use client";

import { useSyncExternalStore } from "react";

// 지금 이 기기에서 그림책을 만드는 아이의 별명. 계정이 생기기 전까지 기기(브라우저)에 기억해 둔다.
// 공용 태블릿이면 시작 화면에서 아이가 바뀔 때마다 고른다.

const KEY = "bookids.child";
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setChild(name: string | null) {
  try {
    if (name) localStorage.setItem(KEY, name);
    else localStorage.removeItem(KEY);
  } catch {
    // 저장소를 쓸 수 없으면 이번 화면에서만 기억하지 못한다
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useChild(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

// 이 기기에서 쓴 적 있는 별명 목록 (시작 화면의 아이 고르기)
const LIST_KEY = "bookids.children";

export function knownChildren(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(LIST_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function rememberChild(name: string) {
  try {
    const list = [name, ...knownChildren().filter((n) => n !== name)].slice(0, 30);
    localStorage.setItem(LIST_KEY, JSON.stringify(list));
  } catch {
    // 무시
  }
  setChild(name);
}

export function forgetChild(name: string) {
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(knownChildren().filter((n) => n !== name)));
  } catch {
    // 무시
  }
  if (read() === name) setChild(null);
  else listeners.forEach((l) => l());
}

// 목록이 바뀌면 다시 그리도록 문자열로 구독한다 (배열은 매번 새로 만들어지므로)
const readList = () => {
  try {
    return localStorage.getItem(LIST_KEY) ?? "[]";
  } catch {
    return "[]";
  }
};

export function useKnownChildren(): string[] {
  const raw = useSyncExternalStore(subscribe, readList, () => "[]");
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
