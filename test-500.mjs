import http from 'http';
function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}
const r1 = await get('http://127.0.0.1:5173/src/main.ts');
console.log('status=' + r1.status);
console.log(r1.body.substring(0, 2000));
