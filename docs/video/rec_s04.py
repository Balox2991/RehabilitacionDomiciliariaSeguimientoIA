import json, time
from rec_lib import *
src=open("rec_all.py",encoding="utf8").read().split("with sync_playwright()")[0]
exec(src)
T0=[0]; READY=[0]
def s04b(pg):
    T0[0]=time.time()
    pg.goto(BASE+"/paciente/4/ejercicio/3"); w(pg,800)
    pg.get_by_text("Ya lo vi, practicar con la cámara").click(); w(pg,600)
    cap(pg,"Tu imagen no se muestra ni se guarda: solo tu esqueleto")
    move_click(pg,text="Encender cámara",steps=25)
    pg.wait_for_function("()=>!document.body.innerText.includes('Cargando el modelo')",timeout=60000)
    w(pg,800); READY[0]=time.time()-T0[0]
    smooth_scroll(pg,330,1000); w(pg,5000)
    move_click(pg,text="Calibrar (3-2-1)",steps=30); w(pg,9000)
with sync_playwright() as p:
    t=time.time()
    record_scene(p,"s04",PAT,40,s04b,viewport=VP,args=ARGS,perms=["camera"])
json.dump({"ready":READY[0]},open("s04_ready.json","w")); print("ready",READY[0])
