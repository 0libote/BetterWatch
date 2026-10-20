/** Skip selectors adapted from Streaming enhanced; see THIRD_PARTY_NOTICES.md. */
export const SERVICE_IDS = ['netflix', 'amazon-prime', 'hbo-max'] as const;
export type SkipService = typeof SERVICE_IDS[number];
export type SkipAction = 'intro' | 'recap' | 'credits' | 'continueWatching';
export interface SkipPreferences {
  enabled: boolean;
  intro: boolean;
  recap: boolean;
  credits: boolean;
  continueWatching: boolean;
}
export type SkipSettings = Record<SkipService, SkipPreferences>;
export const SERVICE_NAMES: Record<SkipService, string> = {
  netflix: 'Netflix', 'amazon-prime': 'Prime Video', 'hbo-max': 'HBO Max',
};
export const DEFAULT_PREFERENCES: SkipPreferences = {
  enabled: true, intro: true, recap: true, credits: false, continueWatching: false,
};
export function normalizeSettings(value: unknown): SkipSettings {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(SERVICE_IDS.map(id => {
    const raw = input[id] && typeof input[id] === 'object' ? input[id] as Record<string, unknown> : {};
    return [id, Object.fromEntries(Object.entries(DEFAULT_PREFERENCES).map(([key,fallback]) =>
      [key, typeof raw[key] === 'boolean' ? raw[key] : fallback]))];
  })) as SkipSettings;
}
export function serviceForHost(host: string): SkipService | null {
  if (/(^|\.)netflix\.com$/i.test(host)) return 'netflix';
  if (/(^|\.)(primevideo\.com|amazon\.(com|co\.jp|co\.uk|com\.au|de))$/i.test(host)) return 'amazon-prime';
  if (/(^|\.)(hbomax|hbo)\.com$/i.test(host)) return 'hbo-max';
  return null;
}
export interface SkipRule {action: SkipAction; selectors: string[]}
export const RULES: Record<SkipService, SkipRule[]> = {
  netflix: [
    {action: 'intro', selectors: ['[data-uia="player-skip-intro"]']},
    {action: 'recap', selectors: ['[data-uia="player-skip-recap"]','[data-uia="player-skip-preplay"]']},
    {action: 'credits', selectors: ['[data-uia="next-episode-seamless-button-draining"]']},
    {action: 'continueWatching', selectors: ['[data-uia="interrupt-autoplay-continue"]']},
  ],
  'amazon-prime': [
    {action: 'intro', selectors: ['[class*="skipelement"]']},
    {action: 'credits', selectors: ['[class*="nextupcard-button"]']},
  ],
  'hbo-max': [
    {action: 'intro', selectors: ['button[class*="SkipButton-"]']},
    {action: 'credits', selectors: ['button[class*="UpNextButton-"]']},
  ],
};

// Shared intro/recap buttons must respect each individual preference.
export function classifyAction(rule: SkipRule, element: Element): SkipAction | null {
  if (rule.action !== 'intro') return rule.action;
  const text = `${element.textContent || ''} ${element.getAttribute('aria-label') || ''}`;
  if (/recap|récap|zusammenfassung|resumen|riepilogo|resumo|振り返り|요약/i.test(text)) return 'recap';
  if (/intro|opening|vorspann|abertura|introducción|wstęp|イントロ|jenerik|소개/i.test(text)) return 'intro';
  // Netflix identifies the action independently of the user's language.
  if (element.getAttribute('data-uia') === 'player-skip-intro') return 'intro';
  // Shared buttons with an unknown label cannot safely choose a preference.
  return null;
}
export function canSkip(element: HTMLElement, action: SkipAction, prefs: SkipPreferences): boolean {
  if (!prefs.enabled || !prefs[action] || element.matches(':disabled, [aria-disabled="true"]')) return false;
  const style = getComputedStyle(element);
  return element.getClientRects().length > 0 && style.display !== 'none' &&
    style.visibility !== 'hidden' && style.visibility !== 'collapse' && Number(style.opacity) !== 0;
}
