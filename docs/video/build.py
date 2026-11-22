import json, subprocess, imageio_ffmpeg, os
FF = imageio_ffmpeg.get_ffmpeg_exe()
segs = json.load(open("guion_dur.json", encoding="utf8"))
os.makedirs("clips", exist_ok=True)
def run(*a): 
    r = subprocess.run([FF, "-y", "-loglevel", "error", *a], capture_output=True, text=True)
    if r.returncode: print(r.stderr[-800:]); raise SystemExit(1)
lens = {}
for s in segs:
    i = s["id"]; L = round(s["dur"] + 0.5, 2); lens[i] = L
    ss = "1.0" if i != "s10" else "0.3"
    if i == "s09":  # celular dentro de un marco sobre fondo de marca
        run("-ss", ss, "-i", f"raw/{i}.webm", "-t", str(L), "-filter_complex",
            "color=c=0x0c2a44:s=1920x1080:r=30[bg];[0:v]tpad=stop_mode=clone:stop_duration=4,scale=-2:940:flags=lanczos,pad=iw+24:ih+24:12:12:color=white,format=yuv420p[ph];[bg][ph]overlay=(W-w)/2:(H-h)/2,fps=30,format=yuv420p[v]",
            "-map", "[v]", "-an", "-c:v", "libx264", "-crf", "17", "-preset", "medium", f"clips/{i}.mp4")
    else:
        run("-ss", ss, "-i", f"raw/{i}.webm", "-t", str(L), "-vf", "tpad=stop_mode=clone:stop_duration=4,scale=1920:1080:flags=lanczos,fps=30,format=yuv420p",
            "-an", "-c:v", "libx264", "-crf", "17", "-preset", "medium", f"clips/{i}.mp4")
    # voz con un respiro al inicio y relleno hasta el final de la escena
    run("-i", f"{i}.mp3", "-af", f"adelay=350|350,apad=whole_dur={L},loudnorm=I=-16:TP=-1.5:LRA=7", "-t", str(L), "-ar", "48000", f"clips/{i}.wav")
with open("list_v.txt", "w") as f: f.writelines(f"file 'clips/{s['id']}.mp4'\n" for s in segs)
with open("list_a.txt", "w") as f: f.writelines(f"file 'clips/{s['id']}.wav'\n" for s in segs)
run("-f", "concat", "-safe", "0", "-i", "list_v.txt", "-c", "copy", "video_mudo.mp4")
run("-f", "concat", "-safe", "0", "-i", "list_a.txt", "-c:a", "pcm_s16le", "voz.wav")
T = sum(lens.values()); print("duracion", T)
# cama musical suave (acorde sostenido) muy baja bajo la voz
run("-f", "lavfi", "-i", f"aevalsrc='0.5*sin(2*PI*220*t)+0.35*sin(2*PI*277.18*t)+0.35*sin(2*PI*329.63*t)+0.25*sin(2*PI*110*t)*(1+0.3*sin(2*PI*0.2*t))':s=48000:d={T}",
    "-af", f"lowpass=f=900,volume=0.10,afade=t=in:d=2,afade=t=out:st={T-3}:d=3", "cama.wav")
run("-i", "voz.wav", "-i", "cama.wav", "-filter_complex", "[0:a][1:a]amix=inputs=2:duration=first:normalize=0[a]", "-map", "[a]", "-c:a", "aac", "-b:a", "192k", "mezcla.m4a")
run("-i", "video_mudo.mp4", "-i", "mezcla.m4a", "-c:v", "copy", "-c:a", "copy", "-movflags", "+faststart", "-shortest", "video_publicitario.mp4")
print(os.path.getsize("video_publicitario.mp4")//1024, "KB")
