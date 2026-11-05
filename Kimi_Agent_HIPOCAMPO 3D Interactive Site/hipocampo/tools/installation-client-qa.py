"""Client audio requirements: empty table, collection, readable copy and handoff."""
import json
import math
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

PROJECT=Path(__file__).resolve().parents[1]
OUT=PROJECT/'artifacts'/'installation-client'
OUT.mkdir(parents=True,exist_ok=True)
URL=os.environ.get('HIPOCAMPO_QA_URL','http://127.0.0.1:4173/')
CHROME=os.environ.get('HIPOCAMPO_CHROME','/usr/bin/chromium')
results={'checks':[],'errors':[],'assets':[]}

def check(name,ok,details=None):
    item={'name':name,'passed':bool(ok)}
    if details is not None:item['details']=details
    results['checks'].append(item);print(json.dumps(item,ensure_ascii=False),flush=True)
    assert ok,name

def state(page):return page.locator('#instalacao').evaluate('el=>el.installationRoom.inspect()')

def settle(page):page.wait_for_function("document.querySelector('#instalacao')?.installationRoom?.inspect().framePending===false")

def anchor(page,id):
    page.evaluate('''async id=>{const {t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');window.__hipocampoLenis.scrollTo(document.getElementById(id),{immediate:true});ST.update()}''',id)

def house(page,p):
    page.evaluate('''async p=>{const {t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');const s=ST.getById('hipocampo-house');window.__hipocampoLenis.scrollTo(s.start+p*(s.end-s.start),{immediate:true});ST.update()}''',p)
    page.wait_for_function('''p=>{const s=document.querySelector('#casa').houseJourney.inspect();return Math.abs(s.target-p)<.0004&&s.progress===s.target}''',arg=p)
    return page.locator('#casa').evaluate('el=>el.houseJourney.inspect()')

def open_page(browser,w,h,reduced=False):
    context=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1,reduced_motion='reduce' if reduced else 'no-preference',extra_http_headers={'Accept-Encoding':'identity'})
    page=context.new_page()
    page.add_init_script('''(()=>{const observe=new MutationObserver(()=>{const field=document.querySelector('.hipocampo-memory-field');const chars=[...document.querySelectorAll('.memory-char')];if(field?.dataset.heroMotionReady!=='true'||!chars.length)return;window.__clientEntry={opacity:Math.min(...chars.map(c=>Number(getComputedStyle(c).opacity))),shift:Math.max(...chars.map(c=>{const t=getComputedStyle(c).transform;return t==='none'?0:Math.abs(new DOMMatrix(t).m42)}))};observe.disconnect()});observe.observe(document,{subtree:true,childList:true,attributes:true})})()''')
    page.on('pageerror',lambda e:results['errors'].append(str(e)))
    page.on('console',lambda m:results['errors'].append(m.text) if m.type=='error' and not m.text.startswith('Failed to load resource') else None)
    page.on('response',lambda r:results['assets'].append(f'{r.status} {r.url}') if r.status>=400 and r.url.startswith(URL) else None)
    page.goto(URL,wait_until='networkidle')
    page.wait_for_function("document.querySelector('#casa')?.houseJourney!=null&&window.__clientEntry!=null")
    return context,page

