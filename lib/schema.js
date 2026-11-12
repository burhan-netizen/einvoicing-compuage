// Single source of truth for the form. Used by the browser (bundled) and by the API.
import { EMIRATES, EMIRATE_NAMES, OTHER } from './uae.js';

const isUae = v => v.country === 'AE';
const emirate = v => EMIRATES[v.emirate];

export const ENTITY_TYPES = [
  'Limited Liability Company (LLC)',
  'Sole Establishment',
  'Free Zone Company (FZE / FZ-LLC / FZCO)',
  'Branch of a Foreign Company',
  'Civil Company',
  'Public / Private Joint Stock Company (PJSC / PrJSC)',
  'Government Entity',
  'Other',
];

export const PHASES = [
  { value: 'Phase 1', title: 'Phase 1', text: 'Annual revenue AED 50m and above', meta: 'Go-live 1 Jan 2027' },
  { value: 'Phase 2', title: 'Phase 2', text: 'Annual revenue below AED 50m', meta: 'Go-live 1 Jul 2027' },
  { value: 'Phase 3', title: 'Phase 3', text: 'Government Entity', meta: '' },
];

const YES_NO = ['Yes', 'No'];
const YES_NO_NA = ['Yes', 'No', 'Not applicable'];
const YES_NO_PROGRESS = ['Yes', 'No', 'In progress'];

export const MAX_FILE_MB = 10;
export const FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

const personContact = [
  { name: 'phone', label: 'Direct mobile number', type: 'phone', required: true },
  { name: 'email', label: 'Direct email address', type: 'email', required: true },
];

