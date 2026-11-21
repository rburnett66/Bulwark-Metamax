/**
 * src/comm/shortName.js — what people call a character in passing: "Otto", "Grace", "Null", "the Signal"
 * [MM-story_mwp61bjm_33]. Used when one character speaks about another (a rumour: "About Otto: ...").
 * Titles are dropped; a nickname stands in when the title is all there is ("Navigator AI 'Vector'" → "Vector").
 */
const TITLES = new Set(('Quartermaster Sergeant Captain Colonel Freikorps raider Field-Marshal General Chancellor Mechanic Ace ' +
  'Squadron-Mother Renegade Sky-Marshal Wing-Commander Actuary Hacker R&D Lead CFO Black-ops broker Chief Ethicist Dr. COO CEO ' +
  'Logistician Spotter Chaplain-Gunner Major Fire-Director Warlord-Gunner Grand-Bombardier Ferryman Old Corsair Wavecaller ' +
  'Chieftain Raider-Chief Drowned Tide-Priestess Leviathan-Binder Abyssal Sovereign Archivist Heretic Acolyte-Scholar ' +
  'Lightbearer Warlock Hierophant Inquisitor Navigator AI Cadet-Prodigy Science-Officer Commander Privateer Envoy Admiral ' +
  'Grand-Cartographer Doctrinist Firebrand Organizer Sister Enforcer Composter Splinter Delegate Steward Mother-Spore ' +
  'Blight-Agitator Overseer Reformer Vanguard Architect Ordained Prime').split(' '));

export function shortName(name) {
  const raw = String(name || '');
  const nick = (raw.match(/"([^"]+)"/) || [])[1] || null;
  // a nickname straight after the titles is what people use ('Sergeant "Bricks" Malloy' -> Bricks)
  const beforeNick = nick ? raw.slice(0, raw.indexOf('"')).trim().split(/\s+/).filter(Boolean) : null;
  if (nick && beforeNick.every((w) => TITLES.has(w))) return nick;
  let bare = raw.replace(/\s*\(.*?\)\s*/g, ' ').replace(/"[^"]*"/g, ' ').replace(/\s+/g, ' ').trim();
  if (bare.includes(', ')) return bare.split(', ').pop();
  const words = bare.split(' ');
  if (words[0] === 'The') {
    const rest = words.slice(1), named = rest.filter((w) => !TITLES.has(w));
    return named.length && named.length < rest.length ? named[0] : 'the ' + rest.join(' ');
  }
  return words.find((w) => !TITLES.has(w)) || nick || bare;
}
