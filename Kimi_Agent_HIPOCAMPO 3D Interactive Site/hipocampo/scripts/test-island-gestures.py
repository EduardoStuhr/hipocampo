"""Real-browser regression for captions, camera shutter and island gesture RAF.

Start PORT=4173 npm run dev, then run python scripts/test-island-gestures.py.
No scene or network response is mocked. Evidence: artifacts/island-gestures.
"""
import asyncio
import json
import os
from pathlib import Path

from playwright.async_api import async_playwright


OUT = Path(__file__).resolve().parents[1] / 'artifacts' / 'island-gestures'


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            executable_path=os.getenv('CHROMIUM_PATH', '/usr/bin/chromium'),
            headless=True,
            args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        )
        page = await browser.new_page(viewport={'width': 960, 'height': 650})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda message: errors.append(message.text)
                if message.type == 'error' and 'Shader Error' in message.text else None)
        await page.goto(os.getenv('HOUSE_TEST_URL', 'http://127.0.0.1:4173/'), wait_until='domcontentloaded')
        await page.wait_for_selector('.page5-shutter', state='attached')
        await page.wait_for_function('window.__hipocampoLenis')
        assert await page.locator('.page3-caption').count() == 0
        assert await page.locator('.page5-camera-hint').count() == 0

        # Removing the visible hint must preserve both the actual shutter and
        # its accessible, live description, along with the five-second photos.
        shutter = page.locator('.page5-shutter')
        description = await shutter.get_attribute('aria-describedby')
        assert description == 'page5-camera-status'
        assert await page.locator('#' + description).count() == 1
        await shutter.evaluate("el=>__hipocampoLenis.scrollTo(el,{immediate:true,force:true,offset:-250})")
        await shutter.click()
        photo = page.locator('.page5-generated-photo').first
        await photo.wait_for(state='attached')
        await page.wait_for_function("document.querySelector('.page5-generated-photo img')?.naturalWidth>0")
        await page.screenshot(path=str(OUT / 'camera-photo.png'))
        await page.wait_for_function("document.querySelectorAll('.page5-generated-photo').length===0", timeout=7500)

        await page.wait_for_selector('#instalacao')
        async def visit():
            await page.evaluate("__hipocampoLenis.scrollTo(document.querySelector('#instalacao .installation-stage'),{immediate:true,force:true,offset:-110})")
            await page.wait_for_timeout(350)
        await visit()
        await page.wait_for_function("document.querySelector('#instalacao')?.installationRoom?.inspect().prepared", timeout=120000)
        await visit()
        root = page.locator('#instalacao')
        async def state():
            return await root.evaluate('el=>el.installationRoom.inspect()')

        # Use the public action and observe the actual animation clock inside
        # the page; a slow GPU must not stretch the nominal .65s into seconds.
        motion = await root.evaluate('''async el=>{
            const api=el.installationRoom, start=performance.now();
            api.moveToTable('objeto-02');
            const started=api.inspect().movingObjects>0;
            while(api.inspect().movingObjects>0) {
                if(performance.now()-start>6000) throw new Error('Object motion did not settle');
                await new Promise(resolve=>requestAnimationFrame(resolve));
            }
            return {started,elapsedMs:performance.now()-start};
        }''')
        assert motion['started'], motion
        assert 600 <= motion['elapsedMs'] < 2200, motion
        await root.locator('[data-action=top-view]').click()
        await page.wait_for_timeout(800)
        target = root.locator('[data-object="objeto-02"]')
        bounds = await target.bounding_box()
        assert bounds, 'Table print has no pointer target'
        x, y = bounds['x'] + bounds['width'] / 2, bounds['y'] + bounds['height'] / 2
        before = next(item for item in (await state())['objects'] if item['id'] == 'objeto-02')
        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.mouse.move(x + 25, y + 12, steps=4)
        await page.wait_for_timeout(1000)
        held = await state()
        assert held['gesturesActive'] and held['framePending'], held
        await page.wait_for_timeout(350)
        idle = await state()
        assert idle['gesturesActive'] and idle['framePending'], idle
        # One resolution adjustment may render during this stationary hold.
        assert idle['renderedFrames'] - held['renderedFrames'] <= 1, (held, idle)
        await page.mouse.up()
        await page.wait_for_function("document.querySelector('#instalacao').installationRoom.inspect().movingObjects===0")
        after = await state()
        moved = next(item for item in after['objects'] if item['id'] == 'objeto-02')
        assert moved['atTable'] and moved['position'] != before['position'], (before, moved)
        assert not after['gesturesActive']
        await page.screenshot(path=str(OUT / 'table-drag.png'))
        await page.evaluate("__hipocampoLenis.scrollTo(document.querySelector('#instalacao').nextElementSibling,{immediate:true,force:true})")
        await page.wait_for_timeout(350)
        assert not (await state())['scrollReserved']
        assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert not errors, errors
        result = {
            'captionsRemoved': 3, 'shutterAndPhotoLifetime': True,
            'motion': motion, 'heldGestureKeepsSampling': True,
            'stationaryHoldRenderCount': idle['renderedFrames'] - held['renderedFrames'],
            'tableObjectMoved': True, 'errors': errors,
        }
        (OUT / 'result.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(result), flush=True)
        await browser.close()


asyncio.run(main())
