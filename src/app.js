import { upload } from '@vercel/blob/client';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { COUNTRIES } from './countries.js';
import { SECTIONS, DECLARATION, MAX_FILE_MB, FILE_TYPES, isShown, isRequired, validate, summaryRows, groupItems } from '../lib/schema.js';

const STORE_KEY = 'compuage-supplier-v1';
const POPULAR = ['AE', 'SA', 'OM', 'QA', 'KW', 'BH', 'IN'];
const byCode = Object.fromEntries(COUNTRIES.map(c => [c.code, c]));
const countryName = code => (byCode[code] ? byCode[code].name : code);
const STEPS = [...SECTIONS.map(s => ({ id: s.id, title: s.title })), { id: 'review', title: 'Review and submit' }];
const SHORT = { company: 'Company', ownership: 'Ownership', contact: 'Contacts', tax: 'VAT and tax', einvoicing: 'e-Invoicing', documents: 'Documents', review: 'Review' };

const $ = (sel, root = document) => root.querySelector(sel);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const flagImg = code => h('img', { class: 'flag', src: `https://flagcdn.com/w40/${code.toLowerCase()}.png`, alt: '', width: 22, height: 16, loading: 'lazy',
  style: 'width:22px;height:16px;object-fit:cover;border-radius:3px;box-shadow:0 0 0 1px rgba(0,0,0,.08)',
  onerror: e => e.target.replaceWith(h('span', { class: 'flag' }, String.fromCodePoint(...[...code.toUpperCase()].map(ch => 127397 + ch.charCodeAt(0))))) });
const PREVIEW = typeof window !== 'undefined' && window.__PREVIEW__ === true;

// ---------- state ----------
let state = { values: { phone: { iso: 'AE', dial: '971', number: '' } }, step: 0, reached: 0 };
const files = {};
try {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
  if (saved && saved.values) state = { ...state, ...saved, values: { ...state.values, ...saved.values } };
} catch { /* storage unavailable */ }
// Uploaded files cannot be restored after a reload, so forget them; submit() sends people back to any missing ones.
for (const s of SECTIONS) for (const f of s.fields) {
  if (f.type === 'file') delete state.values[f.name];
  if (f.type === 'group' && Array.isArray(state.values[f.name])) state.values[f.name].forEach(it => f.fields.forEach(sf => { if (sf.type === 'file') it[sf.name] = null; }));
}
const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* ignore */ } };

let errors = {};
let visibleBefore = new Set();

