"""Extract the visually checked five-page 2026-27 public timetable layout.

Requires pdfplumber; outputs JSON and page PNGs for visual comparison. A different
layout/session fails instead of silently guessing groups, cells or teacher names.
"""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--pdf', required=True)
parser.add_argument('--out', default='server/data/timetable.json')
parser.add_argument('--images', default='tmp/timetable-review')
args = parser.parse_args()

import pdfplumber

source = Path(args.pdf)
groups = [('XI PM', 3), ('XII PM', 4), ('XI PE', 2), ('XII PE', 2),
          ('XI CS', 5), ('XII CS', 5), ('XI COM', 3), ('XII COM', 2)]
expected = [group for group, count in groups for _ in range(count)]
image_dir = Path(args.images)
image_dir.mkdir(parents=True, exist_ok=True)
rows = []
with pdfplumber.open(source) as pdf:
    assert len(pdf.pages) == 5, 'Review the new layout before extraction'
    for index, page in enumerate(pdf.pages):
        tables = page.extract_tables()
        assert len(tables) == 1 and len(tables[0]) == 30, 'Unexpected rows'
        table = tables[0]
        day = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][index]
        assert table[3][2] == day.upper() and '2026-2027' in table[0][0]
        periods = 6 if day == 'Friday' else 9
        assert table[1][3:] == list(map(str, range(1, periods + 1)))
        assert len(table[2][3:]) == periods
        for group, row in zip(expected, table[4:]):
            assert len(row) == periods + 3 and row[1]
            assert all(cell is not None for cell in row[3:]), 'Ambiguous period'
            rows.append(dict(day=day, group=group, section=row[1],
                             location=row[2] if row[2] not in ['LOCATION\nSUBJECT', ''] else '',
                             periods=row[3:], times=table[2][3:], page=index + 1))
        page.to_image(resolution=150).save(image_dir / f'page-{index + 1}.png')

data = dict(notice='https://commecscollege.edu.pk/news/time-table-updated/',
            published='2026-08-24', session='2026-2027',
            source='https://commecscollege.edu.pk/wp-content/uploads/2026/08/Revised-TT-Session-2026-2027-1.pdf',
            extractedAt=datetime.now(timezone.utc).isoformat(),
            sha256=hashlib.sha256(source.read_bytes()).hexdigest(), rows=rows,
            note='Public class timetable. Codes retained without guessing teacher names. '
                 'Compare all page images before accepting this extraction; not independent college review.')
target = Path(args.out)
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print(f'Extracted {len(rows)} rows. Compare the five original page images before committing.')