export const SECTIONS = [
  {
    id: 'company',
    title: 'Supplier company information',
    subtitle: 'As shown on your trade licence.',
    fields: [
      { name: 'legalName', label: "Supplier's legal company name", type: 'text', required: true, placeholder: 'Exactly as on the trade licence', autocomplete: 'organization' },
      { name: 'tradeLicenceNo', label: 'Trade licence number', type: 'text', required: true },
      { name: 'establishmentDate', label: 'Company establishment date', type: 'date', required: true, half: true,
        hint: 'The date your company was first registered, as shown on the trade licence.' },
      { name: 'tradeLicenceExpiry', label: 'Trade licence expiry date', type: 'date', required: true, half: true },
      { name: 'entityType', label: 'Entity type', type: 'select', options: ENTITY_TYPES, required: true },
      { name: 'entityTypeOther', label: 'Please specify the entity type', type: 'text', required: true, showIf: v => v.entityType === 'Other' },
      { name: 'address', label: 'Registered business address', type: 'textarea', required: true, placeholder: 'Building, street, area' },
      { name: 'poBox', label: 'Postal code / P.O. Box', type: 'text', required: true, half: true },
      { name: 'city', label: 'City', type: 'text', required: true, half: true, autocomplete: 'address-level2' },
      { name: 'country', label: 'Country', type: 'country', required: true },
      { name: 'emirate', label: 'Emirate', type: 'select', options: EMIRATE_NAMES, required: true, showIf: isUae,
        // Choosing an emirate preselects its mainland department and clears a free zone from another emirate.
        onChange: (val, v) => ({
          licensingAuthority: EMIRATES[val].mainland[0],
          licensingAuthorityOther: '',
          freeZoneUae: EMIRATES[val].freeZones.includes(v.freeZoneUae) ? v.freeZoneUae : '',
        }) },
      { name: 'freeZone', label: 'Is your entity or branch incorporated in a Free Trade Zone?', type: 'choice', options: YES_NO, required: true,
        showIf: v => !isUae(v) || !!v.emirate },
      { name: 'licensingAuthority', label: 'Licensing authority', type: 'select', required: true,
        options: v => (emirate(v) ? [...emirate(v).mainland, OTHER] : [OTHER]),
        showIf: v => isUae(v) && !!emirate(v) && v.freeZone === 'No', hint: 'Filled in from the emirate. Change it if your licence was issued by another department.' },
      { name: 'licensingAuthorityOther', label: 'Name of the licensing authority', type: 'text', required: true,
        showIf: v => isUae(v) && v.freeZone === 'No' && v.licensingAuthority === OTHER },
      { name: 'freeZoneUae', label: 'Free Zone', type: 'select', required: true,
        options: v => (emirate(v) ? [...emirate(v).freeZones, OTHER] : [OTHER]), placeholder: 'Select your Free Zone',
        showIf: v => isUae(v) && !!emirate(v) && v.freeZone === 'Yes' },
      { name: 'freeZoneOther', label: 'Name of the Free Zone', type: 'text', required: true,
        showIf: v => isUae(v) && v.freeZone === 'Yes' && v.freeZoneUae === OTHER },
      { name: 'freeZoneName', label: 'Name of the Free Zone', type: 'text', showIf: v => !isUae(v) && v.freeZone === 'Yes' },
      { name: 'licensingAuthorityText', label: 'Licensing authority', type: 'text', hint: 'If applicable', showIf: v => !!v.country && !isUae(v) },
      { name: 'landline', label: 'Landline number', type: 'phone', hint: 'If available' },
      { name: 'mobile', label: 'Mobile number', type: 'phone', required: true },
      { name: 'companyEmail', label: 'Official company email address', type: 'email', required: true },
      { name: 'contactName', label: 'Primary contact person name', type: 'text', required: true, half: true, autocomplete: 'name' },
      { name: 'designation', label: 'Designation', type: 'text', required: true, half: true, autocomplete: 'organization-title' },
      { name: 'email', label: 'Primary contact email address', type: 'email', required: true, autocomplete: 'email', hint: 'A copy of your submission will be sent here.' },
    ],
  },
  {
    id: 'tax',
    title: 'VAT and tax information',
    subtitle: 'Registration details with the UAE Federal Tax Authority.',
    fields: [
      { name: 'vatRegistered', label: 'Are you registered for UAE VAT?', type: 'choice', options: YES_NO_NA, required: true },
      { name: 'trn', label: 'UAE VAT Tax Registration Number (TRN)', type: 'text', required: true, inputmode: 'numeric', placeholder: '15 digits', maxlength: 15,
        showIf: v => v.vatRegistered === 'Yes', validate: x => /^\d{15}$/.test(x) ? '' : 'The TRN should be exactly 15 digits.' },
      { name: 'vatGroup', label: 'Are you registered for a VAT tax group?', type: 'choice', options: YES_NO, required: true, showIf: v => v.vatRegistered === 'Yes' },
      { name: 'vatGroupName', label: 'VAT group company name', type: 'text', required: true, showIf: v => v.vatRegistered === 'Yes' && v.vatGroup === 'Yes' },
      { name: 'tin', label: 'Tax Identification Number (TIN)', type: 'text', half: true, hint: 'If applicable' },
      { name: 'ctNumber', label: 'Corporate Tax number', type: 'text', half: true, hint: 'If applicable' },
      { name: 'iorNumber', label: 'Importer of Record (IOR) number', type: 'text', hint: 'If applicable' },
    ],
  },
  {
    id: 'einvoicing',
    title: 'e-Invoicing readiness',
    subtitle: 'Where you are with the UAE e-Invoicing rollout.',
    fields: [
      { name: 'phase', label: 'Applicable e-Invoicing phase', type: 'cards', options: PHASES, required: true },
      { name: 'aspAppointed', label: 'Have you appointed an Accredited Service Provider (ASP)?', type: 'choice', options: YES_NO_PROGRESS, required: true },
      { name: 'aspName', label: 'Name of your Accredited Service Provider', type: 'text', required: v => v.aspAppointed === 'Yes',
        showIf: v => v.aspAppointed === 'Yes' || v.aspAppointed === 'In progress' },
      { name: 'peppol', label: 'Do you have a Peppol ID?', type: 'choice', options: YES_NO_PROGRESS, required: true },
      { name: 'peppolId', label: 'Your Peppol ID', type: 'text', required: true, placeholder: 'For example, 0235:1001234567', showIf: v => v.peppol === 'Yes' },
      { name: 'implDate', label: 'Expected e-Invoicing implementation date', type: 'date', required: true },
    ],
  },
  {
    id: 'ownership',
    title: 'Owners and authorised signatories',
    subtitle: 'As shown on your trade licence. Use "Add another" for each additional person.',
    fields: [
      { name: 'owners', type: 'group', label: "Owners / Partners' details", itemLabel: 'Owner / Partner', addLabel: 'Add another owner / partner',
        hint: 'Shareholders or partners as listed on the trade licence. Shares must add up to 100%.', min: 1,
        fields: [
          { name: 'fullName', label: 'Shareholder / partner name', type: 'text', required: true },
          { name: 'nationality', label: 'Nationality', type: 'country', required: true, half: true },
          { name: 'share', label: '% of share', type: 'percent', required: true, half: true },
          { name: 'role', label: 'Designation / role', type: 'text', required: true },
          ...personContact,
        ],
        validateGroup: items => {
          const total = items.reduce((a, it) => a + (parseFloat(it.share) || 0), 0);
          return Math.abs(total - 100) < 0.01 ? '' : `The shares add up to ${+total.toFixed(2)}%. They need to total 100%.`;
        } },
      { name: 'signatories', type: 'group', label: 'Authorised signatory details', itemLabel: 'Authorised signatory', addLabel: 'Add another authorised signatory', min: 1,
        fields: [
          { name: 'sameAsOwner', label: 'This signatory is also one of the owners / partners above', type: 'checkbox' },
          { name: 'ownerRef', label: 'Which owner / partner?', type: 'select', required: true, placeholder: 'Select the owner / partner',
            options: v => (v.owners || []).map(o => String(o.fullName || '').trim()).filter(Boolean),
            showIf: (v, it) => !!(it && it.sameAsOwner), hint: 'Their documents are taken from the owner, so you will not need to upload them again.' },
          { name: 'fullName', label: 'Full name', type: 'text', required: true, half: true },
          { name: 'designation', label: 'Designation', type: 'text', required: true, half: true },
          { name: 'nationality', label: 'Nationality', type: 'country', required: true, half: true },
          { name: 'idNumber', label: 'Emirates ID / Passport number', type: 'text', required: true, half: true },
          { name: 'phone', label: 'Direct contact number', type: 'phone', required: true },
          { name: 'email', label: 'Direct email address', type: 'email', required: true },
        ] },
    ],
  },
  {
    id: 'accounts',
    title: 'Account department details',
    subtitle: 'The people in your accounts team we will work with on invoices.',
    fields: [
      { name: 'accountDept', type: 'group', label: 'Account department contacts', itemLabel: 'Accounts contact', addLabel: 'Add another accounts contact', min: 1,
        fields: [
          { name: 'fullName', label: 'Full name', type: 'text', required: true, half: true },
          { name: 'designation', label: 'Designation', type: 'text', required: true, half: true },
          { name: 'nationality', label: 'Nationality', type: 'country', required: true, half: true },
          { name: 'idNumber', label: 'Emirates ID / Passport number', type: 'text', required: true, half: true },
          { name: 'phone', label: 'Contact number', type: 'phone', required: true },
          { name: 'email', label: 'Email address', type: 'email', required: true },
        ] },
    ],
  },
  {
    id: 'documents',
    title: 'Documents to attach',
    subtitle: `Documents marked * are required. PDF, JPG or PNG, up to ${MAX_FILE_MB} MB each.`,
    fields: [{ name: 'docs', type: 'docs' }],
  },
];

