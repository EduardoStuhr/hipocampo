"""Native input, geometric reveals and scrolling around the camera section."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts' / 'camera-photos'
OUT.mkdir(parents=True, exist_ok=True)
URL = os.environ.get('HIPOCAMPO_QA_URL', 'http://127.0.0.1:4173/')
results = {'checks': [], 'errors': [], 'assets': []}


def check(name, passed, details=None):
    value = {'name': name, 'passed': bool(passed)}
    if details is not None:
        value['details'] = details
    results['checks'].append(value)
    print(json.dumps(value, ensure_ascii=False), flush=True)
    assert passed, name


def open_page(browser, width, height, mobile=False, reduced=False, block_photos=False):
    context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1, is_mobile=mobile, has_touch=mobile, reduced_motion='reduce' if reduced else 'no-preference')
    page = context.new_page()
    page.on('pageerror', lambda error: results['errors'].append(str(error)))
    page.on('response', lambda r: results['assets'].append(f'{r.status} {r.url}') if r.status >= 400 and r.url.startswith(URL) else None)
    if block_photos:
        page.route('**/images/trail/photo-*.webp',lambda route:route.abort())
    page.goto(URL, wait_until='networkidle')
    page.locator('.page5-shutter').wait_for(state='attached')
    page.evaluate('document.fonts.ready')
    page.locator('.page5-shutter').scroll_into_view_if_needed()
    page.wait_for_function('document.querySelector(".page5-camera").complete&&document.querySelector(".page5-camera").naturalWidth>0')
    return context, page


def wait_photo(page, number):
    page.wait_for_function('''n=>{
      const el=document.querySelector(`.page5-generated-photo[data-photo-number="${n}"]`);
      const image=el?.querySelector('img');
      if(!el||!image?.complete||!image.naturalWidth)return false;
      const style=getComputedStyle(el),matrix=new DOMMatrix(style.transform==='none'?undefined:style.transform);
      return style.opacity>.99&&getComputedStyle(image).opacity>.99&&Math.abs(matrix.m41)<.1&&Math.abs(matrix.m42)<.1;
    }''', arg=number)
    return page.locator('.page5-generated-photo').last.evaluate('el=>({shape:el.dataset.shape,clip:getComputedStyle(el.querySelector(".page5-photo-paper")).clipPath,src:el.querySelector("img").getAttribute("src")})')


def desktop(browser):
    context, page = open_page(browser, 1366, 900)
    button = page.get_by_role('button', name='Gerar fotografia pelo disparador')
    check('geração começa vazia e aparece somente uma câmera', page.locator('.page5-generated-photo').count() == 0 and page.locator('.page5-camera').count() == 1)
    image = page.locator('.page5-camera').bounding_box()
    hotspot = button.bounding_box()
    center = {'x': (hotspot['x'] + hotspot['width']/2-image['x'])/image['width'], 'y': (hotspot['y'] + hotspot['height']/2-image['y'])/image['height']}
    check('alvo acompanha o disparador real da fotografia', abs(center['x']-.789)<.003 and abs(center['y']-.678)<.003, center)
    for x, y in [(.5,.2),(.14,.76),(.9,.79)]:
        page.mouse.click(image['x']+image['width']*x,image['y']+image['height']*y)
    hint = page.locator('.page5-camera-hint').bounding_box()
    page.mouse.click(hint['x']+hint['width']/2,hint['y']+hint['height']/2)
    check('lente, outros comandos e texto gerar não disparam fotos', page.locator('.page5-generated-photo').count() == 0)
    shots = []
    for i in range(1,11):
        button.click()
        shots.append(wait_photo(page,i))
        if i in [1,3]:
            page.locator('#vestigios').screenshot(path=str(OUT/f'after-desktop-{i}.png'))
    check('cada clique muda a forma e não repete a foto anterior', all(a['shape']!=b['shape'] and a['clip']!=b['clip'] and a['src']!=b['src'] for a,b in zip(shots,shots[1:])), shots)
    check('oito recortes geométricos aparecem antes de repetir', len({s['shape'] for s in shots[:8]}) == 8)
    check('somente fotografias locais existentes são utilizadas', all(s['src'].startswith('/images/trail/photo-') and (ROOT/'public'/s['src'].lstrip('/')).is_file() for s in shots))
    check('colagem mantém somente três fotos geradas', page.locator('.page5-generated-photo').count() == 3)
    button.focus()
    button.press('Enter');wait_photo(page,11)
    y = page.evaluate('scrollY')
    button.press('Space');wait_photo(page,12)
    check('Enter e espaço geram fotos sem deslocar a página', abs(page.evaluate('scrollY')-y)<2)
    check('leitor de tela recebe a nova fotografia e sua forma', 'Fotografia 12 revelada em forma de' in page.locator('.page5-camera-status').inner_text())
    for _ in range(12):
        button.click()
    wait_photo(page,24)
    check('cliques rápidos preservam a sequência e limitam as camadas', page.locator('.page5-generated-photo').count()==3 and button.get_attribute('aria-busy')=='false')
    page.wait_for_function('''async()=>{
      const {n:gsap}=await import('/assets/index-BXEErpTi.js?v=perf-1');
      return gsap.getTweensOf([...document.querySelectorAll('.page5-generated-photo,.page5-generated-photo img,.page5-shutter')]).length===0;
    }''')
    check('animações terminam e não deixam loop contínuo', True)
    check('envelope e texto da página anterior permanecem disponíveis', page.locator('.page4-photo--envelope').get_attribute('tabindex')=='0' and page.locator('.page4-text p').count()==3)
    page.mouse.move(10,700);y=page.evaluate('scrollY');page.mouse.wheel(0,450)
    page.wait_for_function('old=>scrollY>old+100',arg=y)
    check('scroll continua depois de usar a câmera', True)
    page.evaluate('window.__hipocampoLenis.scrollTo(document.querySelector("#instalacao"),{immediate:true})')
    page.wait_for_function('''()=>{const el=document.querySelector('#instalacao');return Math.abs(el.getBoundingClientRect().top-(parseFloat(getComputedStyle(el).scrollMarginTop)||0))<3}''')
    check('próxima seção continua acessível sem trava de scroll', page.locator('#instalacao').count()==1 and page.evaluate('document.body.style.overflow')!='hidden')
    page.evaluate('window.__hipocampoLenis.scrollTo(document.querySelector("#vestigios"),{immediate:true})')
    check('retorno conserva as fotos geradas', page.locator('.page5-generated-photo').count()==3)
    context.close()


def mobile(browser):
    context, page = open_page(browser, 390, 844, mobile=True)
    button = page.locator('.page5-shutter')
    box=button.bounding_box()
    check('disparador oferece alvo de toque de 44 pixels', box['width']>=44 and box['height']>=44)
    for i in range(1,4):
        button.tap();wait_photo(page,i)
    photo=page.locator('.page5-generated-photo').last.bounding_box()
    check('foto revelada fica visível após toque no celular', photo['y']<844 and photo['y']+photo['height']>0, photo)
    for w,h in [(390,844),(375,667)]:
        page.set_viewport_size({'width':w,'height':h})
        page.wait_for_timeout(250)
        check(f'{w}: sem overflow horizontal',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    page.locator('#vestigios').screenshot(path=str(OUT/'after-mobile.png'))
    context.close()


def reduced_and_failure(browser):
    context,page=open_page(browser,1366,900,reduced=True)
    button=page.locator('.page5-shutter')
    button.click();wait_photo(page,1)
    moving=page.evaluate('''async()=>{const {n:gsap}=await import('/assets/index-BXEErpTi.js?v=perf-1');return gsap.getTweensOf([...document.querySelectorAll('.page5-generated-photo,.page5-generated-photo img,.page5-shutter')]).length}''')
    check('movimento reduzido revela a fotografia sem voo ou pulso',moving==0)
    context.close()
    context,page=open_page(browser,1366,900,reduced=True,block_photos=True)
    page.locator('.page5-shutter').click()
    page.wait_for_function('document.querySelector(".page5-shutter").getAttribute("aria-busy")==="false"')
    check('falha de imagem libera o disparador para nova tentativa','Não foi possível' in page.locator('.page5-camera-status').inner_text() and page.locator('.page5-generated-photo').count()==0)
    page.unroute('**/images/trail/photo-*.webp')
    page.locator('.page5-shutter').click()
    page.wait_for_function('document.querySelectorAll(".page5-generated-photo").length>0')
    check('geração continua após restaurar o carregamento das fotos',True)
    context.close()


try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('HIPOCAMPO_CHROME','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        desktop(browser)
        mobile(browser)
        reduced_and_failure(browser)
        browser.close()
    check('sem exceções JavaScript',not results['errors'],results['errors'])
    check('recursos locais disponíveis',not results['assets'],results['assets'])
finally:
    (OUT/'qa-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
