"""Real browser gestures for entry, 360 camera and safe passage to fragments."""
import json
import math
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parents[1]
ARTIFACTS = PROJECT / 'artifacts' / 'installation-navigation'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
URL = os.environ.get('HIPOCAMPO_QA_URL', 'http://127.0.0.1:4173/')
CHROME = os.environ.get('HIPOCAMPO_CHROME', '/usr/bin/chromium')
results = {'checks': [], 'errors': []}


def check(name, passed, details=None):
    value = {'name': name, 'passed': bool(passed)}
    if details is not None:
        value['details'] = details
    results['checks'].append(value)
    print(json.dumps(value, ensure_ascii=False), flush=True)
    assert passed, name


def state(page):
    return page.locator('#instalacao').evaluate('el=>el.installationRoom.inspect()')


def settle(page):
    page.wait_for_function('document.querySelector("#instalacao")?.installationRoom?.inspect().framePending === false')


def scene_in_view(page):
    page.locator('.installation-stage').scroll_into_view_if_needed()
    page.wait_for_timeout(200)
    settle(page)
    return page.locator('.installation-stage').bounding_box()


def toggle_navigation(page):
    canvas = page.locator('.installation-canvas')
    canvas.focus()
    canvas.press('Enter')


def scroll_to_fragments(page):
    page.keyboard.press('Escape')
    distance = page.locator('#fragmentos').evaluate('el=>el.getBoundingClientRect().top')
    page.mouse.move(5, 500)
    page.mouse.wheel(0, max(300, distance))
    page.wait_for_function('''()=>{
      const r=document.querySelector('#fragmentos').getBoundingClientRect();
      return r.top < innerHeight * .6 && r.bottom > 0;
    }''', timeout=15000)


def drag_background(page, button='left', modifiers=False):
    box = scene_in_view(page)
    x, y = box['x'] + box['width'] * .85, max(150, box['y'] + 160)
    if modifiers:
        page.keyboard.down('Shift')
    page.mouse.move(x, y)
    page.mouse.down(button=button)
    page.mouse.move(box['x'] + box['width'] * .15, y + (35 if button != 'left' or modifiers else 0), steps=6)
    page.mouse.up(button=button)
    if modifiers:
        page.keyboard.up('Shift')
    settle(page)


