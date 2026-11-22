import json
from rec_lib import *
ARGS=["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream","--use-file-for-fake-video-capture="+os.path.join(HERE,"cam.mjpeg"),"--autoplay-policy=no-user-gesture-required"]
D={s["id"]:s["dur"]+0.5 for s in json.load(open(os.path.join(HERE,"guion_dur.json"),encoding="utf8"))}
PAT=os.path.join(HERE,"patient.json"); THE=os.path.join(HERE,"therapist.json")
VP=(1600,900)
CAP_JS="""(t)=>{let c=document.getElementById('__cap');if(c)c.remove();c=document.createElement('div');c.id='__cap';c.textContent=t;
c.style.cssText='position:fixed;left:48px;bottom:44px;z-index:2147483646;background:rgba(12,42,68,.92);color:#fff;font:700 26px Montserrat,Segoe UI,sans-serif;padding:16px 26px;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.3);opacity:0;transform:translateY(14px);transition:all .6s ease';
document.body.appendChild(c);requestAnimationFrame(()=>{c.style.opacity=1;c.style.transform='none'})}"""
def cap(pg,t): pg.evaluate(CAP_JS,t)
def w(pg,ms): pg.wait_for_timeout(ms)
def kenburns(pg,sec):
    pg.evaluate("(s)=>{document.body.style.transition='transform '+s+'s linear';document.body.style.transformOrigin='50% 40%';requestAnimationFrame(()=>document.body.style.transform='scale(1.05)')}",sec)

def s01(pg):
    pg.goto(BASE+"/"); w(pg,1200); kenburns(pg,12); cap(pg,"Rehabilitación en casa, acompañada por IA"); w(pg,3500)
    move_click(pg,selector='input[type=email], input[placeholder="nombre@correo.com"]',steps=40); w(pg,300)
    pg.keyboard.type("julian.torres@ejemplo.co",delay=70)
def s02(pg):
    pg.goto(BASE+"/paciente/4"); w(pg,1500); cap(pg,"Tu siguiente paso, siempre claro"); w(pg,2500)
    smooth_scroll(pg,520,3000); w(pg,1200); smooth_scroll(pg,650,3200)
def s03(pg):
    pg.goto(BASE+"/paciente/4/ejercicio/3"); w(pg,1200); cap(pg,"Mira cómo se hace antes de empezar"); w(pg,1800)
    move_click(pg,text="Pausar",steps=35,click=True); w(pg,900); smooth_scroll(pg,520,2800)
def s04(pg):
    pg.goto(BASE+"/paciente/4/ejercicio/3"); w(pg,1000)
    pg.get_by_text("Ya lo vi, practicar con la cámara").click(); w(pg,900)
    cap(pg,"Tu imagen no se muestra ni se guarda: solo tu esqueleto")
    move_click(pg,text="Encender cámara",steps=30); w(pg,3500)
    smooth_scroll(pg,330,1200); w(pg,4500)
    move_click(pg,text="Calibrar (3-2-1)",steps=30); w(pg,6000)
def s05(pg):
    pg.goto(BASE+"/paciente/4/progreso"); w(pg,1200); cap(pg,"Tu evolución, sesión a sesión"); w(pg,1000)
    smooth_scroll(pg,700,3200); w(pg,500)
    try: pg.locator(".sess-btn").first.click(timeout=2000)
    except Exception: pass
def s06(pg):
    pg.goto(BASE+"/paciente/4/aprender"); w(pg,1200); cap(pg,"Biblioteca de ejercicios paso a paso"); w(pg,800)
    smooth_scroll(pg,600,3500)
def s07(pg):
    pg.goto(BASE+"/fisio/1"); w(pg,1500); cap(pg,"Panel del fisioterapeuta: quién necesita atención hoy"); w(pg,1500)
    smooth_scroll(pg,560,3500); w(pg,600)
    try: move_click(pg,text="Marcar revisado",steps=30)
    except Exception: pass
def s08(pg):
    pg.goto(BASE+"/fisio/1/paciente/4"); w(pg,1500); cap(pg,"Ficha del paciente: sesiones, repeticiones y notas"); w(pg,1800)
    move_click(pg,text="Sesiones",steps=35); w(pg,1500); smooth_scroll(pg,300,1200); w(pg,400)
    try:
        move_click(pg,text="Ver análisis",steps=30); w(pg,1800); smooth_scroll(pg,500,2000)
    except Exception: pass
def s09(pg):
    pg.goto(BASE+"/paciente/4"); w(pg,1200); smooth_scroll(pg,500,2200)
with sync_playwright() as p:
    login(p,"julian.torres@ejemplo.co",PAT,ARGS); login(p,"camila.restrepo@ejemplo.co",THE,ARGS)
    for n,fn,st,kw in [("s01",s01,None,{}),("s02",s02,PAT,{}),("s03",s03,PAT,{}),("s04",s04,PAT,{"perms":["camera"]}),("s05",s05,PAT,{}),("s06",s06,PAT,{}),("s07",s07,THE,{}),("s08",s08,THE,{})]:
        record_scene(p,n,st,D[n],fn,viewport=VP,args=ARGS,**kw)
    record_scene(p,"s09",PAT,D["s09"]+2,s09,viewport=(390,844),args=ARGS,mobile=True)
