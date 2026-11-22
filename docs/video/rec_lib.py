import os, json, time
from playwright.sync_api import sync_playwright
BASE = "http://localhost:5173"
HERE = os.path.dirname(os.path.abspath(__file__))
PASS = __import__("re").search(r"Contrase.{1,3}a de todas:\s*(\S+)", open("C:/Users/JUAN AMAYA/Documents/PROYECTODEGRADO/telerehab-ia/apps/backend/data/demo-credentials.txt", encoding="utf8", errors="replace").read()).group(1)
CURSOR_JS = """
(() => { const d = document.createElement('div'); d.id='__cur';
 d.style.cssText='position:fixed;z-index:2147483647;width:22px;height:22px;border-radius:50%;background:rgba(214,64,42,.85);border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.35);pointer-events:none;left:-40px;top:-40px;transform:translate(-50%,-50%);transition:left .05s linear,top .05s linear';
 const add=()=>document.documentElement.appendChild(d); document.documentElement?add():addEventListener('DOMContentLoaded',add);
 addEventListener('mousemove',e=>{d.style.left=e.clientX+'px';d.style.top=e.clientY+'px'},true);
 addEventListener('mousedown',()=>{d.style.transform='translate(-50%,-50%) scale(.7)'},true);
 addEventListener('mouseup',()=>{d.style.transform='translate(-50%,-50%) scale(1)'},true);
})();
"""
def login(p, email, out_state, args=None):
    b = p.chromium.launch(channel="chrome", args=args or [])
    c = b.new_context(viewport={"width":1280,"height":720})
    pg = c.new_page(); pg.goto(BASE+"/")
    pg.get_by_placeholder("nombre@correo.com").fill(email)
    pg.get_by_placeholder("Tu contraseña").fill(PASS)
    pg.keyboard.press("Enter"); pg.wait_for_url("**/paciente/**" if "julian" in email else "**/fisio/**", timeout=15000)
    c.storage_state(path=out_state); b.close()
def smooth_scroll(pg, dy, ms=1800):
    pg.evaluate("""([dy,ms])=>new Promise(r=>{const y0=scrollY,t0=performance.now();const f=t=>{const k=Math.min(1,(t-t0)/ms);const e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;scrollTo(0,y0+dy*e);k<1?requestAnimationFrame(f):r()};requestAnimationFrame(f)})""", [dy, ms])
def move_click(pg, selector=None, text=None, steps=30, click=True):
    loc = pg.get_by_text(text, exact=False).first if text else pg.locator(selector).first
    loc.scroll_into_view_if_needed(); box = loc.bounding_box()
    pg.mouse.move(box["x"]+box["width"]/2, box["y"]+box["height"]/2, steps=steps)
    if click: pg.wait_for_timeout(250); pg.mouse.click(box["x"]+box["width"]/2, box["y"]+box["height"]/2)
def record_scene(p, name, state, dur, fn, viewport=(1280,720), args=None, perms=None, mobile=False):
    b = p.chromium.launch(channel="chrome", args=args or [])
    kw = dict(viewport={"width":viewport[0],"height":viewport[1]}, record_video_dir=os.path.join(HERE,"raw"), record_video_size={"width":viewport[0],"height":viewport[1]}, locale="es-CO")
    if mobile: kw.update(device_scale_factor=2, is_mobile=True, has_touch=True)
    if perms: kw["permissions"] = perms
    if state: kw["storage_state"]=state
    c = b.new_context(**kw); c.add_init_script(CURSOR_JS)
    pg = c.new_page(); t0 = time.time()
    try: fn(pg)
    finally:
        rest = dur - (time.time()-t0)
        if rest > 0: pg.wait_for_timeout(int(rest*1000))
        path = pg.video.path(); c.close(); b.close()
    dst = os.path.join(HERE,"raw",name+".webm"); os.replace(path, dst); print(name, "ok", round(time.time()-t0,1))
