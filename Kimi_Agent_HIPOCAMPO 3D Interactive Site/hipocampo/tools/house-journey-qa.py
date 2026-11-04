"""Visual and behavioural checks for the continuous camera through #casa."""
import json
import math
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parents[1]
ARTIFACTS = PROJECT / 'artifacts' / 'house-depth'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
URL = os.environ.get('HIPOCAMPO_QA_URL', 'http://127.0.0.1:4173/')
CHROME = os.environ.get('HIPOCAMPO_CHROME', '/usr/bin/chromium')
results = {'checks': [], 'errors': [], 'local_failures': [], 'states': {}}


def check(name, passed, details=None):
    item = {'name': name, 'passed': bool(passed)}
    if details is not None:
        item['details'] = details
    results['checks'].append(item)
    print(json.dumps(item, ensure_ascii=False), flush=True)
    assert passed, name


def state(page):
    return page.locator('#casa').evaluate('el=>el.houseJourney.inspect()')


def open_page(browser, w, h, reduced=False):
    context = browser.new_context(viewport={'width':w,'height':h}, device_scale_factor=1, reduced_motion='reduce' if reduced else 'no-preference', extra_http_headers={'Accept-Encoding':'identity'})
    page = context.new_page()
    page.on('pageerror', lambda error: results['errors'].append(str(error)))
    page.on('console', lambda message: results['errors'].append(message.text) if message.type == 'error' and not message.text.startswith('Failed to load resource') else None)
    page.on('response', lambda response: results['local_failures'].append(f'{response.status} {response.url}') if response.status >= 400 and response.url.startswith(URL) else None)
    page.goto(URL, wait_until='networkidle')
    page.wait_for_function('document.querySelector("#casa")?.houseJourney != null')
    return context, page


def go(page, progress):
    page.evaluate('''async progress=>{
      const {t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');
      const s=ST.getById('hipocampo-house');
      window.__hipocampoLenis.scrollTo(s.start+progress*(s.end-s.start),{immediate:true});
      ST.update();
    }''', progress)
    page.wait_for_function('''p=>{
      const s=document.querySelector('#casa').houseJourney.inspect();
      return Math.abs(s.target-p)<.0004 && Math.abs(s.progress-s.target)<.000001;
    }''', arg=progress)
    return state(page)


def run(browser, w, h):
    context, page = open_page(browser, w, h)
    check(f'{w}: montagem única e outras seções preservadas', page.locator('#casa').count()==1 and all(page.locator(f'#{id}').count()==1 for id in ['projeto','sobre','oficina','instalacao','fragmentos']))
    states = {}
    for progress in [.02,.2,.32,.42,.48,.51,.6,.68,.76,.86,.93,.97,1]:
        states[progress] = go(page, progress)
        if progress in [.02,.32,.42,.51,.6,.68,.76,.86,.93,.97,1]:
            page.screenshot(path=str(ARTIFACTS / f'final-{w}-{progress}.png'))
    check(f'{w}: câmera cruza a fachada fisicamente', states[.42]['camera'][2] > 0 and states[.6]['camera'][2] < 0)
    check(f'{w}: câmera percorre a sala até a abertura de saída', states[.76]['camera'][2] < states[.6]['camera'][2]-4 and states[.97]['camera'][2] < -14)
    check(f'{w}: altura de câmera preservada no interior', all(s['cameraHeight'] > 1.3 for p,s in states.items() if p>=.51))
    check(f'{w}: porta aberta antes da passagem', states[.48]['doorOpen'] > .99)
    before = go(page, .49)
    after = go(page, .50)
    jump = math.dist(before['camera'], after['camera'])
    check(f'{w}: sem troca de câmera ou teleporte na entrada', .01 < jump < .8, jump)
    for progress in [.93,.76,.68,.6,.42,.2,.02]:
        back = go(page, progress)
        distance = math.dist(back['camera'], states[progress]['camera'])
        check(f'{w}: retorno reversível em {progress}', distance < .035, {'distance':distance,'initial':states[progress]['camera'],'reverse':back['camera']})
    go(page, .68)
    page.set_viewport_size({'width':w-24,'height':h-30})
    page.wait_for_timeout(300)
    check(f'{w}: resize mantém a travessia sem fallback', page.locator('#casa').is_visible() and not page.locator('#casa').get_attribute('hidden'))
    check(f'{w}: sem overflow horizontal', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    page.set_viewport_size({'width':w,'height':h})
    page.wait_for_timeout(450)
    go(page, 1)
    page.evaluate('''()=>{
      const target=document.querySelector('#sobre');
      window.__hipocampoLenis.scrollTo(target,{immediate:true});
    }''')
    page.wait_for_timeout(450)
    page.screenshot(path=str(ARTIFACTS / f'next-{w}.png'))
    check(f'{w}: próxima seção visível e acessível', abs(page.locator('#sobre').evaluate('el=>el.getBoundingClientRect().top'))<3)
    y=page.evaluate('scrollY')
    page.mouse.move(w-5,h-10)
    page.mouse.wheel(0,300)
    page.wait_for_function('(old)=>scrollY>old+100',arg=y)
    check(f'{w}: rolagem segue após a saída', page.evaluate('scrollY')>y+100)
    results['states'][str(w)] = {str(p):s for p,s in states.items()}
    context.close()


def reduced_check(browser):
    context, page = open_page(browser, 1366,768,reduced=True)
    page.locator('#casa').scroll_into_view_if_needed()
    page.wait_for_timeout(400)
    first=state(page)
    page.mouse.move(1000,500)
    page.wait_for_timeout(350)
    second=state(page)
    check('movimento reduzido: câmera estática sem loop', first['camera']==second['camera'] and not second['framePending'])
    check('movimento reduzido: seção compacta', page.locator('#casa').evaluate('el=>el.getBoundingClientRect().height')<=770)
    page.emulate_media(reduced_motion='no-preference')
    page.wait_for_timeout(400)
    check('preferência alterada em execução sem perder a casa', not state(page)['reduced'] and page.locator('#casa').is_visible())
    # Losing the context must remove the sticky runway and return the DOM map.
    page.locator('.page3-canvas').dispatch_event('webglcontextlost')
    check('perda de contexto libera a navegação', page.locator('#casa').get_attribute('hidden') is not None and page.locator('#projeto [data-memory-map]').evaluate('el=>el.style.visibility')!='hidden')
    context.close()


def fallback_check(playwright):
    browser=playwright.chromium.launch(executable_path=CHROME,headless=True,args=['--no-sandbox','--disable-webgl'])
    page=browser.new_page(extra_http_headers={'Accept-Encoding':'identity'})
    page.goto(URL,wait_until='networkidle')
    page.wait_for_function('document.querySelector("#casa")?.hidden')
    check('WebGL indisponível preserva mapa e próxima seção', page.locator('#sobre').count()==1 and page.locator('#projeto [data-memory-map]').evaluate('el=>el.style.visibility')!='hidden')
    browser.close()


try:
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(executable_path=CHROME,headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        run(browser,1366,768)
        run(browser,390,844)
        reduced_check(browser)
        browser.close()
        fallback_check(playwright)
    check('sem exceções JavaScript ou erros de shader',not results['errors'],results['errors'])
    check('assets locais carregados',not results['local_failures'],results['local_failures'])
finally:
    (ARTIFACTS/'qa-results.json').write_text(json.dumps(results,indent=2,ensure_ascii=False))