def layout_checks(browser):
    context,page=open_page(browser,1366,768)
    entry=page.evaluate('window.__clientEntry')
    check('letras visíveis desde a primeira composição, sem entrada aleatória',entry['opacity']>=.99 and entry['shift']<.01,entry)
    box=page.locator('.hipocampo-memory-field').bounding_box()
    page.mouse.move(box['x']+box['width']*.5,box['y']+box['height']*.5)
    page.wait_for_function("[...document.querySelectorAll('.memory-char')].some(c=>{const t=getComputedStyle(c).transform;return t!=='none'&&Math.abs(new DOMMatrix(t).m42)>1})")
    check('movimento das letras com o mouse preservado',True)
    check('fotografias da abertura e círculo preservados',page.locator('.hipocampo-transition-circle').count()==1 and page.locator('#abertura img').count()>0)
    for w,h in [(1366,768),(1024,768),(390,844)]:
        page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(450);anchor(page,'projeto');page.wait_for_timeout(250)
        layout=page.evaluate('''()=>{const copy=document.querySelector('.hipocampo-page2-copy'),style=getComputedStyle(copy);const paragraphs=[...copy.querySelectorAll('p')];return {paragraphs:paragraphs.length,lineHeight:parseFloat(style.lineHeight)/parseFloat(style.fontSize),contentBottom:copy.getBoundingClientRect().bottom,casaTop:document.querySelector('#casa').getBoundingClientRect().top,overflow:document.documentElement.scrollWidth>innerWidth}}''')
        check(f'{w}: texto separado em quatro parágrafos com respiro',layout['paragraphs']==4 and layout['lineHeight']>=1.45,layout)
        check(f'{w}: sem overflow horizontal',not layout['overflow'])
        if w<=1100:check(f'{w}: casa começa depois da leitura completa',layout['contentBottom']<layout['casaTop'],layout)
        page.screenshot(path=str(OUT/f'project-{w}.png'))
        first=house(page,.2);inside=house(page,.6);back=house(page,.2)
        check(f'{w}: travessia e retorno da casa preservados',inside['camera'][2]<0 and math.dist(first['camera'],back['camera'])<.035)
        anchor(page,'sobre');page.wait_for_timeout(300)
        check(f'{w}: próxima seção da casa alcançável',abs(page.locator('#sobre').evaluate('el=>el.getBoundingClientRect().top'))<3)
    context.close()

def collection_checks(browser):
    context,page=open_page(browser,1366,900,reduced=True)
    anchor(page,'instalacao');page.wait_for_function("document.querySelector('#instalacao')?.installationRoom!=null");settle(page)
    initial=state(page)
    check('mesa de luz vazia no início',not any(o['atTable'] for o in initial['objects']))
    check('nomes flutuantes retirados',page.locator('.installation-island,.installation-labels').count()==0)
    data=page.evaluate('''async()=>{const {COLLECTION,FRAGMENTS,expandCollection}=await import('/assets/installation-collection.js?v=client-1');const cd=COLLECTION.find(c=>c.number===72);const variants=expandCollection([{...cd,variants:[{image:'a'},{image:'b'}]}]);return {numbers:COLLECTION.map(c=>c.number),members:[1,4,69].map(n=>COLLECTION.find(c=>c.number===n).members.length),letters:COLLECTION.filter(c=>c.number>=5&&c.number<=7).map(c=>c.sharedSetup),vinyls:COLLECTION.filter(c=>c.kind==='vinyl').length,frames:COLLECTION.filter(c=>c.kind==='frame').length,cd:variants.map(c=>({id:c.id,y:c.position[1]})),chemicals:FRAGMENTS.filter(c=>c.kind==='chemical').map(c=>c.island)}}''')
    check('75 posições numeradas sem duplicação',data['numbers']==list(range(1,76)))
    check('conjuntos de roupas, costura e sapatos mantidos juntos',data['members']==[3,3,2])
    check('cartas compartilham enquadramento; seis vinis e cinco porta-retratos',data['letters']==['cartas']*3 and data['vinyls']==6 and data['frames']==5)
    check('um registro por foto de CD sem superfícies coplanares',len({c['id']for c in data['cd']})==2 and data['cd'][0]['y']!=data['cd'][1]['y'])
    check('químicos somente na geladeira',data['chemicals']==['fridge']*4)
    page.locator('.installation-stage').screenshot(path=str(OUT/'empty-desktop.png'))
    page.locator('.installation-accessible summary').click()
    search=page.get_by_label('buscar no acervo');search.fill('bolsa')
    check('busca encontra o conjunto inteiro por um dos seus objetos',page.locator('.installation-accessible li').count()==1 and 'Casaco, camiseta e bolsa' in page.locator('.installation-accessible li').inner_text())
    page.locator('.installation-accessible').get_by_role('button',name='Casaco, camiseta e bolsa',exact=True).click()
    check('escolha na lista leva o conjunto à mesa mesmo fora da tela',next(o for o in state(page)['objects']if o['number']==1)['atTable'])
    search.fill('31');check('busca pela numeração da cliente',page.locator('.installation-accessible li').count()==1)
    page.locator('.installation-accessible').get_by_role('button',name='Livro 1',exact=True).click()
    check('livro da prateleira passa a fazer parte da mesa',next(o for o in state(page)['objects']if o['number']==31)['atTable'])
    page.locator('[data-action="reset"]').click();settle(page)
    check('recompor devolve todos os objetos e deixa a mesa vazia',state(page)['objects']==initial['objects'])
    page.evaluate("()=>{const room=document.querySelector('#instalacao').installationRoom;room.inspect().objects.forEach(o=>room.moveToTable(o.id))}")
    placed=state(page)['objects']
    check('todos os 75 registros e quatro químicos podem ser escolhidos',len(placed)==79 and all(o['atTable'] for o in placed))
    check('coleção ampliada permanece sobre o tampo, sem filas fora da mesa',all(abs(o['footprint']['x'])+o['footprint']['width']/2<=2.126 and abs(o['footprint']['z'])+o['footprint']['depth']/2<=1.141 for o in placed))
    page.locator('[data-action="reset"]').click();settle(page)
    check('recompor a coleção inteira restaura escala e origem',state(page)['objects']==initial['objects'])
    page.locator('.installation-stage').scroll_into_view_if_needed();settle(page)
    for id in ['objeto-01','objeto-69','objeto-31','frasco-ambar']:
        page.evaluate('id=>document.querySelector("#instalacao").installationRoom.moveToTable(id)',id)
    settle(page);page.locator('.installation-stage').screenshot(path=str(OUT/'chosen-desktop.png'))
    context.close()

