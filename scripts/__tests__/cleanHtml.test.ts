import { describe, it, expect } from 'vitest';
import { cleanHtml } from '../lib/cleanHtml';

describe('cleanHtml Rules', () => {
  it('unwraps block elements inside table cells for proper GFM rendering', () => {
    // Turndown strictly requires a <th> row to trigger table conversion
    const html = `<table><tr><th>Header</th></tr><tr><td><p><strong>Mid-Term Examination</strong></p></td></tr></table>`;
    const markdown = cleanHtml(html);
    expect(markdown).toContain('| **Mid-Term Examination** |');
    expect(markdown).not.toContain('<p>');
  });

  it('decodes entities and normalizes spaces', () => {
    const html = `<p>Test&nbsp;Space &#8211; Dash</p>`;
    const markdown = cleanHtml(html);
    expect(markdown).toContain('Test Space – Dash');
  });

  it('converts Elementor buttons to links', () => {
    const html = `<a href="/apply" class="elementor-button elementor-size-sm">Apply Now</a>`;
    const markdown = cleanHtml(html);
    expect(markdown).toContain('[Apply Now](/apply)');
  });

  it('collapses duplicated responsive headings', () => {
    const html = `<h2 class="elementor-hidden-desktop">Programs</h2><h2>Programs</h2><p>Content</p>`;
    const markdown = cleanHtml(html);
    const matches = markdown.match(/## Programs/g);
    expect(matches?.length).toBe(1);
  });
});