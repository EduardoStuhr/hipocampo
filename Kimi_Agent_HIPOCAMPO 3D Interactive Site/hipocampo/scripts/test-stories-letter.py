"""Verify the letter precedes the honest empty stories state on desktop/mobile."""
import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path(__file__).resolve().parents[1]/'artifacts'/'stories-letter'
OUT.mkdir(parents=True,exist_ok=True)
async def check(browser,w,h,reduced=False):
 p=await browser.new_page(viewport={'width':w,'height':h},is_mobile=w<768,has_touch=w<768,reduced_motion='reduce'if reduced else'no-preference')
 errors=[];missing=[]
 p.on('pageerror',lambda e:errors.append(str(e)))
 p.on('response',lambda r:missing.append(r.url)if r.status>=400 and '127.0.0.1' in r.url else None)
 await p.goto(os.environ.get('HIPOCAMPO_TEST_URL','http://127.0.0.1:4180/'),wait_until='domcontentloaded')
 await p.wait_for_selector('#relatos[data-letter-ready]');await p.keyboard.press('Escape')
 await p.wait_for_function("!document.querySelector('.hipocampo-intro')")
 await p.evaluate('document.fonts.ready')
 async def go(selector):
  await p.evaluate('(s)=>{__hipocampoLenis.resize();__hipocampoLenis.scrollTo(document.querySelector(s),{immediate:true,force:true})}',selector)
  await p.wait_for_timeout(500)
 root=p.locator('#relatos');button=root.locator('.stories-envelope-toggle');letter=root.locator('.stories-letter-paper')
 assert await root.count()==1
 assert await letter.is_hidden()
 assert await button.get_attribute('aria-expanded')=='false'
 assert await root.locator('.stories-empty').inner_text()=='Relatos em breve.'
 assert await root.locator('form,input,textarea,blockquote').count()==0
 await go('#relatos')
 await root.locator('img').evaluate('(e)=>e.decode()')
 assert await p.locator('#root > header').get_attribute('data-nav-theme')=='dark'
 await root.screenshot(path=str(OUT/f'closed-{w}-{reduced}.png'),style='#root > header, #root > header *, #root > a { visibility:hidden!important }')
 if w>=768:await button.focus();await button.press('Enter')
 else:await button.tap()
 await p.wait_for_timeout(1300)
 assert await letter.is_visible()
 assert await button.get_attribute('aria-expanded')=='true'
 assert await p.evaluate('document.activeElement.id')=='relatos-carta'
 assert await root.locator('.stories-letter-signoff span').inner_text()=='Hipocampo'
 assert await letter.evaluate('(e)=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth}')
 assert await p.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 if reduced:assert await letter.evaluate('(e)=>getComputedStyle(e).animationName')=='none'
 await letter.screenshot(path=str(OUT/f'letter-{w}-{reduced}.png'))
 await root.screenshot(path=str(OUT/f'open-{w}-{reduced}.png'),style='#root > header, #root > header *, #root > a { visibility:hidden!important }')
 await letter.press('Escape');await p.wait_for_timeout(1000)
 assert await letter.is_hidden()
 assert await button.get_attribute('aria-expanded')=='false'
 assert await p.evaluate('document.activeElement.classList.contains("stories-envelope-toggle")')
 await button.click();await p.wait_for_timeout(1000);await button.click();await p.wait_for_timeout(1000)
 assert await letter.is_hidden()
 await go('#relatos .stories-voices');assert await p.locator('#root > header').get_attribute('data-nav-theme')=='light'
 assert await root.evaluate('(e)=>e.querySelector(".stories-correspondence").compareDocumentPosition(e.querySelector(".stories-voices"))&Node.DOCUMENT_POSITION_FOLLOWING')
 assert await p.locator('#informacoes .team-credit').count()==10
 assert not errors,errors
 assert not missing,missing
 print(json.dumps({'viewport':[w,h],'reducedMotion':reduced,'openClose':True,'keyboardOrTouch':True,'focusReturn':True,'headerThemes':True,'storiesAfterLetter':True,'teamPreserved':True,'errors':errors,'missingFiles':missing}),flush=True)
 await p.close()
async def main():
 async with async_playwright() as pw:
  b=await pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  for args in [(1440,1000),(390,844),(320,640),(390,844,True)]:await check(b,*args)
  await b.close()
if __name__=='__main__':asyncio.run(main())
