import asyncio, sys, os, pathlib
from playwright.async_api import async_playwright
a, b = int(sys.argv[1]), int(sys.argv[2]); out = sys.argv[3] if len(sys.argv) > 3 else "out"
os.makedirs(out, exist_ok=True)
url = pathlib.Path("motion.html").resolve().as_uri()
async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(channel="chrome", headless=True, args=["--allow-file-access-from-files"])
        pg = await br.new_page(viewport={"width": 1920, "height": 1080})
        pg.on("pageerror", lambda e: print("PAGEERR", e))
        await pg.goto(url); await pg.wait_for_function("window.ready===true")
        for f in range(a, b):
            await pg.evaluate("t=>window.render(t)", f / 30)
            await pg.screenshot(path=f"{out}/{f:05d}.jpg", type="jpeg", quality=90)
            if f % 100 == 0: print("frame", f, flush=True)
        await br.close()
asyncio.run(main())
