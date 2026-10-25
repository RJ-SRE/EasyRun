"""Deterministic original Foley-style synthesis, rendered into reusable samples.

No stock recordings; cloth grains, air turbulence, tension and resonant material
impulses are separate layers. This is designed synthesis, not recorded Foley.
"""
import hashlib,json,pathlib,subprocess,os,shutil
import numpy as np
import wave
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'prototypes/runlab/public/audio/sfx'
MASTERS=ROOT/'production/audio-v06/masters'
FFMPEG=os.environ.get("FFMPEG") or shutil.which("ffmpeg")
if not FFMPEG:
 raise SystemExit("FFmpeg is required to render samples; install it or set FFMPEG.")
SR=24000
COUNTS=dict(blade=6,cloth=4,hook=4,attach=4,tension=4,sling=4,porcelain=5,brass=5,heavy=4,dash=4,nova=3,tell=3,land=3,web=3)
DURATIONS=dict(blade=.27,cloth=.18,hook=.16,attach=.22,tension=.42,sling=.3,porcelain=.5,brass=.65,heavy=.55,dash=.22,nova=1.15,tell=.48,land=.23,web=.32)
OUT.mkdir(parents=True,exist_ok=True);MASTERS.mkdir(parents=True,exist_ok=True)
manifest=[]
for cue,count in COUNTS.items():
 for v in range(1,count+1):
  ident=f'{cue}-{v}';seed=int(hashlib.sha256(ident.encode()).hexdigest()[:8],16);rng=np.random.default_rng(seed)
  duration=DURATIONS[cue]*(.92+rng.random()*.16);t=np.arange(int(duration*SR))/SR
  def noise(lo,hi):
   raw=rng.normal(0,1,len(t));f=np.fft.rfftfreq(len(t),1/SR);gain=(f/lo)**2/(1+(f/lo)**2)/(1+(f/hi)**4);return np.fft.irfft(np.fft.rfft(raw)*gain,n=len(t))
  def modal(freq,decay,offset=0):
   x=np.maximum(0,t-offset);return np.sin(2*np.pi*freq*x)*np.exp(-x/decay)*(t>=offset)
  cloth=noise(300,2600)*np.sin(np.pi*t/duration)**2
  y=cloth*.1
  if cue in ['blade','dash','sling']:
   env=np.exp(-((t-duration*.38)/(duration*.22))**2)
   y+=noise(700,7000)*env*.6
   y+=cloth*.3
   if cue=='sling': y+=modal(1700+rng.random()*500,.025,duration*.6)*.12
  elif cue=='cloth':
   for at in rng.uniform(0,duration,9):y+=noise(500,3800)*np.exp(-((t-at)/.008)**2)*.15
  elif cue in ['hook','attach','tension','web']:
   freq={'hook':2700,'attach':1700,'tension':190,'web':2400}[cue]*(.95+rng.random()*.1)
   y+=noise(400,4800)*np.exp(-t/(.023 if cue!='tension' else .14))*.4
   for r,a in [(1,.23),(2.43,.1),(3.91,.035)]:y+=modal(freq*r,.06 if cue!='tension' else .22)*a
   if cue=='web':y+=noise(2000,8500)*np.exp(-t/.07)*.3
  elif cue in ['porcelain','brass','tell']:
   base={'porcelain':1350,'brass':310,'tell':780}[cue]*(.92+rng.random()*.16)
   y+=noise(100,6000)*np.exp(-t/.015)*.6
   # Brass is a dry contact sound; no bell-like resonant partials.
   if cue!='brass':
    for r,a,d in [(1,.32,.19),(2.71,.14,.13),(4.07,.07,.07),(5.43,.03,.04)]:y+=modal(base*r,d)*a
   else:y+=noise(450,3600)*np.exp(-t/.045)*.35
   if cue=='porcelain':
    for at in sorted(rng.uniform(.05,.35,6)):y+=modal(rng.uniform(2200,6500),.012,at)*.1
   if cue=='tell':y*=np.sin(np.pi*np.minimum(1,t/.35))**.5;y+=noise(500,2200)*np.exp(-((t-.12)/.045)**2)*.2
  elif cue in ['heavy','land','nova']:
   y+=noise(70,1900)*np.exp(-t/.06)*.6
   # Keep physical friction/impact; remove the bass-drum sweep and ring.
   if cue=='nova':
    y+=noise(600,6500)*np.exp(-t/.18)*.4
    y+=noise(1200,4800)*np.exp(-((t-.18)/.11)**2)*.15
  y[:120]*=np.linspace(0,1,120);y[-300:]*=np.linspace(1,0,300)
  y*=.6/max(np.max(np.abs(y)),.001)
  master=MASTERS/(ident+'.wav')
  with wave.open(str(master),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes((y*32767).astype('<i2').tobytes())
  dest=OUT/(ident+'.m4a')
  subprocess.run([FFMPEG,'-v','error','-y','-i',str(master),'-c:a','aac','-b:a','96k',str(dest)],check=True)
  manifest.append(dict(id=ident,cue=cue,file='/audio/sfx/'+dest.name,duration=duration,seed=seed,source='original layered procedural Foley-style synthesis',sha256=hashlib.sha256(dest.read_bytes()).hexdigest()))
(ROOT/'production/audio-v06/foley-log.json').write_text(json.dumps(manifest,indent=2)+'\n')
(OUT/'manifest.json').write_text(json.dumps(dict(version='sfx-only-v1',files=manifest),indent=2)+'\n')
print('Rendered',len(manifest),'material/action samples')
