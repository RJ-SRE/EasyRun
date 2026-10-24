"""Produce our original scripts using the public Qwen VoiceDesign demo API.

Source: https://huggingface.co/spaces/Qwen/Qwen3-TTS/blob/main/app.py
No credentials, voice impersonation, OS speech or hidden cloud dependency in play.
Stops on service errors/quota; does not change accounts or bypass usage limits.
"""
import argparse,hashlib,json,pathlib,subprocess,time,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1];PROD=ROOT/'production/audio-v06';OUT=ROOT/'prototypes/runlab/public/audio/v06';MASTERS=PROD/'masters'
API='https://qwen-qwen3-tts.hf.space/gradio_api/call/generate_voice_design'

def generate(text,prompt):
 req=urllib.request.Request(API,data=json.dumps({'data':[text,'English',prompt]}).encode(),headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=90) as r: event=json.load(r)['event_id']
 with urllib.request.urlopen(API+'/'+event,timeout=150) as r:
  state=''
  for raw in r:
   line=raw.decode().strip()
   if line.startswith('event:'):state=line[6:].strip()
   if line.startswith('data:'):
    data=json.loads(line[5:])
    if state=='error':raise RuntimeError('Voice service failed: '+str(data))
    if state=='complete':
     if not data[0]:raise RuntimeError(str(data[1]))
     return data[0]['url']
 raise RuntimeError('No audio returned')

def main():
 if json.loads((PROD / "voice-brief.json").read_text())["status"] == "production_paused_by_user":
  print("Character voice production is paused by the user; no generation started.")
  return
 args=argparse.ArgumentParser();args.add_argument('--auditions',action='store_true');args.add_argument('--only',default='');args=args.parse_args()
 brief=json.loads((PROD/'voice-brief.json').read_text());casts={'hero':brief['hero'],**brief['enemies']};script=json.loads((PROD/'dialogue.en-zh.json').read_text());jobs=[]
 for line in script['lines']:
  cast=casts[line['speaker']];prompt=cast['casting_prompt_en']+' Performance: '+line['delivery_zh']
  jobs.append((line['id'],line['speaker'],line['text_en'],prompt,'selected',None))
  if args.auditions and line['audition']:
   for take in ['B','C']:jobs.append((line['id']+'-take-'+take,line['speaker'],line['text_en'],prompt+' Alternate performance: '+cast['take_directions'][take],take,None))
 if args.auditions:
  for line in script['lines']:
   if line['id'] in ['v6-h-arrival','v6-h-core']:jobs.append((line['id']+'-cast-B','hero',line['text_en'],'An original adult male with a warmer, youthful middle register and gentle Irish inflection. Watchful, quiet, intimate dry speech, subtle affection, no narration. '+line['delivery_zh'],'alternate_cast',None))
 efforts={'effort-light':('Hh.','One short unvoiced athletic exhale.'),'effort-heavy':('Huh!','One short closed-mouth exertion, controlled force.'),'effort-grapple':('Hnh.','Brief natural strain while supporting body weight.'),'effort-land':('Uh.','A quiet expelled breath upon landing.'),'effort-hurt':('Ah!','Short startled breath of pain, not a theatrical scream.'),'effort-recover':('Hah... hah.','Two tired uneven breaths settling, no spoken words.')}
 for c in json.loads((PROD/'efforts-sfx.json').read_text())['cues']:
  if c['id'] in efforts:
   text,direction=efforts[c['id']]
   for v in range(c['variant_count']):jobs.append((f"{c['id']}-{v+1}",'hero',text,casts['hero']['casting_prompt_en']+' Only nonverbal effort: '+direction+f' Performance variation {v+1}: natural, brief and dry.',f'body-{v+1}',c['target_duration_seconds'][1]))
  if c['id'].startswith('enemy-vocal-'):
   speaker=c['id'][12:]
   for action in c['actions']:
    for v in range(c['variants_per_action']):
     jobs.append((f"{c['id']}-{action}-{v+1}",speaker,{'tell':'Hh...','hurt':'Ah!','collapse':'Ah...'}[action],casts[speaker]['casting_prompt_en']+' Nonverbal gesture, not speech: '+casts[speaker]['vocal_gestures'][{'collapse':'death'}.get(action,action)]+f' Short natural variation {v+1}.',f'{action}-{v+1}',1.3 if action=='collapse' else .6))
 records_path=PROD/'production-log.json';records=json.loads(records_path.read_text()) if records_path.exists() else {};OUT.mkdir(parents=True,exist_ok=True);MASTERS.mkdir(exist_ok=True)
 jobs=[j for j in jobs if (not args.only or args.only in j[0]) and j[0] not in records]
 print(len(jobs),'performances to generate',flush=True)
 for ident,speaker,text,prompt,take,body_limit in jobs:
  start=time.time();print('Generating',ident,flush=True)
  url=generate(text,prompt)
  raw=MASTERS/(ident+'.wav');temp=ROOT/'.cache/voice-download.wav'
  with urllib.request.urlopen(url,timeout=120) as r:temp.write_bytes(r.read())
  # Lossless master, untouched vocal performance at native sample rate.
  subprocess.run(['/opt/homebrew/bin/ffmpeg','-v','error','-y','-i',str(temp),'-c:a','pcm_s24le',str(raw)],check=True)
  meta=json.loads(subprocess.check_output(['/opt/homebrew/bin/ffprobe','-v','error','-show_streams','-show_format','-of','json',str(raw)]));duration=float(meta['format']['duration']);sr=int(meta['streams'][0]['sample_rate'])
  if duration<.1 or duration>35:raise RuntimeError('Unexpected generation duration '+str(duration))
  filt='silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.06,highpass=f=65'
  if body_limit:filt+=f',atrim=duration={body_limit},afade=t=in:d=0.012,afade=t=out:st={body_limit-.04}:d=0.04,loudnorm=I=-26:TP=-9:LRA=11'
  else:filt+=',loudnorm=I=-20:TP=-3:LRA=11'
  dest=OUT/(ident+'.m4a');subprocess.run(['/opt/homebrew/bin/ffmpeg','-v','error','-y','-i',str(raw),'-af',filt,'-ar',str(sr),'-ac','1','-c:a','aac','-b:a','96k',str(dest)],check=True)
  actual=float(subprocess.check_output(['/opt/homebrew/bin/ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(dest)]))
  records[ident]=dict(speaker=speaker,text=text,prompt=prompt,take=take,model='Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign',provider='Qwen official public demo',provider_url='https://huggingface.co/spaces/Qwen/Qwen3-TTS',native_sample_rate=sr,master_duration=duration,duration=actual,file='/audio/v06/'+ident+'.m4a',sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),generated_seconds=round(time.time()-start,1),kind='vocal' if body_limit else 'dialogue',identity_method='original voice description; no real person reference')
  records_path.write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n');print('Saved',ident,actual,'s',flush=True)

if __name__=='__main__':main()
