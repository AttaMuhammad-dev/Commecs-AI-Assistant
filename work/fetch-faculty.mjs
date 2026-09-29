import fs from 'node:fs';
import {load} from 'cheerio';
const response=await fetch('https://commecscollege.edu.pk/wp-json/wp/v2/pages?slug=faculty&_fields=id,link,modified_gmt,content',{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(`HTTP ${response.status}`);const pages=await response.json();fs.writeFileSync('work/faculty-live.json',JSON.stringify(pages));const $=load(pages[0].content.rendered);const h=$('h4').filter((_,e)=>$(e).text().includes('Ammar'));console.log(h.parent().parent().parent().html()?.slice(0,7000));console.log({headings:$('h4').length});
