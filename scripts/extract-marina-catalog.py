import sys, json, pathlib
sys.path.insert(0, '.audit/pdf-tools')
import pymupdf

doc = pymupdf.open('.audit/reference-catalog/marina.pdf')
rows = []
carry = {}
cols = {'route':2, 'operator':5, 'vessel':8}
capacity_col = 12
for page_number, page in enumerate(doc):
    for table in page.find_tables().tables:
        data = [[None if c is None else ' '.join(c.split()) for c in r] for r in table.extract()]
        header = next((r for r in data if 'NAME OF VESSELS' in r), None)
        if header and ('NAME OF OPERATORS' not in header or 'ROUTE' not in header):
            print('SKIPPED HEADER',page_number+1,header)
            continue
        if header:
            cols = {key: header.index(label) for key, label in [('route','ROUTE'),('operator','NAME OF OPERATORS'),('vessel','NAME OF VESSELS')]}
            capacity_col = next((r.index('PASSENGER CAPACITY') for r in data if 'PASSENGER CAPACITY' in r), cols['vessel'] + 4)
        vessel_col = cols['vessel']
        for r in data[data.index(header)+2:] if header else data:
            if len(r)<=capacity_col:
                continue
            for key, index in cols.items():
                if r[index]:
                    carry[key] = ' '.join(r[index].split())
            name = r[vessel_col]
            if name and any(x in carry.get('operator','').lower() for x in ['montenegro', 'starlite']):
                rows.append({**carry, 'capacity': r[capacity_col], 'page':page_number+1, 'raw':r})
pathlib.Path('.audit/reference-catalog/marina-rows.json').write_text(json.dumps(rows,indent=2),encoding='utf8')
for row in rows:
    print(json.dumps({k:v for k,v in row.items() if k!='raw'},ensure_ascii=False))
