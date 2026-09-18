import { writable, derived, get } from 'svelte/store';
import { createTranslator, isLocale, resolveLocale, type Locale, type LocalePreference } from './index.ts';
export { SUPPORTED_LOCALES, type LocalePreference } from './index.ts';
const STORAGE_KEY='spilink.locale.v1';
export const locale = writable<Locale>('en');
export const localePreference = writable<LocalePreference>('auto');
export const translation=derived(locale,createTranslator);
function apply() {
  const preference=get(localePreference);
  const next=preference==='auto'?resolveLocale(navigator.languages?.length?navigator.languages:[navigator.language]):preference;
  locale.set(next);document.documentElement.lang=next;
}
export function setLocalePreference(value:LocalePreference) {
  if (value!=='auto'&&!isLocale(value)) return;
  localePreference.set(value);apply();
  try{localStorage.setItem(STORAGE_KEY,value);}catch{/* Current-page selection remains available. */}
}
export function initLocale():()=>void {
  try{const stored=localStorage.getItem(STORAGE_KEY);if(stored==='auto'||isLocale(stored))localePreference.set(stored);}catch{/* Browser preference is the fallback. */}
  apply();const onLanguageChange=()=>{if(get(localePreference)==='auto')apply();};
  window.addEventListener('languagechange',onLanguageChange);
  return()=>window.removeEventListener('languagechange',onLanguageChange);
}