// Documents asked for every person in sections 3, 4 and 5.
const PERSON_DOCS = {
  owners: [
    { id: 'passport', label: 'Passport copy' },
    { id: 'visa', label: 'UAE visa copy', allowNA: true },
    { id: 'eid', label: 'Emirates ID (both sides)', allowNA: true, max: 2 },
  ],
  signatories: [
    { id: 'passport', label: 'Passport copy' },
    { id: 'visa', label: 'UAE visa copy', allowNA: true },
    { id: 'eid', label: 'Emirates ID (both sides)', allowNA: true, max: 2 },
  ],
  accountDept: [
    { id: 'passport', label: 'Passport copy' },
    { id: 'eid', label: 'Emirates ID (both sides)', allowNA: true, max: 2 },
  ],
};

// Every document slot the supplier must fill, worked out from their answers.
export function docSlots(values) {
  const slots = [];
  const company = 'Company documents';
  slots.push({ key: 'tradeLicenceFile', group: company, label: 'Trade licence copy', required: true });
  if (values.vatRegistered === 'Yes') slots.push({ key: 'vatCertFile', group: company, label: 'VAT registration certificate', required: true });
  const hasCt = !!String(values.ctNumber || '').trim();
  slots.push({ key: 'ctCertFile', group: company, label: 'Corporate Tax certificate', required: hasCt,
    hint: hasCt ? '' : 'Required only if you have a Corporate Tax number.' });
  slots.push({ key: 'ejariFile', group: company, label: 'Ejari / tenancy contract copy', required: true });
  for (const s of SECTIONS) for (const g of s.fields) {
    if (g.type !== 'group' || !PERSON_DOCS[g.name]) continue;
    (Array.isArray(values[g.name]) ? values[g.name] : []).forEach((it, i) => {
      if (g.name === 'signatories' && it.sameAsOwner) return;
      const who = String(it.fullName || '').trim();
      PERSON_DOCS[g.name].forEach(d => slots.push({
        key: `${g.name}.${i}.${d.id}`, group: `${g.itemLabel} ${i + 1}${who ? `: ${who}` : ''}`, label: d.label,
        required: true, allowNA: !!d.allowNA, max: d.max || 1,
      }));
    });
  }
  return slots;
}

