"""Original, reproducible layered skill sound design. No speech or stock audio.

48 kHz stereo masters; filtered turbulence, plucked strings, low transients and
short early reflections. Seeded variation avoids identical repeated attacks.
"""
import hashlib, json, pathlib, subprocess, wave
import numpy as np
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT/'prototypes/runlab/public/audio/sfx'
MASTER = ROOT/'production/skills-v06/masters'
SR = 48000
COUNTS = dict(bowdraw=2,bowshot=3,bowready=2,arrowhit=3,heavycut=3,markbreak=2,healstart=2,healcomplete=2,chaincut=4,chainfinish=3)
DUR = dict(bowdraw=.6,bowshot=.36,bowready=.22,arrowhit=.32,heavycut=.58,markbreak=.55,healstart=.8,healcomplete=.65,chaincut=.23,chainfinish=.72)
OUT.mkdir(parents=True,exist_ok=True); MASTER.mkdir(parents=True,exist_ok=True)
entries=[]
for cue,count in COUNTS.items():
 for variant in range(1,count+1):
  ident=f'{cue}-{variant}'; seed=int(hashlib.sha256(ident.encode()).hexdigest()[:8],16)
  rng=np.random.default_rng(seed); dur=DUR[cue]; t=np.arange(int(dur*SR))/SR
  def band(lo,hi):
   f=np.fft.rfftfreq(len(t),1/SR)
   return np.fft.irfft(np.fft.rfft(rng.normal(size=len(t)))*(f/lo)**2/(1+(f/lo)**2)/(1+(f/hi)**6),n=len(t))
  def mode(f,decay,start=0):
   x=np.maximum(t-start,0); return np.sin(2*np.pi*f*x)*np.exp(-x/decay)*(t>=start)
  y=np.zeros(len(t)); airy=band(450,6800); body=band(60,1600); grain=band(1400,9200)
  if cue=='bowdraw':
   env=np.sin(np.pi*np.minimum(t/.61,1))**1.8
   y=body*.12*env+grain*.08*env
   for at in [.06,.17,.31,.46]: y+=band(500,3600)*np.exp(-((t-at)/.017)**2)*.18
   y+=np.sin(2*np.pi*(125*t+45*t*t))*env*.06
  elif cue=='bowshot':
   y=body*.3*np.exp(-t/.023)+airy*.45*np.exp(-((t-.09)/.06)**2)
   for f,a in [(154,.18),(361,.11),(1160,.07)]: y+=mode(f*(.96+variant*.02),.04)*a
   y+=grain*.14*np.exp(-t/.065)
  elif cue=='bowready':
   y=grain*.12*np.exp(-t/.035)+mode(2350,.026)*.10+mode(1180,.045)*.06
  elif cue=='arrowhit':
   y=body*.48*np.exp(-t/.023)+grain*.38*np.exp(-t/.014)
   for f,a in [(185,.26),(530,.12),(1900,.06)]:y+=mode(f,.055)*a
  elif cue in ['heavycut','chaincut','chainfinish']:
   peak={'heavycut':.12,'chaincut':.045,'chainfinish':.08}[cue]
   width={'heavycut':.085,'chaincut':.035,'chainfinish':.07}[cue]
   y=airy*np.exp(-((t-peak)/width)**2)*.65+body*np.exp(-((t-peak)/width*1.4)**2)*.6
   if cue!='chaincut':
    y+=np.sin(2*np.pi*(90*t-30*t*t))*np.exp(-t/.13)*.24
    y+=grain*np.exp(-((t-peak-.07)/.035)**2)*.15
   if cue=='chainfinish':
    y+=band(90,3000)*np.exp(-t/.06)*.32
    for at in [.15,.21,.29]: y+=grain*np.exp(-((t-at)/.012)**2)*.07
  elif cue=='markbreak':
   y=grain*.35*np.exp(-t/.025)+body*.4*np.exp(-t/.04)
   for at in [.025,.06,.10,.16,.24]:
    y+=mode(rng.uniform(1800,5000),.022,at)*.12
   y+=mode(115,.09)*.2
  elif cue=='healstart':
   env=np.sin(np.pi*t/dur)**1.7
   y=band(300,2200)*env*.14
   for f,a in [(146.8,.13),(220,.09),(440,.03)]:y+=np.sin(2*np.pi*f*t)*env*a
  elif cue=='healcomplete':
   for f,a in [(293.7,.18),(440,.12),(880,.04)]:y+=mode(f,.16)*a
   y+=grain*.07*np.exp(-t/.06)
  # Dry center with two soft side reflections; no long combat-masking reverb.
  y*=np.minimum(1,t/.003)*np.minimum(1,(dur-t)/.03)
  y*=.64/max(np.max(np.abs(y)),.001)
  left=y.copy();right=y.copy()
  for delay,g in [(0.013,.09),(.029,.045)]:
   n=int(SR*delay);left[n:]+=y[:-n]*g;right[n+97:]+=y[:-(n+97)]*g
  stereo=np.column_stack((left,right));peak=float(np.max(np.abs(stereo)))
  stereo*=min(1,.76/max(peak,.001))
  wav=MASTER/(ident+'.wav')
  with wave.open(str(wav),'wb') as w:
   w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((stereo*32767).astype('<i2').tobytes())
  dest=OUT/(ident+'.m4a')
  subprocess.run(['/opt/homebrew/bin/ffmpeg','-v','error','-y','-i',str(wav),'-c:a','aac','-b:a','128k',str(dest)],check=True)
  entries.append(dict(id=ident,cue=cue,file='/audio/sfx/'+dest.name,duration=dur,seed=seed,peak=round(float(np.max(np.abs(stereo))),5),rms=round(float(np.sqrt(np.mean(stereo**2))),5),source='original layered skill synthesis; no speech',sha256=hashlib.sha256(dest.read_bytes()).hexdigest()))
manifest_path=OUT/'manifest.json'
manifest=json.loads(manifest_path.read_text())
manifest['files']=[x for x in manifest['files'] if x['cue'] not in COUNTS]+entries
manifest['count']=len(manifest['files'])
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(ROOT/'production/skills-v06/sound-log.json').write_text(json.dumps(entries,indent=2)+'\n')
print(f'Rendered {len(entries)} skill samples; manifest has {len(manifest["files"])} local effects')
