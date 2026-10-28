const fs = require('fs');

const pkgPath = 'd:/Bright Media WORK/Siddiui.digital-main/Siddiui.digital-main/package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

pkg.scripts = {
    ...pkg.scripts,
    "build": "vite build && node scripts/prerender-blogs.mjs",
    "prerender": "node scripts/prerender-blogs.mjs"
};

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log('Updated package.json scripts successfully.');
