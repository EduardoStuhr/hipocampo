"""Browser checks for the real WebGL installation (requires Python Playwright)."""
import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

PROJECT = Path(__file__).resolve().parents[1]
ARTIFACTS = PROJECT / "artifacts" / "installation"
ARTIFACTS.mkdir(parents=True, exist_ok=True)
URL = os.environ.get("HIPOCAMPO_QA_URL", "http://127.0.0.1:4173/")
CHROME = os.environ.get("HIPOCAMPO_CHROME", "/usr/bin/chromium")
RESULT = {"checks": [], "page_errors": [], "local_errors": [], "external_failures": []}


def check(name, condition, details=None):
    item = {"name": name, "passed": bool(condition)}
    if details is not None:
        item["details"] = details
    RESULT["checks"].append(item)
    print(json.dumps(item, ensure_ascii=False), flush=True)
    assert condition, name


def state(page):
    return page.locator("#instalacao").evaluate("el => el.installationRoom.inspect()")


def fragment(page, name):
    return next(item for item in state(page)["objects"] if item["id"] == name)


def settle(page):
    page.wait_for_function("""() => {
      const room = document.querySelector('#instalacao')?.installationRoom;
      return room && !room.inspect().framePending;
    }""")


def center(locator):
    box = locator.bounding_box()
    return box["x"] + box["width"] / 2, box["y"] + box["height"] / 2


def open_room(browser, width=1592, height=1132, mobile=False, reduced=False):
    context = browser.new_context(
        viewport={"width": width, "height": height}, device_scale_factor=1,
        has_touch=mobile, is_mobile=mobile,
        reduced_motion="reduce" if reduced else "no-preference",
        # Avoid the development server's length-based compression cache while
        # iterating on equal-length source edits. Production build is static.
        extra_http_headers={"Accept-Encoding": "identity"},
    )
    page = context.new_page()
    page.on("pageerror", lambda error: RESULT["page_errors"].append(str(error)))
    page.on("console", lambda message: RESULT["page_errors"].append(message.text)
            if message.type == "error" and not message.text.startswith("Failed to load resource") else None)
    page.on("response", lambda response: RESULT["local_errors"].append(f"{response.status} {response.url}")
            if response.status >= 400 and response.url.startswith(URL) else None)
    page.on("requestfailed", lambda request: RESULT["external_failures"].append({"url": request.url, "error": request.failure})
            if not request.url.startswith(URL) else RESULT["local_errors"].append(request.url))
    page.goto(URL, wait_until="networkidle")
    page.locator("#instalacao").scroll_into_view_if_needed()
    page.wait_for_function("document.querySelector('#instalacao')?.installationRoom != null")
    page.wait_for_timeout(350)
    settle(page)
    return context, page