// ---------- country picker ----------
function countryPicker({ value, onChange, dial = false, label = 'Select a country' }) {
  const wrap = h('div', { class: 'combo' });
  const btn = h('button', { type: 'button', class: 'combo-btn', 'aria-haspopup': 'listbox', 'aria-expanded': 'false' });
  const search = h('input', { type: 'text', placeholder: 'Search countries', 'aria-label': 'Search countries', autocomplete: 'off', spellcheck: 'false' });
  const list = h('ul', { class: 'combo-list', role: 'listbox' });
  const pop = h('div', { class: 'combo-pop' },
    h('div', { class: 'combo-search', html: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' }, search),
    list);
  wrap.append(btn, pop);
  let current = value, active = -1, items = [];

  const paint = () => {
    btn.replaceChildren();
    const c = byCode[current];
    if (c) { btn.append(flagImg(c.code), h('span', {}, dial ? `+${c.dial}` : c.name)); }
    else btn.append(h('span', { class: 'ph' }, label));
  };
  const renderList = () => {
    const q = search.value.trim().toLowerCase().replace(/^\+/, '');
    list.replaceChildren(); items = [];
    const match = c => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q || (dial && c.dial.startsWith(q));
    const add = c => {
      const li = h('li', { role: 'option', 'aria-selected': String(c.code === current), 'data-code': c.code,
        onmousedown: e => e.preventDefault(), onclick: () => choose(c.code) },
        flagImg(c.code), h('span', {}, c.name), h('span', { class: 'dial' }, `+${c.dial}`));
      list.append(li); items.push(li);
    };
    if (!q) { POPULAR.forEach(code => byCode[code] && add(byCode[code])); list.append(h('li', { class: 'sep', 'aria-hidden': 'true' })); }
    const rest = COUNTRIES.filter(c => match(c) && (q || !POPULAR.includes(c.code)));
    rest.sort((a, b) => q ? (b.name.toLowerCase().startsWith(q) - a.name.toLowerCase().startsWith(q)) : 0).forEach(add);
    if (!items.length) list.append(h('li', { class: 'empty' }, 'No matching country'));
    setActive(q ? 0 : Math.max(0, items.findIndex(li => li.dataset.code === current)));
  };
  const setActive = i => {
    items.forEach(li => li.classList.remove('active'));
    active = Math.max(0, Math.min(i, items.length - 1));
    if (items[active]) { items[active].classList.add('active'); items[active].scrollIntoView({ block: 'nearest' }); }
  };
  const open = () => {
    document.querySelectorAll('.combo.open').forEach(o => o !== wrap && o.dispatchEvent(new Event('close')));
    wrap.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
    search.value = ''; renderList();
    if (window.matchMedia('(pointer: fine)').matches) search.focus(); else setTimeout(() => search.focus(), 50);
  };
  const close = () => { wrap.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); };
  const choose = code => { current = code; paint(); close(); btn.focus(); onChange(code); };

  wrap.addEventListener('close', close);
  btn.addEventListener('click', () => (wrap.classList.contains('open') ? close() : open()));
  btn.addEventListener('keydown', e => { if (['ArrowDown', 'Enter', ' '].includes(e.key) && !wrap.classList.contains('open')) { e.preventDefault(); open(); } });
  search.addEventListener('input', renderList);
  search.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[active]) choose(items[active].dataset.code); }
    else if (e.key === 'Escape') { close(); btn.focus(); }
    else if (e.key === 'Tab') close();
  });
  document.addEventListener('mousedown', e => { if (!wrap.contains(e.target)) close(); });
  paint();
  return wrap;
}

// ---------- field rendering ----------
function clearError(key) {
  if (!errors[key]) return;
  delete errors[key];
  const el = document.querySelector(`[data-field="${key}"]`);
  el && el.classList.remove('invalid');
}
function setValue(name, v, rerender = false) {
  state.values[name] = v;
  clearError(name);
  save();
  if (rerender) renderPanel(false);
}
const newPhone = () => ({ iso: 'AE', dial: '971', number: '' });
const newItem = g => Object.fromEntries(g.fields.map(sf => [sf.name, sf.type === 'phone' ? newPhone() : '']));

// A binding tells a field where its value lives: top level, or inside one person of a group.
const topBinding = f => ({ key: f.name, get: () => state.values[f.name], set: (v, r) => setValue(f.name, v, r) });
const itemBinding = (g, i, sf) => {
  const key = `${g.name}.${i}.${sf.name}`;
  return { key, get: () => state.values[g.name][i][sf.name], set: (v, r) => { state.values[g.name][i][sf.name] = v; clearError(key); save(); if (r) renderPanel(false); } };
};

