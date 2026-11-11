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

export const SECTIONS = [
  {
    id: 'company',
    title: 'Company information',
    subtitle: 'As shown on your trade licence.',
    fields: [
      { name: 'legalName', label: 'Legal company name', type: 'text', required: true, placeholder: 'Exactly as on the trade licence', autocomplete: 'organization' },
      { name: 'tradeLicenceNo', label: 'Trade licence number', type: 'text', required: true },
      { name: 'establishmentDate', label: 'Company establishment date', type: 'date', required: true, half: true,
        hint: 'The date your company was first registered, as shown on the trade licence.' },
      { name: 'tradeLicenceExpiry', label: 'Trade licence expiry date', type: 'date', required: true, half: true },
      { name: 'country', label: 'Country of registration', type: 'country', required: true },
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
      { name: 'address', label: 'Registered business address', type: 'textarea', required: true, placeholder: 'Building, street, area, city' },
      { name: 'poBox', label: 'Postal code / P.O. Box', type: 'text', required: true, half: true },
      { name: 'entityType', label: 'Entity type', type: 'select', options: ENTITY_TYPES, required: true, half: true },
      { name: 'entityTypeOther', label: 'Please specify the entity type', type: 'text', required: true, showIf: v => v.entityType === 'Other' },
    ],
  },
  {
    id: 'contact',
    title: 'Primary contact',
    subtitle: 'The person we should contact about invoicing.',
    fields: [
      { name: 'contactName', label: 'Contact person name', type: 'text', required: true, half: true, autocomplete: 'name' },
      { name: 'designation', label: 'Designation', type: 'text', required: true, half: true, autocomplete: 'organization-title' },
      { name: 'email', label: 'Official email address', type: 'email', required: true, autocomplete: 'email', hint: 'A copy of your submission will be sent here.' },
      { name: 'phone', label: 'Contact number', type: 'phone', required: true },
    ],
  },
  {
    id: 'tax',
    title: 'VAT and tax',
    subtitle: 'Registration details with the UAE Federal Tax Authority.',
    fields: [
      { name: 'vatRegistered', label: 'Are you registered for UAE VAT?', type: 'choice', options: YES_NO_NA, required: true },
      { name: 'trn', label: 'UAE VAT Tax Registration Number (TRN)', type: 'text', required: true, inputmode: 'numeric', placeholder: '15 digits', maxlength: 15,
        showIf: v => v.vatRegistered === 'Yes', validate: x => /^\d{15}$/.test(x) ? '' : 'The TRN should be exactly 15 digits.' },
      { name: 'vatGroup', label: 'Are you registered as part of a VAT tax group?', type: 'choice', options: YES_NO, required: true, showIf: v => v.vatRegistered === 'Yes' },
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
      { name: 'peppolId', label: 'Your Peppol ID', type: 'text', required: true, placeholder: 'For example, 0235:100000000000003', showIf: v => v.peppol === 'Yes' },
      { name: 'implDate', label: 'Expected e-Invoicing implementation date', type: 'date', required: true },
    ],
  },
  {
    id: 'documents',
    title: 'Supporting documents',
    subtitle: `PDF, JPG or PNG, up to ${MAX_FILE_MB} MB each.`,
    fields: [
      { name: 'tradeLicenceFile', label: 'Trade licence copy', type: 'file', required: true },
      { name: 'vatCertFile', label: 'VAT registration certificate', type: 'file', required: v => v.vatRegistered === 'Yes',
        hint: 'Required if you are registered for UAE VAT.' },
      { name: 'ctCertFile', label: 'Corporate Tax certificate', type: 'file', hint: 'If applicable' },
    ],
  },
];

export const DECLARATION =
  'I hereby confirm that the information provided in this form is true, accurate and complete to the best of my knowledge. ' +
  'I agree to notify CompuAge Computers L.L.C. of any changes to the above information, including changes to VAT registration details, ' +
  'company information and e-Invoicing arrangements.';

export const isShown = (f, v) => !f.showIf || f.showIf(v);
export const isRequired = (f, v) => (typeof f.required === 'function' ? f.required(v) : !!f.required);

// Returns { fieldName: message } for one section (or all when id is omitted).
export function validate(values, sectionId) {
  const errors = {};
  for (const s of SECTIONS) {
    if (sectionId && s.id !== sectionId) continue;
    for (const f of s.fields) {
      if (!isShown(f, values)) continue;
      const val = values[f.name];
      const empty = f.type === 'file' ? !val : f.type === 'phone' ? !(val && val.number) : !String(val ?? '').trim();
      if (empty) {
        if (isRequired(f, values)) errors[f.name] = f.type === 'file' ? 'Please attach this document.' : 'This field is required.';
        continue;
      }
      if (f.type === 'select') { const opts = typeof f.options === 'function' ? f.options(values) : f.options; if (!opts.includes(val)) { errors[f.name] = 'Please choose an option from the list.'; continue; } }
      if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(val).trim())) errors[f.name] = 'Please enter a valid email address.';
      if (f.validate) { const m = f.validate(String(val).trim()); if (m) errors[f.name] = m; }
    }
  }
  return errors;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const formatDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : iso; };

// Flat list of [label, displayValue] rows for email, sheet and review.
export function summaryRows(values, countryName = c => c) {
  const rows = [];
  for (const s of SECTIONS) {
    for (const f of s.fields) {
      if (!isShown(f, values) || f.type === 'file') continue;
      let v = values[f.name];
      if (f.type === 'country') v = v ? countryName(v) : '';
      if (f.type === 'phone') v = v && v.number ? `+${v.dial} ${v.number}` : '';
      if (f.type === 'date' && v) v = formatDate(v);
      rows.push({ section: s.title, name: f.name, label: f.label, value: v == null || v === '' ? '' : String(v) });
    }
  }
  return rows;
}
