import { load } from 'cheerio';
export function parseFaculty(html) {
  const $ = load(html);
  const records=[]; const seen=new Set();
  $('h4').each((_, el)=>{
    const name=$(el).text().replace(/\s+/g,' ').trim();
    const card=$(el).parent().parent().parent();
    if(card.find('h4').length!==1) throw Error('Faculty layout changed: ambiguous card.');
    const lines=card.find('p,h4').map((_,node)=>$(node).text().replace(/\s+/g,' ').trim()).get().filter(Boolean);
    const at=lines.indexOf(name);
    if(at!==1 || lines.length<4) throw Error(`Faculty layout changed: incomplete record for ${name}.`);
    const [department,,qualification,...roles]=lines;
    const key=`${department}|${name}`.toLowerCase();
    if(!seen.has(key)){seen.add(key);records.push({department,name,qualification,roles});}
  });
  if(records.length<40 || records.length!==$('h4').length) throw Error('Faculty extraction coverage check failed; existing directory preserved.');
  return records;
}
