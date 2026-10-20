import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { SkipEngine } from '../src/skip/engine';
import { DEFAULT_PREFERENCES, normalizeSettings, serviceForHost, SkipPreferences } from '../src/skip/model';

let dom: JSDOM;
afterEach(() => dom?.window.close());
function fixture(markup: string, service: 'netflix' | 'amazon-prime' | 'hbo-max' = 'netflix', initial: Partial<SkipPreferences> = {}) {
  dom = new JSDOM(`<video></video>${markup}`, {url: 'https://www.netflix.com/watch/123'});
  Object.assign(globalThis, {getComputedStyle: dom.window.getComputedStyle.bind(dom.window)});
  const root = dom.window.document;
  for (const element of root.querySelectorAll<HTMLElement>('button')) {
    element.style.opacity = '1';
    element.getClientRects = () => (element.hidden || element.style.display === 'none' ? [] : [{width:100,height:20}]) as unknown as DOMRectList;
  }
  let count = 0;
  root.querySelectorAll('button').forEach(button => button.addEventListener('click',() => count++));
  const preferences = {...DEFAULT_PREFERENCES,...initial};
  const engine = new SkipEngine(service, () => preferences);
  return {root, engine, preferences, count: () => count};
}
test('only recognizes supported domains and their actual subdomains', () => {
  assert.equal(serviceForHost('www.netflix.com'),'netflix');
  assert.equal(serviceForHost('netflix.com.attacker.example'),null);
  assert.equal(serviceForHost('www.amazon.co.uk'),'amazon-prime');
  assert.equal(serviceForHost('play.hbomax.com'),'hbo-max');
  assert.equal(serviceForHost('www.disneyplus.com'),null);
});
test('normalizes malformed saved settings and preserves intentional false values', () => {
  const value = normalizeSettings({netflix:{intro:false, enabled:'false',credits:true},'hbo-max':null});
  assert.equal(value.netflix.intro,false);
  assert.equal(value.netflix.enabled,true);
  assert.equal(value.netflix.credits,true);
  assert.equal(value['hbo-max'].credits,false);
});
test('Netflix skips intros once despite repeated DOM scans', () => {
  const f = fixture('<button data-uia="player-skip-intro">Skip intro</button>');
  f.engine.scan(f.root,10000); f.engine.scan(f.root,10200); f.engine.scan(f.root,13000);
  assert.equal(f.count(),1);
});
test('Netflix distinguishes preplay recaps from intros', () => {
  const f = fixture('<button data-uia="player-skip-preplay">Recap</button>', 'netflix', {intro:false});
  f.engine.scan(f.root,10000);assert.equal(f.count(),1);
});
test('Netflix uses stable selectors for non-English intros', () => {
  const f = fixture('<button data-uia="player-skip-intro">イントロをスキップ</button>');
  f.engine.scan(f.root,10000);assert.equal(f.count(),1);
});
test('never skips hidden, disabled, or invisible buttons', () => {
  const f = fixture('<button hidden data-uia="player-skip-intro">Skip intro</button><button disabled data-uia="player-skip-intro">Skip intro</button><button style="visibility:hidden" data-uia="player-skip-intro">Skip intro</button>');
  f.engine.scan(f.root,10000);assert.equal(f.count(),0);
});
test('does not click arbitrary page buttons when there is no player', () => {
  const f = fixture('<button data-uia="player-skip-intro">Skip intro</button>');
  f.root.querySelector('video')!.remove();f.engine.scan(f.root,10000);assert.equal(f.count(),0);
});
test('turning off a service or an action takes effect on the next scan', () => {
  const f = fixture('<button data-uia="player-skip-intro">Skip intro</button>');
  f.preferences.enabled = false;f.engine.scan(f.root,10000);assert.equal(f.count(),0);
  f.preferences.enabled = true;f.preferences.intro = false;f.engine.scan(f.root,12000);assert.equal(f.count(),0);
  f.preferences.intro = true;f.engine.scan(f.root,14000);assert.equal(f.count(),1);
});
test('credits and keep-watching require explicit opt-in', () => {
  const f = fixture('<button data-uia="next-episode-seamless-button-draining">Next episode</button><button data-uia="interrupt-autoplay-continue">Continue</button>');
  f.engine.scan(f.root,10000);assert.equal(f.count(),0);
  f.preferences.credits = true;f.engine.scan(f.root,12000);assert.equal(f.count(),1);
  f.preferences.continueWatching = true;f.engine.scan(f.root,14000);assert.equal(f.count(),2);
});
test('navigation resets button deduplication for a new episode', () => {
  const f = fixture('<button data-uia="player-skip-intro">Skip intro</button>');
  f.engine.scan(f.root,10000);dom.reconfigure({url:'https://www.netflix.com/watch/456'});
  f.engine.scan(f.root,13000);assert.equal(f.count(),2);
});
test('Prime shared recap button respects recap preference separately', () => {
  const f = fixture('<button class="atvwebplayersdk-skipelement-button">Skip recap</button>','amazon-prime',{intro:true,recap:false});
  f.engine.scan(f.root,10000);assert.equal(f.count(),0);
  f.preferences.recap = true;f.engine.scan(f.root,12000);assert.equal(f.count(),1);
});
test('shared skip buttons with unknown labels do not guess the action', () => {
  const f = fixture('<button class="SkipButton-xyz">Unknown segment</button>','hbo-max');
  f.engine.scan(f.root,10000);assert.equal(f.count(),0);
});
test('HBO intro and next-episode selectors follow their preferences', () => {
  const f = fixture('<button class="SkipButton-xyz">Skip intro</button><button class="UpNextButton-xyz">Next episode</button>','hbo-max');
  f.engine.scan(f.root,10000);assert.equal(f.count(),1);
  f.preferences.credits = true;f.engine.scan(f.root,13000);assert.equal(f.count(),2);
});
test('Prime next-up recommendations require an identified episode', () => {
  const f = fixture('<button class="nextupcard-button">Watch now</button>','amazon-prime',{credits:true});
  f.engine.scan(f.root,10000);assert.equal(f.count(),0);
});
