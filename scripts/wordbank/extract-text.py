from pathlib import Path
import re,unicodedata,csv,json,collections
from pypdf import PdfReader
pdf=PdfReader('.cache/wordbank-v2/cet2016.pdf')
pages=[page.extract_text() for page in pdf.pages]
rows=[]
for page in range(20,149):
 for raw in pages[page].splitlines():
  line=unicodedata.normalize('NFKC',raw.replace('Ｇ','-')).strip()
  if not re.match(r'^(★\s*)?[A-Za-z]',line):continue
  parts=line.removeprefix('★').strip().split()
  rows.append({'head':parts[0],'derived':parts[1:],'level':'cet6' if line.startswith('★') else 'cet4','page':page+1,'raw':line})
print('rows',len(rows),'levels',collections.Counter(r['level'] for r in rows))
dictionary={r['word'].lower():r for r in csv.DictReader(open('.cache/wordbank-v2/ecdict.csv'))}
miss=[r for r in rows if r['head'].lower() not in dictionary]
print('missingraw',len(miss));print('\n'.join(r['head'] for r in miss))
Path('.cache/wordbank-v2/official-rows.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
