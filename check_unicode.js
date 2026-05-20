const { db, initDb } = require('./src/config/database');

async function main() {
  await initDb();
  const [results] = await db().query('SELECT * FROM results');
  const [students] = await db().query('SELECT * FROM students');
  
  const check = (str, label) => {
    if (typeof str !== 'string') return;
    if (str.includes('\u2028')) console.log(`Found u2028 in ${label}:`, str);
    if (str.includes('\u2029')) console.log(`Found u2029 in ${label}:`, str);
    // check for raw newlines or control chars
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code < 32 && code !== 10 && code !== 13 && code !== 9) {
        console.log(`Found control char ${code} in ${label}:`, str);
      }
    }
  };

  results.forEach(r => {
    check(r.exam_name, `results.exam_name (id=${r.id})`);
    check(r.subject, `results.subject (id=${r.id})`);
  });

  students.forEach(s => {
    check(s.name, `students.name (id=${s.id})`);
  });

  console.log('Unicode check complete.');
  process.exit();
}

main();
