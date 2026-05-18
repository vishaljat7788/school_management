function e(value = '') {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[ch]));
}

function initials(name) {
  return String(name).trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || 'U';
}

function feeClass(status) {
  return status === 'Paid' ? 'green' : status === 'Pending' ? 'gold' : 'red';
}

function money(value) {
  return `Rs.${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function today() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function fmtDate(value) {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value || '').slice(0, 10);
}

function className(value = '') {
  const raw = String(value);
  const [grade, ...sectionParts] = raw.split('-');
  const romanToNumber = {
    XII: 12,
    XI: 11,
    X: 10,
    IX: 9,
    VIII: 8,
    VII: 7,
    VI: 6,
    V: 5,
    IV: 4,
    III: 3,
    II: 2,
    I: 1,
  };
  const num = romanToNumber[grade.toUpperCase()] || Number(grade);
  if (!Number.isFinite(num) || num <= 0) return raw;
  const suffix = num % 100 >= 11 && num % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[num % 10] || 'th');
  return `${num}${suffix}${sectionParts.length ? `-${sectionParts.join('-')}` : ''}`;
}

module.exports = { e, initials, feeClass, money, today, fmtDate, className };
