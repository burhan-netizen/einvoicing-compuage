import { getCountries, getCountryCallingCode } from 'libphonenumber-js/min';
import { writeFileSync } from 'node:fs';
const dn = new Intl.DisplayNames(['en'], { type: 'region' });
const list = getCountries().map(c => ({ code: c, name: dn.of(c), dial: getCountryCallingCode(c) }))
  .filter(c => c.name && c.name !== c.code)
  .sort((a, b) => a.name.localeCompare(b.name));
writeFileSync('src/countries.js', 'export const COUNTRIES = ' + JSON.stringify(list) + ';\n');
console.log(list.length);
