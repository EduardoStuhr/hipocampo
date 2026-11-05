"""Cold wheel scrolling and recovery after a slow frame, on a software GPU.

Use --baseline to serve the saved Git sources through browser routes. This
never modifies a checkout. Metrics are lab observations, not device FPS claims.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts' / 'scroll-startup'
OUT.mkdir(parents=True, exist_ok=True)
URL = os.environ.get('HIPOCAMPO_QA_URL', 'http://127.0.0.1:4173/')
BASE = 'backup/antes-correcao-scroll-2026-11-05'
PREFIX = 'Kimi_Agent_HIPOCAMPO 3D Interactive Site/hipocampo/'
BASELINE = '--baseline' in sys.argv
LABEL = 'baseline-qa' if BASELINE else 'current-qa'
results = {'baseline': BASELINE, 'checks': [], 'errors': [], 'runs': []}


def check(name, passed, details=None):
    entry = {'name': name, 'passed': bool(passed)}
    if details is not None:
        entry['details'] = details
    results['checks'].append(entry)
    print(json.dumps(entry, ensure_ascii=False), flush=True)
    if not BASELINE:
        assert passed, name


def serve_source(page):
    files = ['index.html', 'public/assets/hero-motion.js',
             'public/assets/page3-house.js', 'public/assets/memory-map.js', 'public/assets/installation-room.js',
             'public/assets/installation-scene.js', 'public/assets/installation-room.css']
    for name in files:
        source = subprocess.check_output(['git', 'show', f'{BASE}:{PREFIX}{name}'], cwd=ROOT) if BASELINE else (ROOT / name).read_bytes()
        pattern = URL if name == 'index.html' else f'**/assets/{Path(name).name}?*'
        mime = 'text/html' if name.endswith('.html') else 'text/css' if name.endswith('.css') else 'application/javascript'
        page.route(pattern, lambda route, request, body=source, content_type=mime: route.fulfill(body=body, content_type=content_type))


PROBE = '''window.__startup={frames:[],tasks:[],contexts:[],record:true};
const getContext=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(type,...args){
  if(type.startsWith('webgl')) __startup.contexts.push({time:performance.now(),canvas:this.className});
  return getContext.call(this,type,...args);
};
new PerformanceObserver(list=>list.getEntries().forEach(e=>__startup.tasks.push({time:e.startTime,duration:e.duration}))).observe({type:'longtask',buffered:true});
let last;
function sample(time){
  if(!__startup.record)return;
  const el=document.querySelector('#casa'), house=el?.houseJourney?.inspect();
  __startup.frames.push({time,dt:last?time-last:0,y:scrollY,height:document.documentElement.scrollHeight,
    houseStart:el?el.getBoundingClientRect().top+scrollY:null,
    houseEnd:el?el.getBoundingClientRect().bottom+scrollY-innerHeight:null,
    prepared:!!house?.prepared,house:house?{progress:house.progress,target:house.target,visible:house.visible}:null});
  last=time;requestAnimationFrame(sample);
}
requestAnimationFrame(sample);'''


def cold_scroll(browser, width, height, cpu):
    context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1)
    page = context.new_page()
    page.on('pageerror', lambda error: results['errors'].append(str(error)))
    page.add_init_script(PROBE)
    serve_source(page)
    session = context.new_cdp_session(page)
    session.send('Network.enable')
    session.send('Network.setCacheDisabled', {'cacheDisabled': True})
    session.send('Emulation.setCPUThrottlingRate', {'rate': cpu})
    page.goto(URL, wait_until='domcontentloaded')
    page.wait_for_function('window.__hipocampoLenis != null')
    # Start while images, modules and WebGL are still preparing, not after
    # networkidle. Physical input must remain usable through circle closure.
    for _ in range(26):
        page.mouse.wheel(0, 100)
        page.wait_for_timeout(65)
    page.wait_for_timeout(250)
    data = page.evaluate('()=>{__startup.record=false;return __startup}')
    critical = [f for f in data['frames'] if f['houseStart'] is not None and 40 < f['y'] <= f['houseStart'] + .12 * (f['houseEnd']-f['houseStart'])]
    longest = max((f['dt'] for f in critical), default=0)
    reversals = sum(b['y'] < a['y']-2 for a,b in zip(critical,critical[1:]))
    distant = [c for c in data['contexts'] if c['canvas']=='installation-canvas']
    details = {'width': width, 'height': height, 'cpu': cpu, 'cache': 'disabled', 'gpu': 'SwiftShader', 'maxOpeningFrameMs': round(longest, 1), 'scrollReversals': reversals, 'distantRoomContexts': len(distant)}
    results['runs'].append(details)
    (OUT / f'{LABEL}-{width}.json').write_text(json.dumps(data, indent=2))
    check(f'{width}: instalação distante não disputa a abertura', not distant, details)
    check(f'{width}: preparação não mostra quadros incompletos da instalação', page.locator('.installation-canvas').evaluate('el=>Number(getComputedStyle(el).opacity)') == 0)
    check(f'{width}: rolagem avança sem voltar nem parar por um segundo', bool(critical) and longest < 1000 and reversals == 0, details)
    before = page.evaluate('scrollY')
    for _ in range(6):
        page.mouse.wheel(0, -150)
        page.wait_for_timeout(65)
    page.wait_for_timeout(250)
    check(f'{width}: retorno com roda continua funcionando', page.evaluate('scrollY') < before-100)
    page.wait_for_function('document.querySelector("#casa")?.houseJourney != null', timeout=60000)
    page.evaluate('window.__hipocampoLenis.scrollTo(0,{immediate:true})')
    page.wait_for_timeout(100)
    house = page.locator('#casa').evaluate('el=>el.houseJourney.inspect()')
    check(f'{width}: casa preparada e pausada atrás da abertura', house.get('prepared', False) and not house['visible'] and not house['framePending'])
    check(f'{width}: mapa continua disponível antes de entrar na casa', page.locator('[data-memory-map]').evaluate('el=>el.style.visibility') != 'hidden')
    page.screenshot(path=str(OUT / f'{LABEL}-hero-{width}.png'))
    context.close()


def frame_recovery(browser):
    page = browser.new_page(viewport={'width':1366,'height':768})
    serve_source(page)
    page.on('pageerror', lambda error: results['errors'].append(str(error)))
    page.goto(URL, wait_until='networkidle')
    page.wait_for_function('document.querySelector("#casa")?.houseJourney != null', timeout=60000)
    recovery = page.evaluate('''async()=>{
      const lenis=window.__hipocampoLenis,frames=[];
      lenis.scrollTo(0,{immediate:true});
      lenis.scrollTo(700,{duration:1.08});
      await new Promise(resolve=>{
        let previous=scrollY;
        function frame(){
          frames.push({y:scrollY,step:scrollY-previous});previous=scrollY;
          if(frames.length===2){const start=performance.now();while(performance.now()-start<300){}}
          if(frames.length>=16)resolve();else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
      return {frames,maxStep:Math.max(...frames.map(f=>f.step)),stopped:lenis.isStopped};
    }''')
    check('quadro lento não consome a animação de rolagem de uma vez', recovery['maxStep'] < 230 and not recovery['stopped'], recovery)
    page.evaluate('window.__hipocampoLenis.scrollTo(0,{immediate:true})')
    page.wait_for_function("getComputedStyle(document.querySelector('header nav')).opacity>0.99")
    page.locator('header a[href="#projeto"]').click()
    page.wait_for_function('Math.abs(document.querySelector("#projeto").getBoundingClientRect().top)<3')
    check('âncora Projeto chega ao texto sem prender a rolagem', True)
    page.evaluate('''async()=>{
      const {t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');
      const s=ST.getById('hipocampo-house');
      window.__hipocampoLenis.scrollTo(s.start+.08*(s.end-s.start),{immediate:true});ST.update();
    }''')
    page.wait_for_function('document.querySelector("#casa").houseJourney.inspect().visible')
    page.wait_for_timeout(150)
    images = page.locator('.memory-map-piece').evaluate_all('images=>images.map(image=>image.style.transform)')
    page.wait_for_timeout(200)
    paused = page.locator('.memory-map-piece').evaluate_all('images=>images.map(image=>image.style.transform)')
    check('mapa coberto pela casa deixa de animar em paralelo', images == paused)
    page.evaluate('window.__hipocampoLenis.scrollTo(0,{immediate:true})')
    check('retorno libera o mapa e a navegação', page.locator('[data-memory-map]').evaluate('el=>el.style.visibility') != 'hidden')
    page.close()


try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=os.environ.get('HIPOCAMPO_CHROME','/usr/bin/chromium'), headless=True, args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        cold_scroll(browser, 1366, 768, 1)
        cold_scroll(browser, 390, 844, 4)
        frame_recovery(browser)
        browser.close()
    check('sem exceções JavaScript durante a primeira visita', not results['errors'], results['errors'])
finally:
    (OUT / f'{LABEL}-results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