def native_drag_checks(browser):
    context,page=open_page(browser,1366,900)
    page.locator('.installation-stage').scroll_into_view_if_needed();settle(page)
    for id,label in [('objeto-01','conjunto de roupas do cabideiro'),('objeto-31','livro da prateleira'),('objeto-69','sapatos do chão'),('objeto-26','porta-retrato da escrivaninha')]:
        page.evaluate("document.querySelector('#instalacao').installationRoom.reset()")
        settle(page)
        page.locator('.installation-stage').scroll_into_view_if_needed()
        source=page.locator(f'[data-object="{id}"]').bounding_box()
        stage=page.locator('.installation-stage').bounding_box()
        point=state(page)['lightTable']
        page.mouse.move(source['x']+source['width']/2,source['y']+source['height']/2)
        page.mouse.down()
        page.mouse.move(stage['x']+point['x'],stage['y']+point['y'],steps=12)
        page.mouse.up();settle(page)
        current=state(page)
        item=next(o for o in current['objects']if o['id']==id)
        check(f'arraste real leva {label} até a mesa',item['atTable'] and item['parent']=='future',{'selected':current['selectedId'],'object':item})
    page.locator('[data-action="reset"]').click()
    settle(page)
    page.locator('.installation-stage').screenshot(path=str(OUT/'empty-desktop.png'))
    for id in ['objeto-01','objeto-69','objeto-31','frasco-ambar']:
        page.evaluate('id=>document.querySelector("#instalacao").installationRoom.moveToTable(id)',id)
    settle(page);page.locator('.installation-stage').screenshot(path=str(OUT/'chosen-desktop.png'))
    context.close()

try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=CHROME,headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        layout_checks(browser)
        collection_checks(browser)
        native_drag_checks(browser)
        browser.close()
    check('sem exceções ou erros de shader',not results['errors'],results['errors'])
    check('recursos locais carregados',not results['assets'],results['assets'])
finally:
    (OUT/'client-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
