from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:3000")
    page.wait_for_timeout(3000)
    print("Page title:", page.title())

    # Dump console errors
    page.on("console", lambda msg: print(f"Browser console: {msg.type}: {msg.text}") if msg.type == "error" else None)
    page.goto("http://localhost:3000")
    page.wait_for_timeout(3000)

    browser.close()
