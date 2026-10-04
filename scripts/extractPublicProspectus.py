"""Extract public campus/student-life pages; never add application/result lists.
Usage: python scripts/extractPublicProspectus.py path/to/official-prospectus.pdf
Requires pypdf. The original PDF stays outside the repository.
"""
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from pypdf import PdfReader

pdf = Path(sys.argv[1])
reader = PdfReader(pdf)
if len(reader.pages) != 62:
    raise ValueError("Recheck page ranges before using a different prospectus edition")
pages = list(range(9, 27))
sections = []
for number in pages:
    text = reader.pages[number - 1].extract_text() or ""
    text = text.replace("\x02", "-").replace("\x00", "")
    lines = [line.strip() for line in text.splitlines()]
    lines = [line for line in lines if line and "YEARS OF ACADEMIC EXCELLENCE" not in line and not re.fullmatch(r"COMMECS|COLLEGE|20(?:22|26)|\d+\.", line)]
    sections.append(f"## Prospectus PDF page {number}\n\n" + "\n".join(lines))
text = "# Campus and student life — Admission Prospectus 2026\n\nPublic extracts from PDF pages 9–26. The prospectus contains some older page headers; publication year is not a guarantee of current club membership or availability. Financial/admission rules and personal records are outside these selected sections.\n\n" + "\n\n".join(sections) + "\n"
if not all(term in text for term in ["IT Club", "Commecs Choir Club", "Horticulture", "Science", "Library"]):
    raise ValueError("Required public sections were not extracted reliably")
folder = Path("knowledge/documents")
folder.mkdir(parents=True, exist_ok=True)
(folder / "prospectus-2026-campus-student-life.md").write_text(text, encoding="utf-8")
manifest = [{"id": "prospectus-2026-campus-student-life", "title": "Campus and student life — Admission Prospectus 2026", "url": "https://commecscollege.edu.pk/wp-content/uploads/2025/12/Commecs-College-Brochure-2026.pdf", "file": "prospectus-2026-campus-student-life.md", "pages": pages, "publicationYear": 2026, "extractedAt": datetime.now(timezone.utc).isoformat(), "sha256": hashlib.sha256(pdf.read_bytes()).hexdigest(), "keywords": "campus facilities library computer internet wifi laboratories cafeteria medical auditorium sports transport clubs societies activities publications community service industrial visits student counselling character development"}]
(folder / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Extracted {len(pages)} public pages, {len(text)} characters")
