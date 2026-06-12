import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.css')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replacements
  content = content.replace(/var\(--neon-emerald\)/g, 'var(--color-primary)');
  content = content.replace(/var\(--acid-green\)/g, 'var(--color-primary-light)');
  content = content.replace(/var\(--warning-amber\)/g, 'var(--color-warning)');
  content = content.replace(/var\(--laser-cyan\)/g, 'var(--color-accent)');
  content = content.replace(/var\(--glow-emerald\)/g, 'var(--glow-primary)');
  content = content.replace(/var\(--bg-deep\)/g, 'var(--bg-void)');
  content = content.replace(/bg-\[\#050b08\]/g, 'bg-[var(--bg-void)]');
  content = content.replace(/bg-\[\#0a1a12\]/g, 'bg-[var(--bg-surface)]');
  content = content.replace(/border-\[\#1a3324\]/g, 'border-[var(--border-default)]');
  content = content.replace(/border-\[\#ff4b4b\]/g, 'border-[var(--color-danger)]');
  content = content.replace(/text-\[\#ff4b4b\]/g, 'text-[var(--color-danger)]');
  content = content.replace(/bg-\[rgba\(0,255,136,0\.05\)\]/g, 'bg-[var(--color-primary-muted)]');
  content = content.replace(/bg-\[rgba\(0,255,136,0\.02\)\]/g, 'bg-[var(--color-primary-muted)]');
  content = content.replace(/bg-\[rgba\(255,75,75,0\.05\)\]/g, 'bg-[var(--color-danger-muted)]');
  content = content.replace(/bg-\[rgba\(245,212,79,0\.05\)\]/g, 'bg-[var(--color-warning-muted)]');
  content = content.replace(/bg-\[rgba\(0,240,255,0\.05\)\]/g, 'bg-[var(--color-accent-muted)]');
  content = content.replace(/bg-\[rgba\(0,0,0,0\.4\)\]/g, 'bg-[var(--bg-surface)]');
  content = content.replace(/bg-\[rgba\(0,0,0,0\.5\)\]/g, 'bg-[var(--bg-surface)]');
  content = content.replace(/bg-\[rgba\(0,0,0,0\.6\)\]/g, 'bg-[var(--bg-surface)]');
  content = content.replace(/bg-\[rgba\(0,0,0,0\.8\)\]/g, 'bg-[var(--bg-surface)]');
  content = content.replace(/text-\[\#c0f8d1\]/g, 'text-[var(--text-primary)]');
  content = content.replace(/text-\[\#f5d44f\]/g, 'text-[var(--color-warning)]');
  content = content.replace(/border-\[\#f5d44f\]/g, 'border-[var(--color-warning)]');
  content = content.replace(/text-white/g, 'text-[var(--text-primary)]');
  content = content.replace(/className="shard/g, 'className="glass');
  content = content.replace(/t-mono-label/g, 'label-mono');
  content = content.replace(/cyber-btn-ghost/g, 'btn-ghost');
  content = content.replace(/cyber-btn/g, 'btn btn-primary');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
