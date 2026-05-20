const fs = require('fs');
const html = fs.readFileSync('render_output.html', 'utf16le');

const idx = html.lastIndexOf('<script>');
if (idx === -1) {
  console.log('No script tag found');
  process.exit();
}

console.log('--- HTML around <script> (100 chars before) ---');
console.log(html.substring(idx - 200, idx));
console.log('--- HTML around <script> (100 chars after) ---');
console.log(html.substring(idx, idx + 200));
