"""Rendered photo colours on yellow vs. the same pixels on neutral white."""
import json
import os
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts' / 'image-refinement'
OUT.mkdir(parents=True, exist_ok=True)
URL = os.environ.get('HIPOCAMPO_QA_URL', 'http://127.0.0.1:4173/')
results = {'checks': [], 'errors': [], 'assets': []}


def check(name, ok, details=None):
    entry = {'name': name, 'passed': bool(ok)}
    if details is not None:
        entry['details'] = details
    results['checks'].append(entry)
    print(json.dumps(entry, ensure_ascii=False), flush=True)
    assert ok, name


def patch(image, x, y):
    return tuple(round(sum(image.getpixel((x+dx, y+dy))[c]
                           for dx in [-1, 0, 1] for dy in [-1, 0, 1])/9)
                 for c in range(3))


def treated_assets():
    mountain=Image.open(ROOT/'public/images/sobre/montanha-restaurada-v1.webp')
    film=Image.open(ROOT/'public/images/vestigios/filme-recortado-v1.webp')
    original=Image.open(ROOT/'public/images/sobre/montanha.webp')
    check('montanha restaurada tem mais que o dobro da resolução em cada eixo',
          mountain.width>=original.width*2 and mountain.height>=original.height*2,
          {'original':original.size,'restored':mountain.size})
    for name,image in [('montanha',mountain),('filme',film)]:
        check(f'{name}: transparência real no arquivo, com conteúdo opaco',
              image.mode=='RGBA' and image.getchannel('A').getextrema()==(0,255))
        points=[(0,0),(image.width-1,0),(0,image.height-1),(image.width-1,image.height-1)]
        check(f'{name}: os quatro cantos são transparentes',
              all(image.getpixel(p)[3]==0 for p in points))
    rocks=[mountain.getpixel((round(mountain.width*u),round(mountain.height*v)))[3]
           for u,v in [(.17,.51),(.84,.5),(.5,.5)]]
    check('rochas laterais e foto central permanecem opacas, sem perfuração pela luminosidade',
          all(a>=250 for a in rocks),rocks)
    surroundings=[film.getpixel((round(film.width*u),round(film.height*v)))[3]
                  for u,v in [(.05,.04),(.8,.85),(.95,.95)]]
    check('filme não conserva o retângulo de papel no entorno',
          all(a==0 for a in surroundings),surroundings)


def visit(browser, width, height):
    context = browser.new_context(viewport={'width': width, 'height': height},
                                  device_scale_factor=1,
                                  is_mobile=width < 760, has_touch=width < 760)
    page = context.new_page()
    page.on('pageerror', lambda e: results['errors'].append(str(e)))
    page.on('response', lambda r: results['assets'].append(f'{r.status} {r.url}')
            if r.status >= 400 and r.url.startswith(URL) else None)
    page.goto(URL, wait_until='networkidle')
    page.locator('.page5-shutter').wait_for(state='attached')
    page.evaluate('''async()=>{await document.fonts.ready;await Promise.all(
      [...document.querySelectorAll('#sobre img,#vestigios img')].map(i=>{
        i.loading='eager';return i.decode().catch(()=>{})}))}''')
    for section, anchor, samples in [
        ('sobre', '.page4-photos', [
            ('envelope', '.page4-photo--envelope', .45, .7),
            ('montanha', '.page4-photo--montanha', .5, .5)]),
        ('vestigios', '.page5-colagem', [
            ('filme', '.page5-filme', .45, .3)]),
    ]:
        page.evaluate('''selector=>{const el=document.querySelector(selector);
          __hipocampoLenis.scrollTo(el.getBoundingClientRect().top+scrollY-innerHeight*.18,
          {immediate:true})}''', anchor)
        page.mouse.move(-5, -5)
        page.wait_for_timeout(350)
        path = OUT / f'after-{section}-{width}.png'
        page.screenshot(path=str(path))
        image = Image.open(path).convert('RGB')
        boxes = {name: page.locator(selector).bounding_box()
                 for name, selector, _, _ in samples}
        white = page.add_style_tag(content='#sobre,#vestigios{background:#fff !important}')
        page.wait_for_timeout(100)
        reference_path = OUT / f'neutral-reference-{section}-{width}.png'
        page.screenshot(path=str(reference_path))
        reference = Image.open(reference_path).convert('RGB')
        white.evaluate('el=>el.remove()')
        for name, _, u, v in samples:
            r = boxes[name]
            x, y = round(r['x']+r['width']*u), round(r['y']+r['height']*v)
            actual, expected = patch(image, x, y), patch(reference, x, y)
            check(f'{width}: {name} mantém os tons naturais sobre o amarelo',
                  max(abs(a-b) for a, b in zip(actual, expected)) < 8,
                  {'onYellow': actual, 'onWhite': expected})
        if section == 'sobre':
            r = boxes['montanha']
            corners = [patch(image, round(r['x']+r['width']*u),
                             round(r['y']+r['height']*v))
                       for u, v in [(.04, .04), (.96, .04), (.04, .96), (.96, .96)]]
            check(f'{width}: montagem da montanha não deixa uma placa cinza nos cantos',
                  all(max(abs(a-b) for a, b in zip(pixel, (240, 215, 86))) < 8
                      for pixel in corners), corners)
            envelope = page.locator('.page4-photo--envelope')
            before = page.locator('.page4-envelope-photo').get_attribute('src')
            envelope.focus(); envelope.press('ArrowRight')
            check(f'{width}: envelope continua alternando fotografias',
                  page.locator('.page4-envelope-photo').get_attribute('src') != before)
        check(f'{width}: {section} sem overflow horizontal',
              page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    context.close()


try:
    treated_assets()
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('HIPOCAMPO_CHROME', '/usr/bin/chromium'),
                                    headless=True, args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        visit(browser, 1600, 900)
        visit(browser, 390, 844)
        browser.close()
    check('sem exceções JavaScript', not results['errors'], results['errors'])
    check('recursos locais disponíveis', not results['assets'], results['assets'])
finally:
    (OUT / 'qa-results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
