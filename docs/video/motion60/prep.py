"""Linea de tiempo de 60 s + cuadros de las grabaciones de la app para el motion graphics."""
import json, math, os, shutil, subprocess, imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
segs = json.load(open("guion2_dur.json", encoding="utf8"))
LEAD, TAIL, TOTAL = 0.45, 0.35, 60.0

t = 0.0; scenes = []
for s in segs:
    D = round(s["dur"] + LEAD + TAIL, 3)
    scenes.append({"id": s["id"], "start": round(t, 3), "dur": D, "voice": s["dur"], "n": math.ceil(D * 30) + 3})
    t += D
scenes[-1]["dur"] = round(TOTAL - scenes[-1]["start"], 3)  # el cierre se sostiene hasta los 60 s exactos
scenes[-1]["n"] = math.ceil(scenes[-1]["dur"] * 30) + 3
print("fin sin relleno:", round(t, 2), "-> total", TOTAL)
json.dump({"scenes": scenes, "total": TOTAL}, open("timeline.json", "w"), indent=1)
open("timeline.js", "w").write("window.TL=" + json.dumps({"scenes": scenes, "total": TOTAL}) + ";")

def run(*a):
    r = subprocess.run([FF, "-y", "-loglevel", "error", *a], capture_output=True, text=True)
    if r.returncode: print(r.stderr[-900:]); raise SystemExit(1)

by = {s["id"]: s for s in scenes}
# (id, entradas, filtro, velocidad) -> cuadros 1240x697 en frames/<id>/%04d.jpg
W, H = 1240, 697
def frames(i, inputs, vf, fc=None):
    d = f"frames/{i}"; shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
    n = by[i]["n"]
    args = []
    for x in inputs: args += x
    if fc: args += ["-filter_complex", fc, "-map", "[v]"]
    else: args += ["-vf", vf]
    run(*args, "-frames:v", str(n), "-q:v", "3", f"{d}/%04d.jpg")
    print(i, len(os.listdir(d)), "cuadros")

sc = f"crop=1671:940:124:0,scale={W}:{H}:flags=lanczos,fps=30,tpad=stop_mode=clone:stop_duration=6"
frames("m2", [["-i", "clips/s02.mp4"]], f"setpts=PTS/1.8,{sc}")
frames("m3", [["-i", "clips/s03.mp4"]], f"setpts=PTS/1.6,{sc}")
frames("m4", [["-ss", "2.5", "-i", "clips/s04.mp4"]], sc)
frames("m5", [["-i", "clips/s05.mp4"]], f"setpts=PTS/1.5,{sc}")
frames("m6", [["-i", "clips/s07.mp4"], ["-i", "clips/s08.mp4"]], None,
       fc=f"[0:v]trim=0:4,setpts=(PTS-STARTPTS)/1.5[a];[1:v]trim=0:9,setpts=(PTS-STARTPTS)/1.5[b];[a][b]concat=n=2:v=1,{sc}[v]")
# celular: la grabacion original es 390x844
frames("m7", [["-ss", "1.0", "-i", "raw/s09.webm"]], "scale=407:880:flags=lanczos,fps=30,tpad=stop_mode=clone:stop_duration=6")
