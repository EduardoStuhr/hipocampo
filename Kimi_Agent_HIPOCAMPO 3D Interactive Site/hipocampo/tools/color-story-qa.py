"""Original layout fidelity, simplified backgrounds and the house handoff."""
import json
import os
import subprocess
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts'/'white-backgrounds'
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

def open_page(browser,w,h,mobile=False,baseline=False):
    context=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1,is_mobile=mobile,has_touch=mobile)
    page=context.new_page()
    page.on('pageerror',lambda e:results['errors'].append(str(e)))
    page.on('response',lambda r:results['assets'].append(f'{r.status} {r.url}') if r.status>=400 and r.url.startswith(URL) else None)
    if baseline:
        # Read the actual pre-palette implementation; never synthesize expected
        # dimensions from the new CSS or mutate the running site for comparison.
        for name in ['page4-sobre.css','page4-sobre.js','page5-vestigios.css','page5-vestigios.js']:
            body=subprocess.check_output(['git','show',f'6c1f822:./public/assets/{name}'],cwd=ROOT,text=True)
            mime='text/css' if name.endswith('.css') else 'application/javascript'
            page.route(f'**/assets/{name}?*',lambda route,request,body=body,mime=mime:route.fulfill(body=body,content_type=mime))
    def house(route):
        response=route.fetch();body=response.text();needle='  const maxAniso ='
        assert body.count(needle)==1
        route.fulfill(response=response,body=body.replace(needle,'  window.__paletteHouse={renderer,THREE};\n'+needle))
    page.route('**/assets/page3-house.js?*',house)
    page.goto(URL,wait_until='networkidle');page.evaluate('document.fonts.ready')
    page.locator('.page5-shutter').wait_for(state='attached')
    page.evaluate('''async()=>{await Promise.all([...document.querySelectorAll('#sobre img,#vestigios img')].map(i=>{i.loading='eager';return i.decode().catch(()=>{})}));await document.fonts.ready}''')
    page.wait_for_timeout(200)
    return context,page

def geometry(page):
    return page.evaluate('''()=>{
      const selectors=['#sobre','.page4-title','.page4-text','.page4-photos','.page4-photo--retrato','.page4-photo--envelope','.page4-photo--montanha','#vestigios','.page5-left','.page5-text','.page5-camera-control','.page5-camera','.page5-camera-hint','.page5-right','.page5-colagem','.page5-filme','.page5-brand'];
      const data={};for(const selector of selectors){const el=document.querySelector(selector),r=el.getBoundingClientRect(),section=el.closest('section').getBoundingClientRect(),s=getComputedStyle(el);data[selector]={x:r.x-section.x,y:r.y-section.y,w:r.width,h:r.height,font:s.fontFamily,size:s.fontSize,line:s.lineHeight,spacing:s.letterSpacing}}
      const print=document.createElement('figure');print.className='page5-generated-photo';document.querySelector('.page5-revealed-photos').append(print);const r=print.getBoundingClientRect();data.print={w:r.width,h:r.height};print.remove();
      data.photos=[...document.querySelectorAll('.page4-photo > img,.page5-camera,.page5-colagem,.page5-filme')].map(i=>i.getAttribute('src'));
      return data;
    }''')