def desktop_checks(browser):
    context, page = open_room(browser)
    initial = state(page)
    check("WebGL real, quatro ilhas e oito fragmentos", initial["renderer"] == "WebGL" and len(initial["objects"]) == 8 and page.locator(".installation-island:visible").count() == 4)
    check("cena ociosa não mantém animação contínua", not initial["framePending"])
    check("seções originais preservadas", page.locator("section").evaluate_all("els => els.map(el => el.id)") == ["abertura", "projeto", "casa", "sobre", "vestigios", "oficina", "instalacao", "fragmentos", "fotofilmes", "informacoes"])
    check("uma única instalação", page.locator("#instalacao").count() == 1)
    page.locator(".installation-stage").screenshot(path=str(ARTIFACTS / "desktop-stage.png"))
    page.locator("#instalacao").screenshot(path=str(ARTIFACTS / "desktop-section.png"))

    # A real mouse gesture moves a bottle from another island to the light table.
    source = page.locator('[data-object="frasco-ambar"]')
    source.scroll_into_view_if_needed()
    sx, sy = center(source)
    dx, dy = center(page.locator('[data-object="aves"]'))
    page.mouse.move(sx, sy)
    page.mouse.down()
    page.mouse.move(dx + 24, dy, steps=18)
    page.mouse.up()
    settle(page)
    check("arrastar entre ilhas leva frasco à mesa", fragment(page, "frasco-ambar")["parent"] == "future", fragment(page, "frasco-ambar"))
    check("arrastar objeto não gira câmera", state(page)["camera"] == initial["camera"])
    check("memória acompanha a seleção", "promessa de uma imagem" in page.locator(".installation-memory-text").inner_text())
    page.locator(".installation-stage").screenshot(path=str(ARTIFACTS / "desktop-dragged.png"))
    page.locator('[data-action="reset"]').click()
    settle(page)
    check("recompor restaura posições, ilhas e câmera", state(page)["objects"] == initial["objects"] and state(page)["camera"] == initial["camera"])

    target = page.locator('[data-object="retrato"]')
    target.focus()
    target.press("Enter")
    settle(page)
    check("Enter leva fotografia à mesa", fragment(page, "retrato")["parent"] == "future")
    old_x = fragment(page, "retrato")["position"][0]
    target.press("ArrowRight")
    settle(page)
    check("setas deslocam o objeto", fragment(page, "retrato")["position"][0] > old_x)
    target.press("Escape")
    settle(page)
    check("Escape devolve à ilha original", fragment(page, "retrato")["parent"] == "past")

    page.locator('[data-action="fridge"]').click()
    settle(page)
    closed = state(page)
    check("porta fecha e luz vermelha apaga", not closed["fridgeOpen"] and closed["doorAngle"] == 0 and closed["redLightIntensity"] == 0 and closed["redSpillIntensity"] == 0)
    check("objeto interno não recebe foco com porta fechada", page.locator('[data-object="filme"]').get_attribute("tabindex") == "-1")
    page.locator(".installation-stage").screenshot(path=str(ARTIFACTS / "desktop-closed.png"))
    page.locator('[data-action="fridge"]').click()
    settle(page)
    check("porta abre e luz vermelha acende", state(page)["redLightIntensity"] > 0 and state(page)["doorAngle"] > 1.7)

    page.locator(".installation-stage").scroll_into_view_if_needed()
    box = page.locator(".installation-stage").bounding_box()
    page.mouse.move(box["x"] + 40, box["y"] + 40)
    page.mouse.down()
    page.mouse.move(box["x"] + 160, box["y"] + 65, steps=8)
    page.mouse.up()
    settle(page)
    check("arrastar o fundo muda ponto de vista", abs(state(page)["camera"]["yaw"]) > .1)
    page.get_by_role("button", name="visão inicial", exact=True).click()
    settle(page)
    check("visão inicial recompõe somente câmera", state(page)["camera"] == initial["camera"])

    page.locator(".installation-accessible summary").click()
    page.locator(".installation-accessible").get_by_role("button", name="Rolo de filme guardado", exact=True).click()
    settle(page)
    check("explorar sem arrastar funciona para objeto da geladeira", fragment(page, "filme")["parent"] == "future" and "conserva" in page.locator(".installation-memory-text").inner_text())
    page.locator('[data-action="reset"]').click()
    settle(page)
    check("reset também recompõe geladeira e fragmento interno", state(page)["objects"] == initial["objects"] and state(page)["fridgeOpen"])

    page.evaluate("window.scrollTo({top:0,behavior:'instant'})")
    page.wait_for_timeout(900)
    check("renderização para quando a sala sai da tela", not state(page)["visible"] and not state(page)["framePending"])
    page.mouse.move(1590, 1130)
    page.screenshot(path=str(ARTIFACTS / "hero-after.png"))
    for width, height in [(1366, 768), (1600, 900)]:
        page.set_viewport_size({"width": width, "height": height})
        page.locator("#instalacao").scroll_into_view_if_needed()
        settle(page)
        check(f"sem overflow em {width}×{height}", page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    context.close()


def mobile_checks(browser):
    context, page = open_room(browser, 390, 844, mobile=True)
    check("composição mobile e quatro ilhas", state(page)["mobile"] and page.locator(".installation-island:visible").count() == 4)
    check("sem overflow em 390×844", page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    page.locator(".installation-stage").screenshot(path=str(ARTIFACTS / "mobile-stage.png"))
    page.locator("#instalacao").screenshot(path=str(ARTIFACTS / "mobile-section.png"))
    source = page.locator('[data-object="frasco-ambar"]')
    source.scroll_into_view_if_needed()
    sx, sy = center(source)
    dx, dy = center(page.locator('[data-object="aves"]'))
    session = context.new_cdp_session(page)
    session.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": sx, "y": sy}]})
    for step in range(1, 13):
        session.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": sx + (dx - sx) * step / 12, "y": sy + (dy - sy) * step / 12}]})
    session.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    settle(page)
    check("gesto touch nativo transfere objeto para mesa", fragment(page, "frasco-ambar")["parent"] == "future", state(page)["objects"])
    page.locator('[data-action="reset"]').tap()
    settle(page)
    check("reset por toque devolve objeto à escrivaninha", fragment(page, "frasco-ambar")["parent"] == "present")
    page.set_viewport_size({"width": 375, "height": 667})
    settle(page)
    check("sem overflow em 375×667", page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    context.close()


def reduced_checks(browser):
    context, page = open_room(browser, 1366, 768, reduced=True)
    page.locator('[data-action="fridge"]').click()
    page.wait_for_timeout(80)
    check("reduced motion elimina animação de porta", state(page)["doorAngle"] == 0)
    context.close()


def fallback_checks(playwright):
    browser = playwright.chromium.launch(executable_path=CHROME, headless=True, args=["--no-sandbox", "--disable-webgl"])
    page = browser.new_page(extra_http_headers={"Accept-Encoding": "identity"})
    page.goto(URL, wait_until="networkidle")
    page.locator("#instalacao").scroll_into_view_if_needed()
    page.locator(".installation-fallback").wait_for(state="visible")
    page.locator(".installation-accessible summary").click()
    page.locator(".installation-accessible").get_by_role("button", name="Fotografia de família", exact=True).click()
    check("fallback sem WebGL mantém leitura das memórias", "Ninguém escreveu" in page.locator(".installation-memory-text").inner_text())
    browser.close()


try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=CHROME, headless=True, args=["--no-sandbox", "--enable-webgl", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        desktop_checks(browser)
        mobile_checks(browser)
        reduced_checks(browser)
        browser.close()
        fallback_checks(playwright)
    check("sem exceções JavaScript", not RESULT["page_errors"], RESULT["page_errors"])
    check("sem falhas de recursos locais", not RESULT["local_errors"], RESULT["local_errors"])
finally:
    RESULT["external_failures"] = list({entry["url"]: entry for entry in RESULT["external_failures"]}.values())
    (ARTIFACTS / "qa-results.json").write_text(json.dumps(RESULT, indent=2, ensure_ascii=False))