def desktop(browser):
    context = browser.new_context(viewport={'width':1366, 'height':768}, device_scale_factor=1, extra_http_headers={'Accept-Encoding':'identity'})
    page = context.new_page()
    page.on('pageerror', lambda error: results['errors'].append(str(error)))
    page.on('console', lambda message: results['errors'].append(message.text) if message.type == 'error' and not message.text.startswith('Failed to load resource') else None)
    page.goto(URL, wait_until='networkidle')
    page.wait_for_function('document.querySelector("#instalacao")?.installationRoom != null')
    initial = state(page)
    check('preparada antes de entrar na sala', initial['prepared'] and not initial['visible'] and page.evaluate('scrollY') == 0, {'preparationMs': initial['preparationMs']})
    check('preparação não mantém renderização fora da tela', not initial['framePending'])
    scene_in_view(page)
    initial = state(page)
    page.locator('.installation-stage').screenshot(path=str(ARTIFACTS / 'cached-entry.png'))
    for _ in range(3):
        drag_background(page)
    rotated = state(page)
    check('giro real de mouse ultrapassa 360 graus', abs(rotated['camera']['yaw']) > math.tau, rotated['camera'])
    check('câmera converge suavemente e volta a ficar ociosa', rotated['camera'] == rotated['renderedCamera'] and not rotated['framePending'])
    check('girar preserva todos os objetos', rotated['objects'] == initial['objects'])
    page.locator('.installation-stage').screenshot(path=str(ARTIFACTS / 'orbit-360.png'))

    yaw = state(page)['camera']['yaw']
    drag_background(page, button='right')
    camera = state(page)['camera']
    check('botão direito desloca sem girar nem pegar objeto', camera['yaw'] == yaw and abs(camera['panX']) + abs(camera['panZ']) > .1 and state(page)['objects'] == initial['objects'])
    before = dict(camera)
    drag_background(page, modifiers=True)
    check('Shift e arrastar também desloca', state(page)['camera'] != before)
    page.get_by_role('button', name='visão inicial', exact=True).click()
    settle(page)
    check('visão inicial restaura todos os eixos da câmera', state(page)['camera'] == initial['camera'])

    for _ in range(8):
        page.get_by_role('button', name='aproximar', exact=True).click()
    settle(page)
    check('zoom chega perto dos objetos além do limite antigo', state(page)['camera']['distance'] < 6, state(page)['camera']['distance'])
    page.get_by_role('button', name='visão inicial', exact=True).click()
    settle(page)
    scene_in_view(page)
    toggle_navigation(page)
    check('modo explorar reserva eventos apenas da sala', state(page)['navigating'] and state(page)['scrollReserved'] and page.evaluate('document.body.style.overflow') != 'hidden')
    box = page.locator('.installation-stage').bounding_box()
    page.mouse.move(box['x'] + box['width'] / 2, max(220, box['y'] + 220))
    y = page.evaluate('scrollY')
    distance = state(page)['camera']['distance']
    page.mouse.wheel(0, -300)
    settle(page)
    check('roda aproxima no modo explorar sem mover a página', state(page)['camera']['distance'] < distance and abs(page.evaluate('scrollY') - y) < 2)

    page.locator('.installation-canvas').focus()
    before = state(page)['camera']
    page.keyboard.down('w')
    try:
        page.wait_for_function('(z)=>document.querySelector("#instalacao").installationRoom.inspect().camera.panZ !== z', arg=before['panZ'], timeout=5000)
    finally:
        page.keyboard.up('w')
    settle(page)
    check('WASD caminha pela cena', state(page)['camera']['panZ'] != before['panZ'])
    page.keyboard.press('Escape')
    check('Escape libera rolagem e capturas de ponteiro', not state(page)['navigating'] and not state(page)['scrollReserved'] and not state(page)['gesturesActive'])
    box = scene_in_view(page)
    page.mouse.move(box['x'] + box['width'] / 2, max(220, box['y'] + 220))
    y = page.evaluate('scrollY')
    camera = state(page)['camera']
    page.mouse.wheel(0, 480)
    page.wait_for_timeout(1000)
    check('roda continua a página após sair do modo explorar', page.evaluate('scrollY') > y + 100 and state(page)['camera'] == camera)

    scene_in_view(page)
    toggle_navigation(page)
    scroll_to_fragments(page)
    page.wait_for_timeout(350)
    top = page.locator('#fragmentos').evaluate('el=>el.getBoundingClientRect().top')
    check('rolagem chega à próxima seção e libera a sala', top < 768 and not state(page)['navigating'] and not state(page)['scrollReserved'], {'fragmentosTop': top})
    page.screenshot(path=str(ARTIFACTS / 'next-section.png'))
    y = page.evaluate('scrollY')
    page.mouse.move(600, 500)
    page.mouse.wheel(0, 300)
    page.wait_for_timeout(800)
    check('rolagem funciona dentro da próxima seção', page.evaluate('scrollY') > y + 100)

    scene_in_view(page)
    drag_background(page, button='right')
    before = state(page)['camera']
    page.set_viewport_size({'width':1280, 'height':720})
    settle(page)
    check('resize no mesmo layout não faz câmera voltar', state(page)['camera'] == before)
    toggle_navigation(page)
    page.evaluate('window.scrollTo({top:0,behavior:"instant"})')
    page.wait_for_timeout(700)
    check('sair da seção desativa navegação e renderização', not state(page)['navigating'] and not state(page)['scrollReserved'] and not state(page)['framePending'])
    context.close()


def mobile(browser):
    context = browser.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, is_mobile=True, has_touch=True, extra_http_headers={'Accept-Encoding':'identity'})
    page = context.new_page()
    page.on('pageerror', lambda error: results['errors'].append(str(error)))
    page.goto(URL, wait_until='networkidle')
    page.wait_for_function('document.querySelector("#instalacao")?.installationRoom != null')
    box = scene_in_view(page)
    toggle_navigation(page)
    session = context.new_cdp_session(page)
    x, y = box['x'] + 150, max(220, box['y'] + 200)
    session.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    for step in range(1, 9):
        session.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':x + step*13,'y':y}]})
    session.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
    settle(page)
    check('toque gira a câmera quando explorar está ativo', abs(state(page)['camera']['yaw']) > .2)
    page.keyboard.press('Escape')
    check('Escape remove a captura de gestos no mobile', not state(page)['navigating'] and not state(page)['scrollReserved'])
    scroll_to_fragments(page)
    check('mobile avança sem prender a próxima seção', page.locator('#fragmentos').evaluate('el=>el.getBoundingClientRect().top') < 844)
    context.close()


try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        desktop(browser)
        mobile(browser)
        browser.close()
    check('sem exceções ou erros de renderização', not results['errors'], results['errors'])
finally:
    (ARTIFACTS / 'navigation-results.json').write_text(json.dumps(results, indent=2, ensure_ascii=False))
