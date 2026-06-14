import http from 'http';
function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}
for (const url of ['http://localhost:5173/', 'http://192.168.0.110:5173/', 'http://localhost:5173/src/main.ts', 'http://192.168.0.110:5173/src/main.ts']) {
  try {
    const r = await get(url);
    console.log(url.padEnd(50), 'status=' + r.status, 'bytes=' + r.body.length);
  } catch (e) { console.log(url.padEnd(50), 'ERR', e.message); }
}
