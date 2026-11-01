import pdfplumber,re,json,unicodedata,collections
from pathlib import Path
rows=[]
with pdfplumber.open('.cache/wordbank-v2/cet2016.pdf') as pdf:
 for index in range(20,149):
  words=pdf.pages[index].extract_words(x_tolerance=1,y_tolerance=2)
  latin=[w for w in words if re.match(r'^(?:★)?[A-Za-z]',w['text']) and w['top']>70 and w['top']<700]
  base=min(w['x0'] for w in latin)
  heads=[w for w in latin if w['x0']<100]
  stars=[w for w in words if '★' in w['text']]
  for h in heads:
   same=[w for w in latin if abs(w['top']-h['top'])<2 and w['x0']>h['x0']]
   head=[h['text']]+[w['text'] for w in same if w['x0']<base+80]
   derived=[w['text'] for w in same if w['x0']>=base+80]
   normalize=lambda s:unicodedata.normalize('NFKC',s.replace('Ｇ','-').replace('\U001001b3',"'"))
   rows.append({'head':re.sub(r'\d+$','',normalize(' '.join(head)).lstrip('★')),'derived':[normalize(w) for w in derived],'level':'cet6' if h['text'].startswith('★') or any(abs(w['top']-h['top']-7.336224)<2 for w in stars) else 'cet4','page':index+1})
print('heads',len(rows),collections.Counter(r['level'] for r in rows))
Path('.cache/wordbank-v2/official-positioned.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
print(rows[:12])
