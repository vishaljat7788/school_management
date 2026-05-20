const http = require('http');

function post(url, data) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const postData = new URLSearchParams(data).toString();
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let cookies = res.headers['set-cookie'] || [];
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ headers: res.headers, cookies, body }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function get(url, cookies) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.get({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      headers: {
        'Cookie': cookies.map(c => c.split(';')[0]).join('; ')
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
  });
}

async function main() {
  try {
    const loginRes = await post('http://localhost:3001/login', { username: 'admin', password: '1234' });
    const cookies = loginRes.cookies;
    console.log('Login cookies:', cookies);
    const html = await get('http://localhost:3001/results', cookies);
    console.log('Fetched Results Page size:', html.length);
    
    // Find the inline script tag
    const scriptStart = html.lastIndexOf('<script>');
    const scriptEnd = html.lastIndexOf('</script>');
    if (scriptStart !== -1 && scriptEnd !== -1) {
      console.log('--- Client Script Tag Content ---');
      console.log(html.substring(scriptStart, scriptEnd + 9));
      console.log('---------------------------------');
    } else {
      console.log('Inline script tag not found in fetched HTML!');
    }
  } catch (err) {
    console.error(err);
  }
}

main();