// Shared check for one slot. doc = { files: [...], na, reason }.
export function checkDoc(slot, doc) {
  const count = doc && Array.isArray(doc.files) ? doc.files.length : 0;
  if (count) return '';
  if (slot.allowNA && doc && doc.na) return String(doc.reason || '').trim() ? '' : 'Please say why this document is not applicable.';
  return slot.required ? 'Please attach this document.' : '';
}

export const DECLARATION =
  'I hereby confirm that the information provided in this form is true, accurate and complete to the best of my knowledge. ' +
  'I agree to notify CompuAge Computers L.L.C. of any changes to the above information, including changes to VAT registration details, ' +
  'company information and e-Invoicing arrangements.';

export const isShown = (f, v) => !f.showIf || f.showIf(v);
export const isRequired = (f, v) => (typeof f.required === 'function' ? f.required(v) : !!f.required);
export const groupItems = (values, g) => (Array.isArray(values[g.name]) && values[g.name].length ? values[g.name] : []);
export const GROUPS = () => SECTIONS.flatMap(s => s.fields.filter(f => f.type === 'group'));

function checkField(f, val, ctx) {
  if (f.type === 'checkbox') return '';
  const empty = f.type === 'file' ? !val : f.type === 'phone' ? !(val && val.number) : !String(val ?? '').trim();
  if (empty) return isRequired(f, ctx) ? (f.type === 'file' ? 'Please attach this document.' : 'This field is required.') : '';
  if (f.type === 'select') { const opts = typeof f.options === 'function' ? f.options(ctx) : f.options; if (!opts.includes(val)) return 'Please choose an option from the list.'; }
  if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(val).trim())) return 'Please enter a valid email address.';
  if (f.type === 'percent') { const n = parseFloat(val); if (!(n > 0 && n <= 100)) return 'Enter a percentage between 0 and 100.'; }
  if (f.validate) return f.validate(String(val).trim()) || '';
  return '';
}

