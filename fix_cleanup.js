const fs = require('fs');
const content = fs.readFileSync('src/controllers/resultsController.js', 'utf8');
const lines = content.split('\n');

// Find the line with `    \`));` after line 620 (the new template close)
// Line 621 (index 620) should be `    \`));`
// Then everything from line 622 until the NEXT `    \`));` followed by `  }` `}` is old code

// Find first `));` after line 620
let firstClose = -1;
let secondClose = -1;
for (let i = 619; i < lines.length; i++) {
  if (lines[i].trim() === '`));') {
    if (firstClose === -1) {
      firstClose = i;
    } else {
      secondClose = i;
      break;
    }
  }
}

console.log('First `)); at line', firstClose + 1, ':', lines[firstClose]);
console.log('Second `)); at line', secondClose + 1, ':', lines[secondClose]);

if (firstClose >= 0 && secondClose >= 0) {
  // Remove everything from firstClose+1 to secondClose+2 (the `}` and `}` after second close)
  // But we need to keep the `  }` and `}` after the second close
  // Actually: after firstClose we want `  }\n}\n` then the manageResults function
  
  // Find `async function manageResults` line
  let manageIdx = -1;
  for (let i = secondClose; i < lines.length; i++) {
    if (lines[i].includes('async function manageResults')) {
      manageIdx = i;
      break;
    }
  }
  console.log('manageResults at line', manageIdx + 1);
  
  // Keep lines 0..firstClose, then add }}, then lines manageIdx..end
  const newLines = [
    ...lines.slice(0, firstClose + 1),
    '  }',
    '}',
    '',
    ...lines.slice(manageIdx)
  ];
  
  fs.writeFileSync('src/controllers/resultsController.js', newLines.join('\n'), 'utf8');
  console.log('Fixed! New file has', newLines.length, 'lines');
} else {
  console.log('Could not find close markers');
}