def original_layout(browser):
    for w,h in [(1600,900),(1366,768),(390,844),(375,667)]:
        records=[]
        for baseline in [True,False]:
            context,page=open_page(browser,w,h,mobile=w<760,baseline=baseline)
            records.append(geometry(page))
            if w in [1600,390]:
                prefix='original' if baseline else 'after'
                for id in ['sobre','vestigios']:
                    anchor(page,id);page.mouse.move(-5,-5);page.wait_for_timeout(350)
                    page.screenshot(path=str(OUT/f'{prefix}-{id}-{w}.png'))
                page.evaluate("()=>{const s=document.getElementById('vestigios');__hipocampoLenis.scrollTo(s.getBoundingClientRect().top+scrollY-innerHeight*.4,{immediate:true})}")
                page.wait_for_timeout(200);page.screenshot(path=str(OUT/f'{prefix}-seam-{w}.png'))
            context.close()
        before,after=records;differences=[]
        for selector,expected in before.items():
            if selector=='photos':continue
            for key,value in expected.items():
                actual=after[selector][key]
                if isinstance(value,(int,float)):
                    if abs(actual-value)>.75:differences.append([selector,key,value,actual])
                elif actual!=value:differences.append([selector,key,value,actual])
        check(f'{w}×{h}: tamanhos, posições e tipografia correspondem à versão anterior à paleta',not differences,differences)
        treated={'/images/sobre/montanha.webp':'/images/sobre/montanha-restaurada-v1.webp',
                 '/images/vestigios/filme.webp':'/images/vestigios/filme-recortado-v1.webp'}
        check(f'{w}×{h}: somente filme e montanha recebem as versões tratadas',
              [treated.get(src,src)for src in before['photos']]==after['photos'],after['photos'])
        (OUT/f'geometry-{w}.json').write_text(json.dumps({'original':before,'restored':after},ensure_ascii=False,indent=2))

def colours(page,label):
    data=page.evaluate('''()=>{
      const css=s=>getComputedStyle(document.querySelector(s));
      return {about:css('#sobre').backgroundColor,ink:css('.page4-text').color,title:css('.page4-title').color,border:css('#vestigios').borderTopWidth,
        camera:css('#vestigios').backgroundColor,text:css('.page5-text').color,brand:css('.page5-brand').color,
        hero:css('#abertura').backgroundColor,project:css('#projeto').backgroundColor};
    }''')
    check(f'{label}: apresentação branca preserva o marrom original',data['about']=='rgb(255, 255, 255)' and data['ink']=='rgb(122, 42, 23)' and data['title']==data['ink'],data)
    check(f'{label}: câmera branca com texto marrom e marca azul',data['camera']=='rgb(255, 255, 255)' and data['text']=='rgb(122, 42, 23)' and data['brand']=='rgb(38, 38, 252)')
    check(f'{label}: sem painéis coloridos ou borda extra na passagem',data['border']=='0px' and page.locator('.page4-color-band,.page5-color-panel').count()==0)
    check(f'{label}: abertura e Projeto mantêm as cores existentes',data['hero']=='rgb(23, 41, 255)' and data['project']=='rgb(255, 255, 255)')