// Returns { key: message } for one section (or all when id is omitted). Keys inside groups look like owners.0.fullName.
export function validate(values, sectionId) {
  const errors = {};
  for (const s of SECTIONS) {
    if (sectionId && s.id !== sectionId) continue;
    for (const f of s.fields) {
      if (!isShown(f, values)) continue;
      if (f.type === 'group') {
        const items = groupItems(values, f);
        if (items.length < (f.min || 0)) { errors[f.name] = `Please add at least ${f.min} ${f.itemLabel.toLowerCase()}.`; continue; }
        items.forEach((it, i) => f.fields.forEach(sf => {
          if (sf.showIf && !sf.showIf(values, it)) return;
          const m = checkField(sf, it[sf.name], values);
          if (m) errors[`${f.name}.${i}.${sf.name}`] = m;
        }));
        if (f.validateGroup && items.length) { const m = f.validateGroup(items); if (m) errors[f.name] = m; }
        continue;
      }
      if (f.type === 'docs') {
        for (const slot of docSlots(values)) { const m = checkDoc(slot, (values.docs || {})[slot.key]); if (m) errors[`docs.${slot.key}`] = m; }
        continue;
      }
      const m = checkField(f, values[f.name], values);
      if (m) errors[f.name] = m;
    }
  }
  return errors;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const formatDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : iso; };

export function displayValue(f, v, countryName = c => c) {
  if (v == null || v === '') return '';
  if (f.type === 'country') return countryName(v);
  if (f.type === 'phone') return v.number ? `+${v.dial} ${v.number}` : '';
  if (f.type === 'date') return formatDate(v);
  if (f.type === 'percent') return `${+parseFloat(v).toFixed(2)}%`;
  if (f.type === 'file') return v ? (v.name || 'Attached') : '';
  return String(v);
}

// Flat list of rows for email, PDF and review. Each person in a group becomes one row with one line per answer.
export function summaryRows(values, countryName = c => c) {
  const rows = [];
  for (const s of SECTIONS) {
    for (const f of s.fields) {
      if (!isShown(f, values) || f.type === 'file' || f.type === 'docs') continue;
      if (f.type === 'group') {
        groupItems(values, f).forEach((it, i) => {
          const lines = f.fields.filter(sf => !sf.showIf || sf.showIf(values, it)).filter(sf => sf.type !== 'checkbox' || it[sf.name])
            .map(sf => sf.type === 'checkbox' ? 'Also an owner / partner' : `${sf.label}: ${displayValue(sf, it[sf.name], countryName) || 'Not provided'}`);
          rows.push({ section: s.title, name: `${f.name}.${i}`, group: f.name, label: `${f.itemLabel} ${i + 1}`, value: lines.join('\n') });
        });
        continue;
      }
      rows.push({ section: s.title, name: f.name, label: f.label, value: displayValue(f, values[f.name], countryName) });
    }
  }
  return rows;
}

// Compact one-line-per-person text for a spreadsheet cell, and one record per person for the People tab.
export function peopleRecords(values, countryName = c => c) {
  const cells = {}, people = [];
  for (const g of GROUPS()) {
    const items = groupItems(values, g);
    cells[g.label] = items.map(it => g.fields.filter(sf => sf.type !== 'file' && sf.type !== 'checkbox')
      .map(sf => displayValue(sf, it[sf.name], countryName)).filter(Boolean).join(', ')).join('\n');
    items.forEach((it, i) => {
      const rec = { Type: g.itemLabel, 'No.': i + 1 };
      g.fields.forEach(sf => { if (sf.type !== 'file') rec[sf.label] = sf.type === 'checkbox' ? (it[sf.name] ? 'Yes' : 'No') : displayValue(sf, it[sf.name], countryName); });
      people.push(rec);
    });
  }
  return { cells, people };
}

// One row per document slot for review, email and PDF.
export function docRows(values) {
  return docSlots(values).map(slot => {
    const d = (values.docs || {})[slot.key] || {};
    const names = (d.files || []).map(f => f.name || 'Attached');
    return { ...slot, value: names.length ? names.join(', ') : d.na ? `Not applicable: ${String(d.reason || '').trim()}` : '' };
  });
}
