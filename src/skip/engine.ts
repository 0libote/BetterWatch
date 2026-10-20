import { canSkip, classifyAction, RULES, SkipPreferences, SkipService } from './model';

export class SkipEngine {
  private clicked = new WeakMap<HTMLElement, number>();
  private lastClick = 0;
  private route = '';
  private service: SkipService;
  private preferences: () => SkipPreferences;
  private onSkip: (action: string) => void;
  constructor(service: SkipService, preferences: () => SkipPreferences,
    onSkip: (action: string) => void = () => {}) {
    this.service = service; this.preferences = preferences; this.onSkip = onSkip;
  }

  scan(root: Document = document, now = Date.now()): void {
    // Netflix/Prime/HBO are single-page apps. A new route can reuse button elements.
    if (this.route !== root.location.href) {
      this.route = root.location.href;
      this.clicked = new WeakMap();
    }
    if (now - this.lastClick < 1500 || !root.querySelector('video')) return;
    const prefs = this.preferences();
    for (const rule of RULES[this.service]) {
      for (const selector of rule.selectors) {
        for (const element of root.querySelectorAll<HTMLElement>(selector)) {
          const action = classifyAction(rule, element);
          if (!action || !canSkip(element, action, prefs)) continue;
          const lastClick = this.clicked.get(element);
          if (lastClick !== undefined && now - lastClick < 30000) continue;
          // Prime can offer a different show here; only follow an identified episode.
          if (this.service === 'amazon-prime' && action === 'credits' &&
            !root.querySelector('[class*="nextupcard-episode"]')?.textContent?.trim()) continue;
          this.clicked.set(element, now);
          this.lastClick = now;
          element.click();
          this.onSkip(action);
          return;
        }
      }
    }
  }
}
