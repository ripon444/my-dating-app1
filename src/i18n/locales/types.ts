export type SupportedLanguage =
  | 'en'
  | 'bn'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'
  | 'ar'
  | 'hi'
  | 'ja'
  | 'ko'
  | 'zh'
  | 'ru'
  | 'it'
  | 'tr'
  | 'id'
  | 'vi'
  | 'th'
  | 'ur'
  | 'fa'
  | 'pl'
  | 'nl'
  | 'uk'
  | 'ms'
  | 'tl'
  | 'el'
  | 'sv'
  | 'ro'
  | 'cs'
  | 'hu'
  | 'da'
  | 'fi'
  | 'no'
  | 'he'
  | 'sw'
  | 'ta'
  | 'te'
  | 'mr'
  | 'gu'
  | 'pa';

export type WorldRegion = 'all' | 'asia' | 'europe' | 'americas' | 'mideast_africa';

export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  dir: 'ltr' | 'rtl';
  flag: string;
  region: 'asia' | 'europe' | 'americas' | 'mideast_africa';
}

export type TranslationDict = Record<string, string>;
