const fs = require('fs');
const files = ['src/pages/StudentHome.tsx', 'src/pages/PracticeSession.tsx', 'src/pages/TeacherDashboard.tsx'];
files.forEach(f => {
  let code = fs.readFileSync(f, 'utf8');
  // Add quotes around CSS variables in common inline style properties
  code = code.replace(/borderRadius:\s*var\(--([a-zA-Z0-9-]+)\)/g, 'borderRadius: "var(--$1)"');
  code = code.replace(/borderBottom:\s*var\(--([a-zA-Z0-9-]+)\)/g, 'borderBottom: "var(--$1)"');
  code = code.replace(/borderLeft:\s*var\(--([a-zA-Z0-9-]+)\)/g, 'borderLeft: "var(--$1)"');
  code = code.replace(/border:\s*var\(--([a-zA-Z0-9-]+)\)/g, 'border: "var(--$1)"');
  fs.writeFileSync(f, code);
});
console.log('Fixed quotes successfully');
