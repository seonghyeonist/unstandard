"""Verify the built, local P0 app and capture two review screenshots.

Requires Python Playwright and Chromium. Run npm run build first.
"""
import os
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread

from playwright.sync_api import expect, sync_playwright

APP = Path(__file__).resolve().parents[1]
EVIDENCE = APP / "coverage" / "browser"
AXES = ("pace", "boundary", "expression", "reality", "commitment", "confidence")
SCORES = ("-5", "5", "1", "0", "-2", "3")


def no_overflow(page):
    assert page.evaluate(
        "document.documentElement.scrollWidth === document.documentElement.clientWidth"
    )


def verify(browser, url, width, height):
    page = browser.new_page(viewport={"width": width, "height": height})
    requests, errors, console_errors = [], [], []
    page.on("request", lambda req: requests.append((req.method, req.url)))
    page.on("pageerror", lambda error: errors.append(str(error)))

    def record_console(message):
        if message.type == "error":
            console_errors.append(message.text)

    page.on("console", record_console)
    response = page.goto(url, wait_until="networkidle")
    assert response and response.ok
    expect(page.get_by_role("heading", level=1)).to_have_text(
        "When do we talk again after a fight?"
    )
    expected_assets = {"/", "/styles.css", "/client.mjs", "/receipt.mjs", "/copy.mjs", "/view.mjs"}
    assert {address.removeprefix(url.rstrip("/")) for _, address in requests} == expected_assets
    assert all(method == "GET" for method, _ in requests)
    requests.clear()
    no_overflow(page)
    assert page.locator(".sample dl div").count() == 5
    y = page.locator(".sample").bounding_box()["y"]
    assert y < height
    expect(page.locator(".closed")).to_have_text("Checkout is currently closed.")
    assert page.locator("form").count() == 0
    assert page.get_by_role("button", name="Checkout").count() == 0

    page.keyboard.press("Tab")
    expect(page.get_by_role("link", name="Skip to content")).to_be_focused()
    page.keyboard.press("Tab")
    language = page.locator("[data-action=language]")
    expect(language).to_be_focused()
    assert language.evaluate("(el) => getComputedStyle(el).outlineStyle") == "solid"
    page.keyboard.press("Tab")
    expect(page.get_by_role("link", name="Start my free receipt")).to_be_focused()
    page.keyboard.press("Enter")
    expect(page.locator("#quiz")).to_be_focused()
    page.keyboard.press("Tab")
    expect(page.locator("#score-pace")).to_be_focused()
    page.keyboard.press("Home")
    page.keyboard.press("ArrowDown")
    page.keyboard.press("Tab")
    expect(page.locator("#score-pace")).to_have_value("-5")
    expect(page.locator("#progress")).to_have_text("1 of 6 answered")

    page.locator("[data-action=receipt]").click()
    expect(page.locator("#error")).to_contain_text("Choose a whole number")
    expect(page.locator("#score-boundary")).to_be_focused()
    language.click()
    expect(page.locator("html")).to_have_attribute("lang", "ko")
    expect(language).to_be_focused()
    expect(page.locator("#error")).to_contain_text("정수를")
    expect(page.locator("#score-pace")).to_have_value("-5")
    expect(page.locator("#progress")).to_have_text("6개 중 1개 응답")
    no_overflow(page)

    for axis, score in zip(AXES, SCORES, strict=True):
        page.locator(f"#score-{axis}").select_option(score)
    expect(page.locator("#error")).to_be_empty()
    page.locator("[data-action=receipt]").click()
    expect(page.locator("#quiz")).to_be_focused()
    expect(page.locator(".ranked li")).to_have_count(2)
    summaries = lambda: page.locator(".ranked li").evaluate_all(
        "(rows) => rows.map((row) => [row.dataset.axis, row.querySelector('.score').textContent])"
    )
    assert summaries() == [["boundary", "+5"], ["pace", "−5"]]
    expect(page.locator(".ranked h3").first).to_have_text("경계")
    no_overflow(page)

    if width == 360:
        page.evaluate("window.scrollTo(0, 0)")
        page.screenshot(path=EVIDENCE / "p0-mobile-ko.png", full_page=True)
    language.click()
    expect(page.locator(".ranked h3").first).to_have_text("Boundaries")
    assert summaries() == [["boundary", "+5"], ["pace", "−5"]]
    no_overflow(page)
    if width == 1440:
        page.evaluate("window.scrollTo(0, 0)")
        page.screenshot(path=EVIDENCE / "p0-desktop-en.png", full_page=True)

    page.locator("[data-action=edit]").click()
    expect(page.locator("#score-pace")).to_have_value("-5")
    for axis in AXES:
        page.locator(f"#score-{axis}").select_option("0")
    page.locator("[data-action=receipt]").click()
    expect(page.locator(".quiz .section-intro")).to_contain_text("0 for every pair")
    assert summaries() == [["boundary", "0"], ["commitment", "0"]]
    assert page.evaluate("localStorage.length + sessionStorage.length") == 0
    assert page.context.cookies() == []
    assert requests == [], requests
    assert errors == [], errors
    assert console_errors == [], console_errors
    print(f"PASS {width}×{height} EN/KO, keyboard, validation, tally, zero interaction requests")

    page.reload(wait_until="networkidle")
    expect(page.locator("#progress")).to_have_text("0 of 6 answered")
    page.context.close()


def main():
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    handler = partial(SimpleHTTPRequestHandler, directory=APP / "dist")
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        url = f"http://127.0.0.1:{server.server_port}/"
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                executable_path=os.environ.get("B2C_BROWSER") or None
            )
            print(f"Chromium {browser.version}")
            verify(browser, url, 360, 800)
            verify(browser, url, 1440, 1000)
            browser.close()
        server.shutdown()


if __name__ == "__main__":
    main()
