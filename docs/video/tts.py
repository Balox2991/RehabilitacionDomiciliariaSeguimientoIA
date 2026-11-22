import asyncio, json, edge_tts, subprocess, imageio_ffmpeg, re
ff = imageio_ffmpeg.get_ffmpeg_exe()
async def main():
    segs = json.load(open("guion.json", encoding="utf8"))
    for s in segs:
        await edge_tts.Communicate(s["text"], "es-CO-SalomeNeural", rate="-4%").save(f'{s["id"]}.mp3')
        out = subprocess.run([ff, "-i", f'{s["id"]}.mp3'], capture_output=True, text=True).stderr
        m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", out)
        s["dur"] = int(m[1])*3600 + int(m[2])*60 + float(m[3])
        print(s["id"], round(s["dur"],2))
    json.dump(segs, open("guion_dur.json","w",encoding="utf8"), ensure_ascii=False, indent=1)
asyncio.run(main())
