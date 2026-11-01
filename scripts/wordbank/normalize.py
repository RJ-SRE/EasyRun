from pathlib import Path
import csv,json,re,unicodedata,collections,hashlib
root=Path.cwd();cache=root/'.cache/wordbank-v2'
expected={'cet2016.pdf':'9166d3c03b7bc43abd9d9df91bd2ef8085b4419286f1e5ca100dea68f3cfd1f1','ecdict.csv':'d1ecbdf9ee2b920afb6f430ca6b6bb9f559588cf0dff86e04bd255f9390843cc'}
for name,digest in expected.items():
 if hashlib.sha256((cache/name).read_bytes()).hexdigest()!=digest: raise ValueError(f'Source digest mismatch: {name}')
rows=json.loads((cache/'official-positioned.json').read_text())
dictionary={r['word'].lower():r for r in csv.DictReader(open(cache/'ecdict.csv'))}
dictionary['microwavable']={'word':'microwavable','translation':'a. 可用微波炉加热的','tag':''}
compact={re.sub('[^a-z]','',k):k for k in dictionary if ' ' in k or '-' in k or "'" in k}
entries={};missing=[]; mappings=[]
def expand(word):
 word=word.lower().replace('\U001001b3',"'").replace('é','e')
 parts=word.split('/');base=parts[0];forms=[]
 for p in parts:
  if p.startswith('-'): p=re.sub(r'\([^)]*\)','',base)[:-len(p)+1]+p[1:]
  variants=[re.sub(r'\([^)]*\)','',p),p.replace('(','').replace(')','')]
  for v in variants:
   v=v.strip();v=re.sub(r'\d+$','',v)
   if v not in dictionary and v in compact:v=compact[v]
   if v == 'connecxion':v='connexion'
   if v and v not in forms:forms.append(v)
 return forms
for row in rows:
 forms=expand(row['head']);mapped=[]
 for term in forms:
  if term not in dictionary:missing.append([term,row['head'],row['page'],'head']);continue
  r=dictionary[term];e=entries.setdefault(term,{'word':term,'accepted':[term],'translation':r['translation'],'levels':[],'original':[]})
  if row['level'] not in e['levels']:e['levels'].append(row['level'])
  e['original'].append({'page':row['page'],'head':row['head'],'kind':'head'});mapped.append(term)
  if '(' in row['head'] or '/-' in row['head']: e['accepted']=sorted(set(e['accepted']+[v for v in forms if v in dictionary]))
 mappings.append({'head':row['head'],'level':row['level'],'page':row['page'],'words':mapped})
 for raw in row['derived']:
  for term in expand(raw):
   if term not in dictionary:missing.append([term,raw,row['page'],'derived']);continue
   r=dictionary[term];e=entries.setdefault(term,{'word':term,'accepted':[term],'translation':r['translation'],'levels':[],'original':[]})
   if row['level'] not in e['levels']:e['levels'].append(row['level'])
   e['original'].append({'page':row['page'],'head':row['head'],'kind':'derived'})
# pypdf places some derived words on a separate text line after homograph indices.
for row in json.loads((cache/'official-rows.json').read_text()):
 for raw in [row['head'],*row['derived']]:
  for term in expand(raw):
   if term in dictionary and term not in entries:
    r=dictionary[term];entries[term]={'word':term,'accepted':[term],'translation':r['translation'],'levels':[row['level']],'original':[{'kind':'derived-text','page':row['page']}]}
# Supplement the syllabus with all CET-tagged entries from the pinned dictionary.
for term,r in dictionary.items():
 tags=set(r['tag'].split())&{'cet4','cet6'}
 if not tags:continue
 if term not in entries: entries[term]={'word':term,'accepted':[term],'translation':r['translation'],'levels':sorted(tags),'original':[{'kind':'dictionary-tag'}]}
# Explicit British/American variants, excluding different meanings such as a/an.
for pair in [('gray','grey'),('airplane','aeroplane'),('disk','disc'),('dispatch','despatch'),('esthetic','aesthetic'),('inquire','enquire'),('jail','gaol'),('maneuver','manoeuvre'),('plough','plow'),('skeptical','sceptical'),('specialty','speciality'),('sulfur','sulphur'),('tyre','tire')]:
 for term in pair:
  if term in entries: entries[term]['accepted']=sorted(set(entries[term]['accepted']+[v for v in pair if v in entries]))
# Keep the old curated IDs (all previously verified CET4 members) unchanged.
for e in entries.values():e['levels']=sorted(set(e['levels']))
print('entries',len(entries),'missing',len(missing));print(missing)
(cache/'missing.json').write_text(json.dumps(missing,ensure_ascii=False,indent=2))
coverage={'officialHeadRows':len(rows),'unmatchedVariants':missing,'officialDeclaredHeadwords':5418,'officialMappedRows':sum(bool(m['words']) for m in mappings),'officialUrl':'https://www.neea.edu.cn/res/Home/1704/55b02330ac17274664f06d9d3db8249d.pdf','officialSha256':hashlib.sha256((cache/'cet2016.pdf').read_bytes()).hexdigest(),'dictionaryCommit':'ab22ad36302cafc6349a050e2b60894855208055','dictionarySha256':hashlib.sha256((cache/'ecdict.csv').read_bytes()).hexdigest(),'note':'同形词合并；变体与派生词分别规范；词性和释义取自 ECDICT，82 个既有词保留人工题面。'}
(root/'prototypes/runlab/data/cet-source.json').write_text(json.dumps({'coverage':coverage,'entries':sorted(entries.values(),key=lambda e:e['word'])},ensure_ascii=False,separators=(',',':'))+'\n')
(cache/'head-mapping.json').write_text(json.dumps(mappings,ensure_ascii=False,indent=2))

(root/'docs/evidence/2026-10-26-wordbook/head-mapping.json').write_text(json.dumps(mappings,ensure_ascii=False,indent=2)+'\n')
