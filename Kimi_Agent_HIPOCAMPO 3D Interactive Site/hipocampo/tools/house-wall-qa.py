"""Closure of the entrance when viewed from inside, with facade fit preserved."""
import json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('artifacts/house-wall');OUT.mkdir(parents=True,exist_ok=True)
r={'checks':[],'errors':[],'assets':[]}
def check(name,ok,data=None):
 r['checks'].append({'name':name,'passed':bool(ok),'data':data});print(name,ok,data,flush=True);assert ok,name
def go(page,p):
 page.evaluate('''async p=>{const{t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');const s=ST.getById('hipocampo-house');__hipocampoLenis.scrollTo(s.start+p*(s.end-s.start),{immediate:true});ST.update()}''',p)
 page.wait_for_function('p=>{const s=document.querySelector("#casa").houseJourney.inspect();return Math.abs(s.target-p)<.0004&&(Math.abs(s.progress-s.target)<.000001||(p>=.995&&s.progress>=.995))}',arg=p)
try:
 with sync_playwright()as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  for before,w,h in [(True,1366,768),(False,1366,768),(False,390,844)]:
   c=b.new_context(viewport={'width':w,'height':h},extra_http_headers={'Accept-Encoding':'identity'});page=c.new_page()
   page.on('pageerror',lambda e:r['errors'].append(str(e)));page.on('response',lambda e:r['assets'].append(e.url)if e.status>=400 and e.url.startswith('http://127.0.0.1:4173')else None)
   if before:
    source=subprocess.check_output(['git','show','14304d3:./public/assets/house-interior.js'],text=True)
    page.route('**/assets/house-interior.js?*',lambda route:route.fulfill(body=source,content_type='application/javascript'))
   def instrument(route):
    response=route.fetch();body=response.text();route.fulfill(response=response,body=body.replace('  const maxAniso =','  window.__wallQA={scene,camera,renderer,THREE};\n  const maxAniso =',1))
   page.route('**/assets/page3-house.js?*',instrument);page.goto('http://127.0.0.1:4173/',wait_until='networkidle');page.wait_for_function('document.querySelector("#casa")?.houseJourney?.inspect().prepared',timeout=60000)
   go(page,.72);page.wait_for_function('document.querySelector("#casa").houseJourney.inspect().view.available')
   page.mouse.move(w*.25,h*.45);page.mouse.down();page.mouse.move(w*.75,h*.45,steps=12);page.mouse.up()
   page.wait_for_function('()=>{const v=document.querySelector("#casa").houseJourney.inspect().view;return Math.abs(v.targetYaw-v.yaw)<.003}')
   page.screenshot(path=str(OUT/f'{"before"if before else "after"}-{w}.png'))
   if before: baseline_fit=page.locator('#casa').evaluate('e=>e.houseJourney.inspect().interior.doorway.modelFitResidualPx')
   if not before:
    data=page.evaluate('''()=>{const{scene,THREE}=__wallQA;scene.updateMatrixWorld(true);const wall=scene.getObjectByName('house-front-wall'),root=scene.getObjectByName('house-archive');const box=new THREE.Box3().setFromObject(wall),floor=root.position.y,width=innerWidth/innerHeight<.8?3.65:5.8;const hit=(x,y)=>new THREE.Raycaster(new THREE.Vector3(root.position.x+x,floor+y,-1),new THREE.Vector3(0,0,1)).intersectObject(wall).length;return {rootParent:wall.parent===root,min:box.min.toArray(),max:box.max.toArray(),floor,x:root.position.x,width,base:[hit(-width*.4,.01),hit(width*.4,.01)],sides:[hit(-width/2+.02,1),hit(width/2-.02,1)],roof:hit(0,3.62),door:hit(0,1),fit:document.querySelector('#casa').houseJourney.inspect().interior.doorway.modelFitResidualPx}}''')
    check(f'{w}: parede fica na estrutura reta da sala',data['rootParent'],data)
    check(f'{w}: parede alcança piso, teto e duas laterais',data['min'][0]<=data['x']-data['width']/2 and data['max'][0]>=data['x']+data['width']/2 and data['min'][1]<data['floor'] and data['max'][1]>=data['floor']+3.65)
    check(f'{w}: sem frestas na base ou nos cantos',all(data['base'])and all(data['sides'])and data['roof']>0)
    check(f'{w}: abertura calibrada da porta continua livre',data['door']==0 and abs(data['fit']-baseline_fit)<1e-9)
    page.locator('.page3-look-reset').click();go(page,.37)
    check(f'{w}: portal mantém a proteção da fachada',page.locator('#casa').evaluate('e=>e.houseJourney.inspect().interior.portalActive'))
    go(page,.72);page.locator('.page3-look-toggle').click();page.locator('.page3-look-toggle').press('ArrowLeft')
    page.wait_for_function('document.querySelector("#casa").houseJourney.inspect().view.yaw>.1')
    check(f'{w}: rotação livre continua funcionando',True)
    page.evaluate("()=>__hipocampoLenis.scrollTo(document.querySelector('#sobre'),{immediate:true})");page.wait_for_function('document.querySelector(".page3-look-controls").hidden')
    check(f'{w}: saída segue para a seção branca sem captura',page.locator('#sobre').evaluate('e=>Math.abs(e.getBoundingClientRect().top)<5&&getComputedStyle(e).backgroundColor==="rgb(255, 255, 255)"'))
   c.close()
  b.close()
 check('sem erros JavaScript',not r['errors'],r['errors']);check('sem recursos faltando',not r['assets'],r['assets'])
finally:(OUT/'results.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
