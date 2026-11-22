import fs from 'fs';

const content = fs.readFileSync('E:/xampp/htdocs/Demo/PMC_Alumni/resources/views/layouts/sidebar.blade.php', 'utf8');
const lines = content.split('\n');

const menu = [];
let currentCategory = 'TOP';

lines.forEach((line, index) => {
  const trimmed = line.trim();
  if (trimmed.includes('sidebar-divider') || trimmed.includes('ADMIN MENU')) {
    currentCategory = 'ADMIN MENU';
  }
  
  const spanMatch = trimmed.match(/<span>(.*?)<\/span>/);
  const routeMatch = trimmed.match(/route\('([^']+)'\)/);
  const collapseMatch = trimmed.match(/data-bs-target="#([^"]+)"/);
  
  if (spanMatch) {
    menu.push({
      line: index + 1,
      cat: currentCategory,
      text: spanMatch[1].replace(/\{\{.*?\}\}/g, '').trim(),
      route: routeMatch ? routeMatch[1] : null,
      collapse: collapseMatch ? collapseMatch[1] : null
    });
  }
});

console.log(JSON.stringify(menu, null, 2));
