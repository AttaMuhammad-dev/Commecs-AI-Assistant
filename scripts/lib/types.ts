export interface WpItem {
  id: number;
  slug: string;
  link: string;
  title: { rendered: string };
  content?: { rendered: string };
  excerpt?: { rendered: string };
  modified_gmt: string;
  type: 'page' | 'post';
  categories?: number[];
}

export interface WpCategory {
  id: number;
  name: string;
}

export interface WpMedia {
  id: number;
  title: { rendered: string };
  source_url: string;
  modified_gmt: string;
  media_details?: { filesize?: number };
}

export type ProcessStatus = 'included' | 'excluded' | 'low_value' | 'listing' | 'failed' | 'removed';

export interface ManifestRecord {
  id: number;
  type: string;
  slug: string;
  title: string;
  url: string;
  modifiedGmt: string;
  wordCount: number;
  status: ProcessStatus;
  reason: string;
  timeSensitive: boolean;
  contentHash: string | null;
  file?: string;
  externalLinks?: string[];
}