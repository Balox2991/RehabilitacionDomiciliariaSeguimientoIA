"""Voz + musica sintetica con pulso + 'whoosh' en cada transicion, con ducking bajo la voz."""
import json, subprocess, wave, numpy as np, imageio_ffmpeg
from scipy.signal import butter, sosfilt
FF = imageio_ffmpeg.get_ffmpeg_exe(); SR = 48000
TL = json.load(open("timeline.json")); T = TL["total"]; N = int(T * SR)
rng = np.random.default_rng(7)

def load(path):
    raw = subprocess.run([FF, "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()

# ---- voz ----
voice = np.zeros(N, dtype=np.float32)
for s in TL["scenes"]:
    x = load(f'{s["id"]}.mp3'); x *= 0.16 / (np.sqrt(np.mean(x ** 2)) + 1e-9)
    a = int((s["start"] + 0.45) * SR); voice[a:a + len(x)] += x[: N - a]
voice = np.tanh(voice * 1.4) / 1.4

# ---- musica: arpegio de plucks, pad y pulso (98 bpm) ----
bpm = 98; beat = 60 / bpm; eighth = beat / 2
def midi(m): return 440 * 2 ** ((m - 69) / 12)
chords = [[60, 64, 67, 72], [59, 62, 67, 71], [57, 60, 64, 69], [57, 60, 65, 69]]
music = np.zeros(N, dtype=np.float32)
def add(buf, t0, sig, g=1.0):
    a = int(t0 * SR)
    if a >= N: return
    n = min(len(sig), N - a); buf[a:a + n] += sig[:n] * g
tt = np.arange(int(1.4 * SR)) / SR
def pluck(f):
    env = np.exp(-tt * 4.2)
    return (np.sin(2 * np.pi * f * tt) + .35 * np.sin(4 * np.pi * f * tt) * np.exp(-tt * 7) + .15 * np.sin(6 * np.pi * f * tt)) * env * (1 - np.exp(-tt * 400))
kt = np.arange(int(.35 * SR)) / SR
kick = np.sin(2 * np.pi * (45 * kt + 80 * (1 - np.exp(-kt * 30)) / 30)) * np.exp(-kt * 11)
ht = np.arange(int(.06 * SR)) / SR
hat = sosfilt(butter(4, 7000, "hp", fs=SR, output="sos"), rng.standard_normal(len(ht))) * np.exp(-ht * 70)
step = 0; t = 0.0
while t < T:
    bar = int(t // (beat * 4)); ch = chords[bar % 4]
    pat = [0, 1, 2, 3, 2, 1, 2, 3][step % 8]
    add(music, t, pluck(midi(ch[pat] + 12)), .30)
    if step % 8 == 0: add(music, t, pluck(midi(ch[0] - 12)) * 1.4, .35)
    if t > 4.8:                       # entra el pulso despues del gancho
        if step % 2 == 0: add(music, t, kick, .55)
        else: add(music, t, hat, .16)
    step += 1; t += eighth
# pad sostenido
pt = np.arange(N) / SR; pad = np.zeros(N, dtype=np.float32)
for bar in range(int(T / (beat * 4)) + 1):
    ch = chords[bar % 4]; a = int(bar * beat * 4 * SR); b = min(N, int((bar + 1) * beat * 4 * SR) + int(.5 * SR))
    seg = pt[a:b]; w = sum(np.sin(2 * np.pi * midi(n) * seg) for n in (ch[0], ch[1], ch[2]))
    e = np.minimum(1, (seg - seg[0]) / .6) * np.minimum(1, (seg[-1] - seg) / .6)
    pad[a:b] += (w * e * .07).astype(np.float32)
music += pad
music *= np.minimum(1, pt / 1.0) * np.minimum(1, (T - pt) / 2.5)   # entrada y salida suaves

# ---- whoosh en cada transicion ----
fx = np.zeros(N, dtype=np.float32)
for s in TL["scenes"][1:]:
    n = int(.8 * SR); x = rng.standard_normal(n); ex = np.sin(np.linspace(0, np.pi, n)) ** 2
    sos = butter(2, [600, 5200], "bp", fs=SR, output="sos"); y = sosfilt(sos, x) * ex
    add(fx, s["start"] - .4, y.astype(np.float32), .22)

# ---- ducking de la musica bajo la voz ----
env = sosfilt(butter(2, 6, "lp", fs=SR, output="sos"), np.abs(voice))
duck = 1 - .62 * np.clip(env / .05, 0, 1)
music *= duck * 0.55
mix = voice + music + fx
mix /= max(1e-9, np.abs(mix).max()) / 0.89
with wave.open("mezcla2.wav", "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("ok", round(len(mix) / SR, 2), "s")