def desktop(browser):
    context,page=open_page(browser,1366,900)
    colours(page,'desktop')
    page.wait_for_function('document.querySelector("#casa")?.houseJourney!=null')
    page.evaluate('''async()=>{const{t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');window.__hipocampoLenis.scrollTo(ST.getById('hipocampo-house').end-1,{immediate:true});ST.update()}''')
    page.wait_for_function('window.__paletteHouse.renderer.getClearColor(new window.__paletteHouse.THREE.Color()).getHexString()==="ffffff"')
    check('saída da casa termina no branco da apresentação',True)
    anchor(page,'sobre')
    capture_section(page,'sobre',OUT/'after-sobre-1366.png')
    page.evaluate("()=>{const s=document.getElementById('vestigios');__hipocampoLenis.scrollTo(s.getBoundingClientRect().top+scrollY-innerHeight*.4,{immediate:true})}")
    page.wait_for_timeout(300);page.screenshot(path=str(OUT/'after-seam-1366.png'))
    seam=page.locator('#vestigios').bounding_box()['y'];image=Image.open(OUT/'after-seam-1366.png').convert('RGB')
    probes=[(400,int(seam)-12,(255,255,255)),(400,int(seam)+12,(255,255,255)),(1350,int(seam)-12,(255,255,255)),(1350,int(seam)+12,(255,255,255))]
    pixels=[image.getpixel((x,y)) for x,y,_ in probes]
    check('divisa realmente pintada de branco nos dois lados, sem faixas',all(max(abs(a-b)for a,b in zip(pixel,expected))<8 for pixel,(_,_,expected)in zip(pixels,probes)),pixels)
    portrait=page.locator('.page4-photo--retrato').bounding_box()
    check('retrato conserva a travessia da divisa original',portrait['y']<seam<portrait['y']+portrait['height'],portrait)
    envelope=page.locator('.page4-photo--envelope');envelope.focus()
    src=page.locator('.page4-envelope-photo').get_attribute('src');envelope.press('ArrowRight')
    check('envelope mantém sua troca de fotografias',page.locator('.page4-envelope-photo').get_attribute('src')!=src)
    anchor(page,'sobre');page.wait_for_timeout(100)
    check('cabeçalho conserva contraste sobre a apresentação',page.locator('header').get_attribute('data-story-tone')=='paper' and page.locator('header > a').evaluate('el=>getComputedStyle(el).color')=='rgb(107, 49, 28)')
    anchor(page,'vestigios');page.mouse.move(10,700);page.mouse.wheel(0,150)
    page.wait_for_function('document.querySelector("header").dataset.storyTone==="paper"')
    page.wait_for_function('getComputedStyle(document.querySelector("header nav a")).color==="rgb(107, 49, 28)"')
    header=page.locator('header').evaluate('el=>({tone:el.dataset.storyTone,logo:getComputedStyle(el.querySelector(":scope > a")).color,link:getComputedStyle(el.querySelector("nav a")).color,logoStyle:el.querySelector(":scope > a").getAttribute("style"),linkStyle:el.querySelector("nav a").getAttribute("style")})')
    check('cabeçalho usa marrom legível sobre a câmera branca',header['tone']=='paper' and header['logo']=='rgb(107, 49, 28)' and header['link']=='rgb(107, 49, 28)',header)
    for _ in range(3):
        page.locator('.page5-shutter').click();page.wait_for_timeout(850)
    boxes=page.evaluate('''()=>{
      const protectedEls=[...document.querySelectorAll('.page5-text,.page5-camera-control,.page5-camera-hint,.page5-brand')].map(el=>el.getBoundingClientRect());
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
    colours(page,'mobile');anchor(page,'sobre')
    capture_section(page,'sobre',OUT/'after-sobre-390.png')
    anchor(page,'vestigios');page.locator('.page5-shutter').scroll_into_view_if_needed();page.wait_for_timeout(100)
    check('mobile: texto e câmera não recebem painel marrom',page.locator('.page5-left').evaluate('el=>getComputedStyle(el,"::before").content')=='none')
    page.locator('.page5-shutter').tap();page.wait_for_function('document.querySelector(".page5-generated-photo")?.dataset.state==="visible"')
    photo=page.locator('.page5-generated-photo').bounding_box()
    check('mobile: foto aparece no trecho visível sem scroll automático',photo['y']<844 and photo['y']+photo['height']>0,photo)
    page.set_viewport_size({'width':375,'height':667});page.wait_for_timeout(200)
    check('mobile: resize mantém a foto dentro da seção',page.locator('.page5-generated-photo').evaluate('el=>{const p=el.getBoundingClientRect(),s=document.querySelector("#vestigios").getBoundingClientRect();return p.left>=s.left-1&&p.right<=s.right+1&&p.top>=s.top-1&&p.bottom<=s.bottom+1}'))
    check('375×667: sem overflow horizontal',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    page.emulate_media(reduced_motion='reduce');page.wait_for_timeout(150)
    check('movimento reduzido mantém a composição sem faixas adicionais',page.locator('.page4-color-band').count()==0)
    context.close()
    context,page=open_page(browser,375,667,mobile=True)
    page.locator('.page5-shutter').scroll_into_view_if_needed()
    page.locator('.page5-shutter').tap();page.wait_for_function('document.querySelector(".page5-generated-photo")?.dataset.state==="visible"')
    capture_section(page,'vestigios',OUT/'after-vestigios-375.png')
    context.close()

try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('HIPOCAMPO_CHROME','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        original_layout(browser);desktop(browser);mobile(browser);browser.close()
    check('sem exceções JavaScript',not results['errors'],results['errors'])
    check('recursos locais disponíveis',not results['assets'],results['assets'])
finally:
    (OUT/'palette-qa-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
