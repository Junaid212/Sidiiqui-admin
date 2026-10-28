const http = require('http');
const fs = require('fs');
const path = require('path');

const distDir = 'd:/Bright Media WORK/Siddiui.digital-main/Siddiui.digital-main/dist';
const PORT = 8089;

// Mimic Nginx: try_files $uri $uri/ /index.html;
const server = http.createServer((req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    let filePath = path.join(distDir, reqPath);

    // If directory, look for index.html inside
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }

    // If still not found, fallback to root index.html
    if (!fs.existsSync(filePath)) {
        filePath = path.join(distDir, 'index.html');
    }

    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(content);
});

server.listen(PORT, async () => {
    console.log(`Test static server running at http://localhost:${PORT}\n`);

    const testSlugs = [
        'marketing-is-not-failing-it-is-misplaced',
        'why-marketing-gets-marginalized',
        'spot-misclassification-early' // scheduled article
    ];

    const crawlerAgents = [
        { name: 'LinkedInBot', ua: 'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)' },
        { name: 'WhatsApp', ua: 'WhatsApp/2.21.12.21 A' },
        { name: 'Twitterbot', ua: 'Twitterbot/1.0' },
        { name: 'Facebook', ua: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' }
    ];

    for (const slug of testSlugs) {
        const url = `http://localhost:${PORT}/blog/${slug}`;
        console.log(`================================================================`);
        console.log(`TESTING URL: ${url}`);
        console.log(`================================================================`);

        for (const bot of crawlerAgents) {
            const res = await fetch(url, { headers: { 'User-Agent': bot.ua } });
            const html = await res.text();

            const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i);
            const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']/i);
            const imgMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i);
            const twImgMatch = html.match(/<meta\s+name=["']twitter:image["']\s+content=["'](.*?)["']/i);

            console.log(`[Bot: ${bot.name.padEnd(12)}] HTTP ${res.status}`);
            console.log(`  og:title:       ${titleMatch ? titleMatch[1] : 'NOT FOUND'}`);
            console.log(`  og:description: ${descMatch ? descMatch[1].substring(0, 70) + '...' : 'NOT FOUND'}`);
            console.log(`  og:image:       ${imgMatch ? imgMatch[1] : 'NOT FOUND'}`);
            console.log(`  twitter:image:  ${twImgMatch ? twImgMatch[1] : 'NOT FOUND'}\n`);
        }
    }

    server.close();
    console.log('Test completed and server closed.');
});
