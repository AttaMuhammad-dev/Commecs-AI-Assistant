const excludeSlugs = [
  'sample-page', 
  'faculty-duplicate-976', 
  'macro-plans-2021-2022', 
  'time-table-2021-2022',
  'home-1',
  'blog'
];

const includeSlugs = [
  'about', 
  'alumni-discount'
];

export function classifyDocument(
  slug: string, 
  markdown: string, 
  originalHtml: string
): { status: string; linkOnly?: boolean; hadListingWidget?: boolean } {
  
  if (excludeSlugs.includes(slug)) return { status: 'excluded' };
  if (includeSlugs.includes(slug)) return { status: 'included' };

  // Safeguard: Force a string type so .split() never throws
  const safeMarkdown = markdown || '';

  const wordCount = safeMarkdown.split(/\s+/).filter(w => w.length > 0).length;
  const hasLinks = safeMarkdown.includes('](');
  const hasMedia = safeMarkdown.includes('![');
  const hadListingWidget = originalHtml.includes('elementor-posts-container') || originalHtml.includes('eael-post-grid');

  let status = 'included';
  let linkOnly = false;

  if (wordCount < 30) {
    if (hasLinks) {
      linkOnly = true;
    } else if (!hasMedia) {
      status = 'low_value';
    }
  }

  return { 
    status, 
    ...(linkOnly && { linkOnly }), 
    ...(hadListingWidget && { hadListingWidget }) 
  };
}