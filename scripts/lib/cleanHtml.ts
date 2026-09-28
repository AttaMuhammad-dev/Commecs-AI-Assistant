import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const turndownService = new TurndownService({ 
  headingStyle: 'atx', 
  codeBlockStyle: 'fenced' 
});
turndownService.use(gfm);

export function decodeEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#038;/g, '&')
    .replace(/&#8211;/g, '-')
    // Clean up mangled UTF-8 / Windows-1252 artifacts from WordPress
    .replace(/â€“/g, '-')
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/â€™/g, "'")
    .replace(/\u00A0/g, ' ')
    .replace(/&nbsp;/g, ' ');
}

export function cleanHtml(html: string): string {
  if (!html) return '';
  const $ = cheerio.load(html);

  $('.elementor-hidden-desktop, .elementor-hidden-tablet, .elementor-hidden-mobile').remove();
  $('.eael-post-grid, .elementor-posts-container, .eael-load-more-button').remove();
  $('.elementor-counter').remove();
  $('footer, .site-footer, .elementor-location-footer').remove();
  
  $('*').each((_, el) => {
    const text = $(el).text().trim();
    if (/^0\s*[M+%]?$/.test(text)) {
      $(el).remove();
    }
  });

  // FIX: Force the first row of every table to use <th> tags so Turndown 
  // recognizes it as a Markdown table and formats it cleanly.
  $('table').each((_, table) => {
    const $table = $(table);
    if ($table.find('th').length === 0) {
      $table.find('tr').first().find('td').each((_, td) => {
        const $td = $(td);
        const $th = $('<th/>').html($td.html() || '');
        $td.replaceWith($th);
      });
    }
  });

  $('td[colspan], th[colspan]').each((_, el) => {
    const $el = $(el);
    const colspan = parseInt($el.attr('colspan') || '1', 10);
    $el.removeAttr('colspan');
    for (let i = 1; i < colspan; i++) {
      $el.after($el.clone());
    }
  });

  $('td[rowspan], th[rowspan]').each((_, el) => {
    const $el = $(el);
    const rowspan = parseInt($el.attr('rowspan') || '1', 10);
    $el.removeAttr('rowspan');
    const $tr = $el.closest('tr');
    const index = $el.index();
    let $nextTr = $tr.next();
    
    for (let i = 1; i < rowspan; i++) {
      if ($nextTr.length) {
        if (index === 0) {
          $nextTr.prepend($el.clone());
        } else {
          $nextTr.children().eq(index - 1).after($el.clone());
        }
        $nextTr = $nextTr.next();
      }
    }
  });

  $('td, th').find('p, h1, h2, h3, h4, h5, h6, div').each((_, el) => {
    const $el = $(el);
    $el.replaceWith($el.html()?.trim() + ' ' || '');
  });

  $('tr').each((_, el) => {
    if (!$(el).text().trim()) {
      $(el).remove();
    }
  });

  let markdown = turndownService.turndown($('body').html() || '');

  return decodeEntities(markdown);
}