import { BookOpen, ExternalLink, FileText } from 'lucide-react';
import { safeSourceUrl, type Source, type Language } from '../../shared/chat';
const text = {
  en: { heading: 'Sources for this answer', saved: 'Saved source date', modified: 'Page modified', reviewed: 'Review date', checked: 'Saved source compared', unknown: 'Date not recorded', open: 'Open official source' },
  ur: { heading: 'اس جواب کے ماخذ', saved: 'محفوظ ماخذ کی تاریخ', modified: 'صفحے میں تبدیلی کی تاریخ', reviewed: 'جائزے کی تاریخ', checked: 'محفوظ ماخذ کا موازنہ', unknown: 'تاریخ درج نہیں', open: 'سرکاری ماخذ کھولیں' },
  roman: { heading: 'Is jawab ke sources', saved: 'Mehfooz source ki date', modified: 'Page update ki date', reviewed: 'Review ki date', checked: 'Mehfooz source ka muqabla', unknown: 'Date darj nahi', open: 'Official source kholen' },
};
function date(value?: string) { return value && !Number.isNaN(Date.parse(value)) ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value)) : null; }
export default function SourceCards({ sources, language }: { sources: Source[]; language: Exclude<Language, 'auto'> }) {
  const safe = [...new Map(sources.filter(s => safeSourceUrl(s.url)).map(s => [s.url, s])).values()];
  if (!safe.length) return null;
  const labels = text[language];
  return <section className="sources" aria-label={labels.heading} dir={language === 'ur' ? 'rtl' : 'ltr'}>
    <div className="sources-heading"><BookOpen size={14} aria-hidden="true" /><span>{labels.heading}</span><span className="source-count">{safe.length}</span></div>
    <div className="source-list">{safe.map(source => {
      const modified = source.type === 'reviewed' ? null : date(source.modified);
      const reviewed = date(source.reviewedAt || (source.type === 'reviewed' ? source.modified : undefined));
      const checked = date(source.checkedAt);
      return <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" aria-label={`${labels.open}: ${source.title}`}>
        <span className="source-icon">{source.type === 'pdf' ? <FileText size={17} /> : <BookOpen size={17} />}</span>
        <span className="source-description"><strong>{source.title}{source.type === 'pdf' ? ' · PDF' : source.type === 'live' ? language === 'ur' ? ' · ویب سائٹ' : ' · Website lookup' : ''}</strong><small>{modified ? `${source.type === 'live' ? labels.modified : labels.saved}: ${modified}` : !reviewed ? labels.unknown : null}{modified && reviewed ? ' · ' : ''}{reviewed ? `${labels.reviewed}: ${reviewed}` : ''}{checked ? ` · ${labels.checked}: ${checked}` : ''}</small></span>
        <ExternalLink size={14} aria-hidden="true" />
      </a>;
    })}</div>
  </section>;
}
