const fs = require('fs');
const html = fs.readFileSync('render_output.html', 'utf16le');

// Find all script tags
const regex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;
while ((match = regex.exec(html)) !== null) {
  count++;
  console.log(`Script #${count}: src="${match[0].match(/src="([^"]*)"/) ? match[0].match(/src="([^"]*)"/)[1] : 'inline'}"`);
  if (!match[0].includes('src=')) {
    console.log('--- Content Preview ---');
    console.log(match[1].substring(0, 200) + '...');
    console.log('-----------------------');
  }
}
