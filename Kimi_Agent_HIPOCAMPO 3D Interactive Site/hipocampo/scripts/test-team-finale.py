"""Browser checks for the alphabetical project credits and portrait interactions."""
import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path(__file__).resolve().parents[1]/'artifacts'/'team-credits'
OUT.mkdir(parents=True,exist_ok=True)
EXPECTED=[
 ('Beatriz Rangel','Direção de Som + Assistência de Produção','beatriz'),
 ('Gabriel Orlando','Direção de Arte + Cenografia','gabriel'),
 ('Guilherme Brandão','Direção de Experiência + Mediação + Assistência de Produção','guilherme'),
 ('Heitor Lopes','Direção de Fotografia + Documentação','heitor'),
 ('Heloísa Miranda','Direção de Fotografia + Documentação + Assistência de Produção','heloiza'),
 ('Lara Sanchez','Direção de Arte + Cenografia','lara'),
 ('Marcos Bonavita','Assistência de Som + Trilha Sonora',None),
 ('Mariana Teixeira','Direção Criativa + Direção de Produção','mariana'),
 ('Raphael Cardoso','Direção de Experiência + Mediação','raphael'),
 ('Tiago Chaves','Assistência de Som + Trilha Sonora','tiago')]
async def check(browser,w,h,reduced=False):
 p=await browser.new_page(viewport={'width':w,'height':h},is_mobile=w<768,has_touch=w<768,reduced_motion='reduce'if reduced else'no-preference')
 errors=[];missing=[]
 p.on('pageerror',lambda e:errors.append(str(e)))
 p.on('response',lambda r:missing.append(r.url)if r.status>=400 and '127.0.0.1' in r.url else None)
 await p.goto(os.environ.get('HIPOCAMPO_TEST_URL','http://127.0.0.1:4173/'),wait_until='domcontentloaded')
 await p.wait_for_selector('.team-credit-grid');await p.keyboard.press('Escape')
 await p.wait_for_function("!document.querySelector('.hipocampo-intro')")
 await p.evaluate('document.fonts.ready')
 async def go(selector):
  await p.evaluate('(s)=>{const e=document.querySelector(s);__hipocampoLenis.resize();__hipocampoLenis.scrollTo(e,{immediate:true,force:true,offset:-120})}',selector)
  await p.wait_for_timeout(300)
 root=p.locator('#informacoes');items=root.locator('.team-credit')
 assert await items.count()==10
 assert await items.locator('h3').all_text_contents()==[e[0] for e in EXPECTED]
 assert await items.locator('.team-credit-roles').all_text_contents()==[e[1] for e in EXPECTED]
 assert await root.locator('.team-letter,.team-portrait-fan').count()==0
 assert await items.locator('img').count()==9
 for i,(_,_,image) in enumerate(EXPECTED):
  await go(f'.team-credit:nth-child({i+1})')
  card=items.nth(i)
  if image:
   img=card.locator('img')
   assert await img.get_attribute('src')==f'/images/team/{image}.webp'
   await img.evaluate('(e)=>e.decode()')
  else:assert await card.locator('img,button').count()==0
 await go('.team-credit:first-child');await p.wait_for_timeout(800)
 portrait=items.first.locator('button');img=portrait.locator('img')
 baseline=await img.evaluate('(e)=>getComputedStyle(e).transform')
 if w>=768:
  await portrait.hover();await p.wait_for_timeout(750)
  hover=await img.evaluate('(e)=>getComputedStyle(e).transform')
  assert (baseline==hover)if reduced else(baseline!=hover)
  await p.screenshot(path=str(OUT/f'hover-{w}-{reduced}.png'))
  await p.mouse.move(2,2)
 await portrait.click();assert await portrait.get_attribute('aria-pressed')=='true'
 assert 'is-active' in await items.first.get_attribute('class')
 await portrait.press('Escape');await portrait.evaluate('(e)=>e.blur()');assert await portrait.get_attribute('aria-pressed')=='false'
 await p.mouse.move(2,2);await p.wait_for_timeout(700)
 assert await p.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 cols=await root.locator('.team-credit-grid').evaluate('(e)=>getComputedStyle(e).gridTemplateColumns.split(" ").length')
 assert cols==(4 if w>900 else 2)
 if reduced:
  assert await root.locator('.team-photo-float').first.evaluate('(e)=>getComputedStyle(e).animationName')=='none'
 assert await items.locator('h3 .hip-line-mask').count()==0
 await root.screenshot(path=str(OUT/f'grid-{w}-{reduced}.png'),animations='disabled',style='#root > header, #root > header *, a[href="#conteudo"] { visibility:hidden !important; }')
 await go('#projeto');await p.wait_for_timeout(400)
 assert await root.locator('.team-in-view').count()==0
 assert not errors,errors
 assert not missing,missing
 print(json.dumps({'viewport':[w,h],'reducedMotion':reduced,'credits':10,'portraits':9,'alphabetical':True,'roles':True,'columns':cols,'interaction':True,'offscreenPaused':True,'errors':errors,'missingFiles':missing}),flush=True)
 await p.close()
async def main():
 async with async_playwright() as pw:
  b=await pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  for args in [(1440,1000),(390,844),(320,640),(1440,1000,True),(390,844,True)]:await check(b,*args)
  await b.close()
if __name__=='__main__':asyncio.run(main())
