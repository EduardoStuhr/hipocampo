"""Palette, reversible colour band, responsive layout and the house handoff."""
import json
import os
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts'/'color-story'
OUT.mkdir(parents=True,exist_ok=True)
URL=os.environ.get('HIPOCAMPO_QA_URL','http://127.0.0.1:4173/')
results={'checks':[],'errors':[],'assets':[]}

def capture_section(page,id,path):
    # Capture the actual viewport. Expanding a tall section changes its scroll
    # timeline/compositor state and is not evidence of the visible colour band.
    if page.viewport_size['width']>760:
        page.evaluate('''async id=>{const{t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');const el=document.getElementById(id);const border=id==='vestigios'?parseFloat(getComputedStyle(el).borderTopWidth)+4:0;__hipocampoLenis.scrollTo(el.getBoundingClientRect().top+scrollY+border,{immediate:true});ST.update()}''',id)
    page.mouse.move(-5,-5)
    if page.viewport_size['width']>760:
        page.wait_for_function('''()=>{const h=document.querySelector('header'),tone=h.dataset.storyTone;if(!tone)return true;const expected=tone==='dark'?'rgb(240, 215, 86)':'rgb(107, 49, 28)';return getComputedStyle(h.querySelector('nav a')).color===expected}''')
    page.wait_for_timeout(100)
    page.screenshot(path=str(path))

def check(name,ok,details=None):
    entry={'name':name,'passed':bool(ok)}
    if details is not None:entry['details']=details
    results['checks'].append(entry);print(json.dumps(entry,ensure_ascii=False),flush=True)
    assert ok,name

def anchor(page,id):
    page.evaluate('''async id=>{const{t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');window.__hipocampoLenis.scrollTo(document.getElementById(id),{immediate:true});ST.update()}''',id)

def band_to(page,fraction):
    page.evaluate('''async p=>{const{t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');const s=ST.getById('hipocampo-color-band');window.__hipocampoLenis.scrollTo(s.start+(s.end-s.start)*p,{immediate:true});ST.update()}''',fraction)
    page.wait_for_timeout(80)
    return page.locator('.page4-color-band').evaluate('el=>new DOMMatrix(getComputedStyle(el).transform).a')

def open_page(browser,w,h,mobile=False):
    context=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1,is_mobile=mobile,has_touch=mobile)
    page=context.new_page()
    page.on('pageerror',lambda e:results['errors'].append(str(e)))
    page.on('response',lambda r:results['assets'].append(f'{r.status} {r.url}') if r.status>=400 and r.url.startswith(URL) else None)
    def house(route):
        response=route.fetch();body=response.text();needle='  const maxAniso ='
        assert body.count(needle)==1
        route.fulfill(response=response,body=body.replace(needle,'  window.__paletteHouse={renderer,THREE};\n'+needle))
    page.route('**/assets/page3-house.js?*',house)
    page.goto(URL,wait_until='networkidle');page.evaluate('document.fonts.ready')
    page.locator('.page5-photo-duration').wait_for(state='attached')
    return context,page

def colours(page,label):
    data=page.evaluate('''()=>{
      const css=s=>getComputedStyle(document.querySelector(s));
      return {about:css('#sobre').backgroundColor,ink:css('.page4-text').color,title:css('.page4-title').color,blue:css('.page4-color-band').backgroundColor,
        camera:css('#vestigios').backgroundColor,brown:css('.page5-color-panel').backgroundColor,text:css('.page5-text').color,brand:css('.page5-brand').color,
        hero:css('#abertura').backgroundColor,project:css('#projeto').backgroundColor};
    }''')
    check(f'{label}: apresentação amarela preserva o marrom original',data['about']=='rgb(240, 215, 86)' and data['ink']=='rgb(122, 42, 23)' and data['title']==data['ink'],data)
    check(f'{label}: faixa azul e câmera usam a paleta aprovada',data['blue']=='rgb(38, 38, 252)' and data['camera']=='rgb(240, 215, 86)' and data['brown']=='rgb(107, 49, 28)' and data['text']=='rgb(240, 215, 86)' and data['brand']=='rgb(38, 38, 252)')
    check(f'{label}: abertura e Projeto mantêm as cores existentes',data['hero']=='rgb(23, 41, 255)' and data['project']=='rgb(255, 255, 255)')

