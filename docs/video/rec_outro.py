import json
from rec_lib import *
D=[s for s in json.load(open(os.path.join(HERE,"guion_dur.json"),encoding="utf8")) if s["id"]=="s10"][0]["dur"]+0.8
HTML=f"""<!doctype html><meta charset=utf-8><style>
*{{margin:0;box-sizing:border-box}} body{{height:100vh;display:grid;place-items:center;background:radial-gradient(120% 120% at 20% 10%,#12507f 0%,#0c2a44 55%,#07182a 100%);font-family:Montserrat,'Segoe UI',sans-serif;color:#fff;overflow:hidden}}
.c{{text-align:center;animation:in 1.2s ease both}} @keyframes in{{from{{opacity:0;transform:translateY(24px) scale(.97)}}to{{opacity:1;transform:none}}}}
img{{width:150px;filter:drop-shadow(0 10px 30px rgba(0,0,0,.4))}} h1{{font-size:78px;margin:22px 0 6px;letter-spacing:-1px}} .t{{font-size:34px;font-weight:600;color:#cfe3f4}}
.q{{margin:46px auto 0;font-size:28px;background:#d6402a;display:inline-block;padding:18px 38px;border-radius:999px;font-weight:700;animation:in 1.2s .9s ease both}}
.f{{position:fixed;bottom:34px;left:0;right:0;text-align:center;font-size:18px;color:#8fb0cc;animation:in 1.2s 1.4s ease both}}
</style><div class=c><img src="{BASE}/brand/marca.png"><h1>Clínica Ocaña</h1><div class=t>Rehabilitación física, en casa, con acompañamiento</div><div class=q>Pregúntale a tu fisioterapeuta por la app</div></div>
<div class=f>Proyecto de grado · Ingeniería de Sistemas · No es un dispositivo médico</div>"""
def f(pg):
    open(os.path.join(HERE,"outro.html"),"w",encoding="utf8").write(HTML)
    pg.goto("file:///"+os.path.join(HERE,"outro.html").replace("\\","/")); pg.wait_for_timeout(1000)
with sync_playwright() as p: record_scene(p,"s10",None,D,f,viewport=(1600,900))
