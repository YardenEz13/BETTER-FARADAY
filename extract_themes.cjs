const fs = require('fs');

function extractTheme(filename, mode) {
  const html = fs.readFileSync(filename, 'utf8');
  const match = html.match(/tailwind\.config\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
  if (!match) return '';
  
  // parse the JSON
  const config = eval('(' + match[1] + ')');
  
  let lines = [];
  const colors = config.theme.extend.colors;
  for (const [key, value] of Object.entries(colors)) {
    lines.push(`  --color-${key}: ${value};`);
  }
  
  if (mode === 'dark') {
    lines.unshift('  /* Dark Mode Colors */');
    const spacing = config.theme.extend.spacing;
    for (const [key, value] of Object.entries(spacing)) {
      lines.push(`  --spacing-${key}: ${value};`);
    }
    const radii = config.theme.extend.borderRadius;
    for (const [key, value] of Object.entries(radii)) {
      if (key === 'DEFAULT') lines.push(`  --radius: ${value};`);
      else lines.push(`  --radius-${key}: ${value};`);
    }
    return lines.join('\n');
  } else {
    lines.unshift('  /* Light Mode Colors */');
    return lines.join('\n');
  }
}

try {
  const darkCss = extractTheme('stitch_screens/1_TeacherCommandCenter.html', 'dark');
  const lightCss = extractTheme('stitch_screens/4_TeacherDashboard_LightMode.html', 'light');

  let output = `@import "tailwindcss";

@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap');

@theme {
  --font-rubik: 'Rubik', sans-serif;
  --font-headline-xl: var(--font-rubik);
  --font-headline-lg: var(--font-rubik);
  --font-headline-md: var(--font-rubik);
  --font-body-lg: var(--font-rubik);
  --font-body-sm: var(--font-rubik);
  --font-label-lg: var(--font-rubik);
  --font-label-md: var(--font-rubik);

${darkCss}
}

[data-theme="light"] {
${lightCss.replace(/--color-/g, '--')}
}
`;

  fs.writeFileSync('src/stitch-theme.css', output);
  console.log('Successfully generated src/stitch-theme.css');
} catch(e) {
  console.error(e);
}
