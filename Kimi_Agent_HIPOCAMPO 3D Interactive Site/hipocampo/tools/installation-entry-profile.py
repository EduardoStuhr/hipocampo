"""Compare the old and current entry with identical browser/scroll settings.

The baseline is served from Git in the browser routes; no checkout is modified.
Numbers describe this browser/GPU, not a cross-device performance guarantee.
"""
import json
import os
import subprocess
from pathlib import Path

from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parents[1]
ARTIFACTS = PROJECT / 'artifacts' / 'installation-navigation'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
URL = os.environ.get('HIPOCAMPO_QA_URL', 'http://127.0.0.1:4173/')
CHROME = os.environ.get('HIPOCAMPO_CHROME', '/usr/bin/chromium')
BASE = 'backup/instalacao-antes-camera-2026-11-03'
PREFIX = 'Kimi_Agent_HIPOCAMPO 3D Interactive Site/hipocampo/'


def profile(playwright, previous):
    browser = playwright.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width':1366,'height':768}, device_scale_factor=1, extra_http_headers={'Accept-Encoding':'identity'})
    if previous:
        sources = {
            path: subprocess.check_output(['git', 'show', f'{BASE}:{PREFIX}{path}'], cwd=PROJECT)
            for path in ['index.html', 'public/assets/installation-room.js', 'public/assets/installation-scene.js', 'public/assets/installation-room.css', 'public/assets/hero-motion.js']
        }
        page.route(URL, lambda route: route.fulfill(body=sources['index.html'], content_type='text/html'))
        for path in ['installation-room.js', 'installation-scene.js', 'installation-room.css', 'hero-motion.js']:
            source = sources[f'public/assets/{path}']
            page.route(f'**/assets/{path}*', lambda route, request, body=source, name=path: route.fulfill(body=body, content_type='text/css' if name.endswith('.css') else 'application/javascript'))
    page.goto(URL, wait_until='networkidle')
    # The reader spends five seconds in the preceding chapters. Both runs use
    # exactly the same delay, viewport, software GPU and physical wheel events.
    page.wait_for_timeout(5000)
    before = page.locator('#instalacao').evaluate('el=>!!el.installationRoom')
    page.evaluate('''() => {
      const room = document.querySelector('#instalacao');
      window.scrollTo({top:room.getBoundingClientRect().top+scrollY-innerHeight-1000,behavior:'instant'});
      window.__entryProfile={frames:[],tasks:[],running:true};
      let previous=performance.now();
      new PerformanceObserver(list=>{for(const task of list.getEntries()) __entryProfile.tasks.push({start:task.startTime,duration:task.duration})}).observe({type:'longtask'});
      function frame(time){
        if(!__entryProfile.running)return;
        __entryProfile.frames.push({time,dt:time-previous,y:scrollY,top:room.getBoundingClientRect().top,height:document.documentElement.scrollHeight,ready:!!room.installationRoom});
        previous=time;requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }''')
    for _ in range(23):
        page.mouse.wheel(0, 120)
        page.wait_for_timeout(65)
    page.wait_for_timeout(650)
    result = page.evaluate('()=>{__entryProfile.running=false;return __entryProfile}')
    result['readyBeforeApproach'] = before
    result['maxEntryFrameMs'] = max(frame['dt'] for frame in result['frames'] if -1200 < frame['top'] < 768)
    result['scrollReversals'] = sum(frame['y'] < old['y'] - 2 for old, frame in zip(result['frames'], result['frames'][1:]))
    label = 'baseline' if previous else 'current'
    (ARTIFACTS / f'entry-{label}.json').write_text(json.dumps(result, indent=2))
    print(json.dumps({'version':label,'readyBeforeApproach':before,'maxEntryFrameMs':result['maxEntryFrameMs'],'scrollReversals':result['scrollReversals'],'longTasks':result['tasks']}), flush=True)
    browser.close()
    return result


with sync_playwright() as playwright:
    before = profile(playwright, True)
    after = profile(playwright, False)
    summary = {
        'baselineMaxEntryFrameMs': before['maxEntryFrameMs'],
        'currentMaxEntryFrameMs': after['maxEntryFrameMs'],
        'currentReadyBeforeApproach': after['readyBeforeApproach'],
        'currentScrollReversals': after['scrollReversals'],
    }
    (ARTIFACTS / 'entry-comparison.json').write_text(json.dumps(summary, indent=2))