function fieldEl(f, b = topBinding(f)) {
  const v = state.values;
  const val = b.get();
  const key = b.key;
  const req = isRequired(f, v);
  const wrap = h('div', { class: `field${f.half ? ' half' : ''}`, 'data-field': key });
  const id = `f_${key.replace(/\./g, '_')}`;
  const labelEl = h('label', { class: 'label', for: id }, f.label, req ? h('span', { class: 'req', 'aria-hidden': 'true' }, '*') : (f.type !== 'file' && !f.hint ? h('span', { class: 'opt' }, 'Optional') : null));
  if (f.hint && !req && f.type !== 'file') labelEl.append(h('span', { class: 'opt' }, f.hint));
  wrap.append(labelEl);
  const common = { id, name: key, 'aria-describedby': `${id}_err`, 'aria-required': req ? 'true' : null };

  switch (f.type) {
    case 'text': case 'email': case 'percent': {
      const input = h('input', { ...common, class: 'input', type: f.type === 'email' ? 'email' : 'text', value: val || '', placeholder: f.placeholder || (f.type === 'percent' ? 'e.g. 50' : null),
        autocomplete: f.autocomplete || 'off', inputmode: f.type === 'email' ? 'email' : f.type === 'percent' ? 'decimal' : f.inputmode, maxlength: f.maxlength });
      input.addEventListener('input', () => {
        if (f.inputmode === 'numeric') input.value = input.value.replace(/\D/g, '');
        if (f.type === 'percent') input.value = input.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
        b.set(input.value);
        if (f.type === 'percent') updateTotals();
      });
      if (f.type === 'percent') wrap.append(h('div', { class: 'suffix' }, input, h('span', {}, '%')));
      else wrap.append(input);
      break;
    }
    case 'textarea': {
      const ta = h('textarea', { ...common, class: 'textarea', placeholder: f.placeholder, rows: 3 });
      ta.value = val || '';
      ta.addEventListener('input', () => b.set(ta.value));
      wrap.append(ta); break;
    }
    case 'date': {
      const input = h('input', { ...common, class: 'input', type: 'date', value: val || '' });
      input.addEventListener('change', () => b.set(input.value));
      input.addEventListener('click', () => { try { input.showPicker && input.showPicker(); } catch { /* not supported */ } });
      wrap.append(input); break;
    }
    case 'select': {
      const opts = typeof f.options === 'function' ? f.options(v) : f.options;
      const sel = h('select', { ...common, class: `select${val ? '' : ' empty'}` }, h('option', { value: '', disabled: true, selected: !val }, f.placeholder || 'Select an option'),
        ...opts.map(o => h('option', { value: o, selected: val === o }, o)));
      sel.addEventListener('change', () => {
        if (f.onChange) Object.assign(state.values, f.onChange(sel.value, state.values));
        b.set(sel.value, true);
      });
      wrap.append(sel); break;
    }
    case 'country': {
      const top = key === f.name;
      wrap.append(countryPicker({ value: val, label: top ? 'Select a country' : 'Select nationality', onChange: code => {
        if (top) {
          const p = state.values.phone;
          if (p && !p.number && byCode[code]) state.values.phone = { ...p, iso: code, dial: byCode[code].dial };
        }
        b.set(code, top);
      } }));
      labelEl.removeAttribute('for'); break;
    }
    case 'phone': {
      const p = val || newPhone();
      const input = h('input', { ...common, type: 'tel', inputmode: 'tel', autocomplete: key === 'phone' ? 'tel-national' : 'off', placeholder: 'Phone number', value: p.number || '' });
      input.addEventListener('input', () => { input.value = input.value.replace(/[^\d\s-]/g, ''); b.set({ ...(b.get() || newPhone()), number: input.value.trim() }); });
      const picker = countryPicker({ value: p.iso, dial: true, label: 'Code', onChange: code => b.set({ ...(b.get() || newPhone()), iso: code, dial: byCode[code].dial }) });
      wrap.append(h('div', { class: 'phone' }, picker, input)); break;
    }
    case 'choice': {
      const group = h('div', { class: 'choices', role: 'radiogroup', 'aria-label': f.label, id });
      f.options.forEach(o => {
        const input = h('input', { type: 'radio', name: key, value: o, checked: val === o });
        input.addEventListener('change', () => b.set(o, true));
        group.append(h('label', { class: 'pill' }, input, h('span', {}, o)));
      });
      labelEl.removeAttribute('for');
      wrap.append(group); break;
    }
    case 'cards': {
      const group = h('div', { class: 'cards', role: 'radiogroup', 'aria-label': f.label, id });
      f.options.forEach(o => {
        const input = h('input', { type: 'radio', name: key, value: o.value, checked: val === o.value });
        input.addEventListener('change', () => b.set(o.value, true));
        group.append(h('label', { class: 'opt-card' }, input, h('div', { class: 'box' }, h('b', {}, o.title), h('span', {}, o.text), o.meta ? h('small', {}, o.meta) : null)));
      });
      labelEl.removeAttribute('for');
      wrap.append(group); break;
    }
    case 'file': {
      const file = files[key];
      const drop = h('div', { class: `drop${file ? ' has' : ''}` });
      const input = h('input', { ...common, type: 'file', accept: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png' });
      const icon = file
        ? '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>';
      drop.append(h('div', { class: 'ico', html: icon }));
      if (file) {
        drop.append(h('div', { class: 'txt' }, h('b', { class: 'fname' }, file.name), h('span', {}, file.size < 1048576 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1048576).toFixed(1)} MB`)),
          h('button', { type: 'button', class: 'remove', onclick: () => { delete files[key]; b.set(null, true); } }, 'Remove'));
      } else {
        drop.append(h('div', { class: 'txt' }, h('b', {}, 'Choose a file or drag it here'), h('span', {}, f.hint || `PDF, JPG or PNG, up to ${MAX_FILE_MB} MB`)), input);
      }
      const take = fl => {
        if (!fl) return;
        if (!FILE_TYPES.includes(fl.type)) return showError(key, 'Please upload a PDF, JPG or PNG file.');
        if (fl.size > MAX_FILE_MB * 1048576) return showError(key, `This file is larger than ${MAX_FILE_MB} MB.`);
        files[key] = fl; b.set({ name: fl.name, size: fl.size }, true);
      };
      input.addEventListener('change', () => take(input.files[0]));
      ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('drag'); }));
      ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('drag'); }));
      drop.addEventListener('drop', e => take(e.dataTransfer.files[0]));
      labelEl.removeAttribute('for');
      wrap.append(drop); break;
    }
  }
  if (f.hint && req && f.type !== 'file') wrap.append(h('p', { class: 'hint' }, f.hint));
  wrap.append(h('p', { class: 'error', id: `${id}_err`, role: 'alert' }, errors[key] || ''));
  if (errors[key]) wrap.classList.add('invalid');
  return wrap;
}

// ---------- repeatable groups (owners, signatories, contacts, representatives) ----------
function ensureItems(g) {
  if (!Array.isArray(state.values[g.name])) state.values[g.name] = [];
  while (state.values[g.name].length < (g.min || 1)) state.values[g.name].push(newItem(g));
  return state.values[g.name];
}
function removeItem(g, i) {
  state.values[g.name].splice(i, 1);
  // Shift uploaded files of later people down by one.
  const prefix = `${g.name}.`;
  const moved = {};
  for (const k of Object.keys(files)) {
    if (!k.startsWith(prefix)) continue;
    const [, idx, sub] = k.split('.');
    const n = +idx;
    if (n === i) { delete files[k]; continue; }
    if (n > i) { moved[`${g.name}.${n - 1}.${sub}`] = files[k]; delete files[k]; }
  }
  Object.assign(files, moved);
  for (const k of Object.keys(errors)) if (k.startsWith(prefix) || k === g.name) delete errors[k];
  save(); renderPanel(false);
}
function shareTotal() {
  return (state.values.owners || []).reduce((a, it) => a + (parseFloat(it.share) || 0), 0);
}
function updateTotals() {
  const el = document.querySelector('[data-total="owners"]');
  if (!el) return;
  const t = +shareTotal().toFixed(2);
  el.textContent = `Total: ${t}%`;
  el.className = `total ${Math.abs(t - 100) < 0.01 ? 'ok' : t > 100 ? 'over' : ''}`;
}
function groupEl(g) {
  const items = ensureItems(g);
  const box = h('div', { class: 'group field', 'data-field': g.name });
  box.append(h('div', { class: 'group-head' }, h('h3', {}, g.label, h('span', { class: 'req', 'aria-hidden': 'true' }, '*')), g.hint ? h('p', {}, g.hint) : null));
  items.forEach((it, i) => {
    const card = h('div', { class: 'person' },
      h('div', { class: 'person-head' },
        h('span', { class: 'badge' }, String(i + 1)),
        h('b', {}, `${g.itemLabel} ${i + 1}`),
        items.length > (g.min || 1) ? h('button', { type: 'button', class: 'link-remove', onclick: () => removeItem(g, i) }, 'Remove') : null),
      h('div', { class: 'grid' }, ...g.fields.map(sf => fieldEl(sf, itemBinding(g, i, sf)))));
    box.append(card);
  });
  const foot = h('div', { class: 'group-foot' },
    h('button', { type: 'button', class: 'btn-add', onclick: () => {
      items.push(newItem(g)); delete errors[g.name]; save(); renderPanel(false);
      const cards = document.querySelectorAll(`[data-field="${g.name}"] .person`);
      const last = cards[cards.length - 1];
      if (last) { last.classList.add('reveal'); last.scrollIntoView({ behavior: 'smooth', block: 'center' }); const inp = last.querySelector('input'); inp && inp.focus({ preventScroll: true }); }
    } }, h('span', { 'aria-hidden': 'true' }, '+'), g.addLabel),
    g.name === 'owners' ? h('span', { 'data-total': 'owners', class: 'total' }) : null);
  box.append(foot);
  box.append(h('p', { class: 'error', role: 'alert' }, errors[g.name] || ''));
  if (errors[g.name]) box.classList.add('invalid');
  return box;
}

function showError(name, msg) {
  errors[name] = msg;
  const el = document.querySelector(`[data-field="${name}"]`);
  if (el) { el.classList.add('invalid'); $('.error', el).textContent = msg; }
}

// Extra checks the shared schema cannot do (phone numbers, dates relative to today).
function extraChecks(sectionId) {
  const e = {};
  const v = state.values;
  const checkPhone = (key, p) => {
    if (!p || !p.number) return;
    const n = parsePhoneNumberFromString(p.number, p.iso);
    if (!n || !n.isValid()) e[key] = 'Please check the phone number and country code.';
  };
  for (const s of SECTIONS) {
    if (sectionId && s.id !== sectionId) continue;
    for (const f of s.fields) {
      if (!isShown(f, v)) continue;
      if (f.type === 'phone') checkPhone(f.name, v[f.name]);
      if (f.type === 'group') (v[f.name] || []).forEach((it, i) => f.fields.forEach(sf => { if (sf.type === 'phone') checkPhone(`${f.name}.${i}.${sf.name}`, it[sf.name]); }));
    }
  }
  if (!sectionId || sectionId === 'company') {
    const today = new Date().toISOString().slice(0, 10);
    if (v.tradeLicenceExpiry && v.tradeLicenceExpiry < today) e.tradeLicenceExpiry = 'This date has passed. Please use the expiry date of your current licence.';
    if (v.establishmentDate && v.establishmentDate > today) e.establishmentDate = 'The establishment date cannot be in the future.';
  }
  return e;
}

// ---------- panels ----------
function renderSteps() {
  const nav = $('#steps');
  nav.replaceChildren(...STEPS.map((s, i) => {
    const cls = i === state.step ? 'current' : i <= state.reached ? 'done' : '';
    return h('button', { type: 'button', class: `step ${cls}`, 'aria-current': i === state.step ? 'step' : null, disabled: i > state.reached || i === state.step ? true : null,
      onclick: () => go(i) }, h('span', { class: 'dot' }, i < state.reached && i !== state.step ? '✓' : String(i + 1)), h('span', { class: 'lbl' }, SHORT[s.id]));
  }));
  $('#progressBar').style.width = `${((state.step + 1) / STEPS.length) * 100}%`;
  $('#stepcount').textContent = `Step ${state.step + 1} of ${STEPS.length}`;
  $('#back').classList.toggle('hidden', state.step === 0);
  const next = $('#next');
  const last = state.step === STEPS.length - 1;
  next.classList.toggle('submit', last);
  next.textContent = last ? 'Submit form' : 'Continue';
}

function renderPanel(fresh = true) {
  const panel = $('#panel');
  const step = STEPS[state.step];
  if (step.id === 'review') return renderReview(fresh);
  const section = SECTIONS.find(s => s.id === step.id);
  const shown = section.fields.filter(f => isShown(f, state.values));
  const active = document.activeElement && document.activeElement.name;
  const box = h('div', { class: fresh ? 'panel' : '' },
    h('div', { class: 'panel-head' }, h('h2', {}, section.title), h('p', {}, section.subtitle)),
    h('div', { class: 'grid' }, ...shown.map(f => {
      const el = f.type === 'group' ? groupEl(f) : fieldEl(f);
      if (!fresh && !visibleBefore.has(f.name)) el.classList.add('reveal');
      return el;
    })));
  visibleBefore = new Set(shown.map(f => f.name));
  panel.replaceChildren(box);
  updateTotals();
  if (!fresh && active) { const el = panel.querySelector(`input[name="${active}"]:checked, [name="${active}"]`); el && el.focus({ preventScroll: true }); }
  renderSteps();
}

function renderReview(fresh) {
  const v = state.values;
  const rows = summaryRows(v, countryName);
  const secs = SECTIONS.map((s, i) => {
    const items = s.id === 'documents'
      ? [...s.fields.filter(f => isShown(f, v)).map(f => ({ label: f.label, value: files[f.name] ? files[f.name].name : '' })),
         ...groupFileList(v).map(d => ({ label: d.label, value: files[d.key] ? files[d.key].name : '' }))]
      : rows.filter(r => r.section === s.title);
    return h('section', { class: 'review-sec' },
      h('header', {}, h('h3', {}, s.title), h('button', { type: 'button', class: 'edit', onclick: () => go(i) }, 'Edit')),
      h('dl', {}, ...items.map(r => h('div', { class: 'row' }, h('dt', {}, r.label), h('dd', { class: r.value ? '' : 'none' }, r.value || 'Not provided')))));
  });
  const cb = h('input', { type: 'checkbox', id: 'declare', checked: !!v.declaration });
  const declare = h('label', { class: `declare${errors.declaration ? ' invalid' : ''}`, for: 'declare' }, cb, h('div', {}, h('b', {}, 'Supplier declaration'), h('p', {}, DECLARATION)));
  cb.addEventListener('change', () => { setValue('declaration', cb.checked); declare.classList.remove('invalid'); });
  $('#panel').replaceChildren(h('div', { class: fresh ? 'panel' : '' },
    h('div', { class: 'panel-head' }, h('h2', {}, 'Review and submit'), h('p', {}, 'Please check your answers before submitting.')),
    ...secs, declare, h('div', { id: 'status' })));
  renderSteps();
}

function groupFileList(v) {
  const out = [];
  for (const s of SECTIONS) for (const g of s.fields) {
    if (g.type !== 'group') continue;
    groupItems(v, g).forEach((it, i) => g.fields.forEach(sf => {
      if (sf.type === 'file') out.push({ key: `${g.name}.${i}.${sf.name}`, label: `${sf.label} (${it.fullName || it.name || `${g.itemLabel} ${i + 1}`})` });
    }));
  }
  return out;
}

function go(i) {
  state.step = i; state.reached = Math.max(state.reached, i); errors = {}; visibleBefore = new Set(); save();
  renderPanel(true);
  window.scrollTo({ top: $('.shell').offsetTop - 12, behavior: 'smooth' });
}

function checkStep() {
  const id = STEPS[state.step].id;
  errors = { ...validate(state.values, id), ...extraChecks(id) };
  if (Object.keys(errors).length) {
    renderPanel(false);
    const first = document.querySelector('.field.invalid');
    if (first) { first.scrollIntoView({ behavior: 'smooth', block: 'center' }); const inp = first.querySelector('input:not([type=file]), select, textarea, button'); inp && inp.focus({ preventScroll: true }); }
    return false;
  }
  return true;
}

// ---------- submit ----------
async function submit() {
  const v = state.values;
  const all = { ...validate(v), ...extraChecks('contact'), ...extraChecks('company') };
  for (const s of SECTIONS) for (const f of s.fields) if (f.type === 'file' && isShown(f, v) && isRequired(f, v) && !files[f.name]) all[f.name] = 'Please attach this document.';
  groupFileList(v).forEach(d => { if (!files[d.key]) all[d.key] = 'Please attach this document.'; });
  if (Object.keys(all).length) {
    const idx = SECTIONS.findIndex(s => s.fields.some(f => Object.keys(all).some(k => k === f.name || k.startsWith(`${f.name}.`))));
    go(idx); errors = all; renderPanel(false); return;
  }
  if (!v.declaration) { errors.declaration = true; $('.declare').classList.add('invalid'); $('.declare').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }

  const btn = $('#next'), status = $('#status');
  btn.disabled = true; $('#back').disabled = true;
  btn.replaceChildren(h('span', { class: 'spin' }), 'Submitting');
  try {
    const groupKeys = new Set(groupFileList(v).map(d => d.key));
    const toSend = Object.entries(files).filter(([name]) => groupKeys.has(name) || SECTIONS.some(s => s.fields.some(f => f.name === name && isShown(f, v))));
    const total = toSend.reduce((a, [, f]) => a + f.size, 0) || 1;
    const loaded = {};
    const bar = h('span');
    if (toSend.length) status.replaceChildren(h('div', { class: 'uploading' }, 'Uploading documents securely', h('div', { class: 'bar' }, bar)));
    const safe = (v.legalName || 'supplier').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'supplier';
    const uploaded = await Promise.all(toSend.map(async ([field, file]) => {
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '');
      let blob;
      if (PREVIEW) {
        for (let i = 1; i <= 10; i++) { await new Promise(r => setTimeout(r, 80)); loaded[field] = (file.size * i) / 10; bar.style.width = `${Math.min(100, (Object.values(loaded).reduce((a, b) => a + b, 0) / total) * 100)}%`; }
        return { field, url: '', name: file.name, contentType: file.type, size: file.size };
      }
      try {
        blob = await upload(`suppliers/${safe}/${field}.${ext}`, file, {
          access: 'public', handleUploadUrl: '/api/upload', contentType: file.type,
          onUploadProgress: p => { loaded[field] = p.loaded; bar.style.width = `${Math.min(100, (Object.values(loaded).reduce((a, b) => a + b, 0) / total) * 100)}%`; },
        });
      } catch (e) {
        console.error(e);
        throw new Error('We could not upload your documents.');
      }
      return { field, url: blob.url, name: file.name, contentType: file.type, size: file.size };
    }));
    status.replaceChildren(h('div', { class: 'uploading' }, 'Sending your details'));
    if (PREVIEW) {
      await new Promise(r => setTimeout(r, 700));
      try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
      return showDone('CA-SUP-PREVIEW', v.email);
    }
    const res = await fetch('/api/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: v, files: uploaded, hp: $('#hp').value }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || 'Something went wrong while submitting.');
    try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
    showDone(data.ref, v.email);
  } catch (err) {
    console.error(err);
    status.replaceChildren(h('div', { class: 'alert' }, `${err.message || 'Submission failed.'} Please try again, or email accounts@compuagedubai.com if it keeps happening.`));
    btn.disabled = false; $('#back').disabled = false; btn.textContent = 'Submit form';
  }
}

function showDone(ref, email) {
  $('#steps').remove(); $('.progress span').style.width = '100%';
  $('#form').replaceChildren(h('div', { class: 'done panel' },
    h('div', { class: 'tick', html: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' }),
    h('h2', {}, 'Thank you. Your details have been submitted.'),
    h('p', { html: `Our accounts team will review your information and update your supplier record. A copy has been sent to <b>${esc(email)}</b>.` }),
    h('div', { class: 'ref' }, h('small', {}, 'Reference'), ref)));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- wire up ----------
$('#form').addEventListener('submit', e => {
  e.preventDefault();
  if (STEPS[state.step].id === 'review') return submit();
  if (checkStep()) go(state.step + 1);
});
$('#form').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'submit' && !e.target.closest('.combo')) { e.preventDefault(); $('#next').click(); }
});
$('#back').addEventListener('click', () => state.step > 0 && go(state.step - 1));
$('#yr').textContent = new Date().getFullYear();
renderPanel(true);