def desktop(browser):
    context,page=open_page(browser,1366,900)
    colours(page,'desktop')
    page.wait_for_function('document.querySelector("#casa")?.houseJourney!=null')
    page.evaluate('''async()=>{const{t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');window.__hipocampoLenis.scrollTo(ST.getById('hipocampo-house').end-1,{immediate:true});ST.update()}''')
    page.wait_for_function('window.__paletteHouse.renderer.getClearColor(new window.__paletteHouse.THREE.Color()).getHexString()==="f0d756"')
    check('saída da casa termina no amarelo da apresentação',True)
    scales=[band_to(page,p)for p in [-.05,.5,1.05,-.05]]
    check('faixa azul acompanha scroll e reverte sem novo pin',scales[0]<.01 and .1<scales[1]<.9 and scales[2]>.99 and scales[3]<.01,scales)
    band_to(page,1.05)
    page.wait_for_timeout(150)
    capture_section(page,'sobre',OUT/'after-sobre-1366.png')
    point=page.locator('.page4-color-band').evaluate('el=>{const b=el.getBoundingClientRect();return {x:24,y:Math.min(innerHeight-8,Math.floor(b.top+24))}}')
    pixel=Image.open(OUT/'after-sobre-1366.png').convert('RGB').getpixel((point['x'],point['y']))
    check('faixa azul está efetivamente pintada na captura',max(abs(a-b) for a,b in zip(pixel,(38,38,252)))<8,pixel)
    envelope=page.locator('.page4-photo--envelope');envelope.focus()
    src=page.locator('.page4-envelope-photo').get_attribute('src');envelope.press('ArrowRight')
    check('envelope mantém sua troca de fotografias',page.locator('.page4-envelope-photo').get_attribute('src')!=src)
    anchor(page,'sobre');page.wait_for_timeout(100)
    check('cabeçalho conserva contraste sobre a apresentação',page.locator('header').get_attribute('data-story-tone')=='paper' and page.locator('header > a').evaluate('el=>getComputedStyle(el).color')=='rgb(107, 49, 28)')
    page.evaluate('''async()=>{const{t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');const s=ST.getById('hipocampo-blue-band-header');window.__hipocampoLenis.scrollTo(s.start+12,{immediate:true});ST.update()}''')
    check('cabeçalho fica amarelo ao atravessar a faixa azul',page.locator('header').get_attribute('data-story-tone')=='dark' and page.locator('header > a').evaluate('el=>getComputedStyle(el).color')=='rgb(240, 215, 86)')
    anchor(page,'vestigios');page.mouse.move(10,700);page.mouse.wheel(0,150)
    page.wait_for_function('document.querySelector("header").dataset.storyTone==="split"')
    page.wait_for_function('getComputedStyle(document.querySelector("header nav a")).color==="rgb(107, 49, 28)"')
    header=page.locator('header').evaluate('el=>({tone:el.dataset.storyTone,logo:getComputedStyle(el.querySelector(":scope > a")).color,link:getComputedStyle(el.querySelector("nav a")).color,logoStyle:el.querySelector(":scope > a").getAttribute("style"),linkStyle:el.querySelector("nav a").getAttribute("style")})')
    check('cabeçalho usa amarelo à esquerda e marrom à direita na câmera',header['tone']=='split' and header['logo']=='rgb(240, 215, 86)' and header['link']=='rgb(107, 49, 28)',header)
    for _ in range(3):
        page.locator('.page5-shutter').click();page.wait_for_timeout(850)
    boxes=page.evaluate('''()=>{
      const protectedEls=[...document.querySelectorAll('.page5-text,.page5-camera-control,.page5-camera-hint,.page5-photo-duration,.page5-brand')].map(el=>el.getBoundingClientRect());
      return [...document.querySelectorAll('.page5-generated-photo')].map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,overlap:protectedEls.some(p=>Math.min(r.right,p.right)>Math.max(r.left,p.left)+1&&Math.min(r.bottom,p.bottom)>Math.max(r.top,p.top)+1)}});
    }''')
    check('fotos espalhadas preservam texto, disparador e marca',len(boxes)==3 and all(not b['overlap'] for b in boxes),boxes)
    page.mouse.move(4,880)
    capture_section(page,'vestigios',OUT/'after-vestigios-1366.png')
    page.set_viewport_size({'width':1600,'height':900});page.wait_for_timeout(300)
    check('1600×900: sem overflow horizontal',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    anchor(page,'abertura');page.wait_for_timeout(150)
    check('retorno à abertura restaura o cabeçalho original',page.locator('header').get_attribute('data-story-tone')is None and page.locator('header > a').evaluate('el=>getComputedStyle(el).color')=='rgb(255, 255, 255)')
    context.close()

def mobile(browser):
    context,page=open_page(browser,390,844,mobile=True)
    colours(page,'mobile');band_to(page,1.05)
    capture_section(page,'sobre',OUT/'after-sobre-390.png')
    anchor(page,'vestigios');page.locator('.page5-shutter').scroll_into_view_if_needed();page.wait_for_timeout(100)
    check('mobile: fundo marrom cobre o bloco do texto e câmera',page.locator('.page5-left').evaluate('el=>getComputedStyle(el,"::before").backgroundColor')=='rgb(107, 49, 28)')
    page.locator('.page5-shutter').tap();page.wait_for_function('document.querySelector(".page5-generated-photo")?.dataset.state==="visible"')
    photo=page.locator('.page5-generated-photo').bounding_box()
    check('mobile: foto aparece no trecho visível sem scroll automático',photo['y']<844 and photo['y']+photo['height']>0,photo)
    page.set_viewport_size({'width':375,'height':667});page.wait_for_timeout(200)
    check('mobile: resize mantém a foto dentro da seção',page.locator('.page5-generated-photo').evaluate('el=>{const p=el.getBoundingClientRect(),s=document.querySelector("#vestigios").getBoundingClientRect();return p.left>=s.left-1&&p.right<=s.right+1&&p.top>=s.top-1&&p.bottom<=s.bottom+1}'))
    check('375×667: sem overflow horizontal',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    page.emulate_media(reduced_motion='reduce');page.wait_for_timeout(150)
    check('movimento reduzido mantém a faixa azul completa',page.locator('.page4-color-band').evaluate('el=>new DOMMatrix(getComputedStyle(el).transform).a')>.99)
    context.close()
    context,page=open_page(browser,375,667,mobile=True)
    page.locator('.page5-shutter').scroll_into_view_if_needed()
    page.locator('.page5-shutter').tap();page.wait_for_function('document.querySelector(".page5-generated-photo")?.dataset.state==="visible"')
    capture_section(page,'vestigios',OUT/'after-vestigios-375.png')
    context.close()

try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('HIPOCAMPO_CHROME','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        desktop(browser);mobile(browser);browser.close()
    check('sem exceções JavaScript',not results['errors'],results['errors'])
    check('recursos locais disponíveis',not results['assets'],results['assets'])
finally:
    (OUT/'palette-qa-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
