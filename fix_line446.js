const fs = require('fs');
const content = fs.readFileSync('src/controllers/resultsController.js', 'utf8');
const lines = content.split('\n');

// Line 446 has \\'' (2 backslashes before each quote pair)
// Line 449 has \'' (1 backslash before each quote pair) - this is correct
// Fix: replace all \\\\ with \\ inside line 446 only (the loadExamForEdit line)

const oldLine = lines[445];
// Replace \\' with \' throughout the loadExamForEdit onclick
// In the actual file bytes: \\ (2 backslashes) followed by '' should become \ (1 backslash) followed by ''
const newLine = oldLine.replace(/loadExamForEdit\(.*?\)/, (match) => {
  // Replace every occurrence of \\\\ with \\ inside the match
  return match.replace(/\\\\/g, '\\');
});

console.log('Old line:', JSON.stringify(oldLine));
console.log('New line:', JSON.stringify(newLine));
console.log('Changed:', oldLine !== newLine);

if (oldLine !== newLine) {
  lines[445] = newLine;
  fs.writeFileSync('src/controllers/resultsController.js', lines.join('\n'), 'utf8');
  console.log('File saved successfully!');
} else {
  console.log('No change detected, trying different approach...');
}
