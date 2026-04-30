const http = require('http');

http.get('http://localhost:5001/api/public/blogs', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Blogs:', data));
}).on('error', err => console.log('Error:', err.message));
