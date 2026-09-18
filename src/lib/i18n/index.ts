import { messages, type MessageKey } from './messages.ts';
import { AppError } from '../errors.ts';
export type { MessageKey } from './messages.ts';
export type Locale = 'en' | 'ko' | 'ja';
export type LocalePreference = Locale | 'auto';
export const SUPPORTED_LOCALES = [{code:'en',name:'English'},{code:'ko',name:'한국어'},{code:'ja',name:'日本語'}] as const;
export function isLocale(value: unknown): value is Locale { return value === 'en' || value === 'ko' || value === 'ja'; }
export function resolveLocale(languages: readonly string[] = []): Locale {
  for (const language of languages) { const base = language.toLowerCase().split(/[-_]/)[0]; if (isLocale(base)) return base; }
  return 'en';
}
export function createTranslator(locale: Locale) {
  return (key: MessageKey, params: Record<string, string | number> = {}): string => {
    const entry = messages[key]; const text = entry?.[locale] ?? entry?.en ?? key;
    return text.replace(/\{(\w+)\}/g, (match, name) => String(params[name] ?? match));
  };
}
export function errorMessage(error: unknown, locale: Locale): string {
  const t=createTranslator(locale);
  if (error instanceof AppError && error.code in messages) {
    const params={...error.params};
    if (typeof params.key === 'string' && ('setup.'+params.key) in messages) params.key=t(('setup.'+params.key) as MessageKey);
    return t(error.code as MessageKey,params);
  }
  return t('error.unexpected');
}
