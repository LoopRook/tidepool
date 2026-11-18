// Bundles src/main.js and everything it imports into one self-contained HTML file.
// dev.html (modules, for `node serve.js`) is the template; the bundle is written to
// index.html, which is the live page, and dist/tidepool.html. One file can't be served
// half-updated, so a visitor never gets a new page with yesterday's scripts.
// Relies on the module style in DESIGN.md: single-line named imports, and only
// `export function|const|let|class` declarations.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(import.meta.dirname);
const IMPORT_RE = /^\s*import\s*\{([^}]*)\}\s*from\s*['"](\.[^'"]+)['"];?\s*$/gm;
const EXPORT_RE = /^export\s+(?:async\s+)?(function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm;

const order = [];
const seen = new Map();

function visit(file) {
  if (seen.has(file)) return seen.get(file);
  const id = `__m${seen.size}`;
  seen.set(file, id);
  let code = readFileSync(file, 'utf8');
  if (/^\s*export\s+(default|\{|\*)/m.test(code) || /^\s*import\s+\*/m.test(code)) {
    throw new Error(`${file}: unsupported import/export form (see DESIGN.md)`);
  }
  const imports = [];
  code = code.replace(IMPORT_RE, (_, names, spec) => {
    const dep = visit(resolve(dirname(file), spec));
    imports.push(`const {${names.replace(/\bas\b/g, ':')}} = ${dep};`);
    return '';
  });
  const exported = [];
  code = code.replace(EXPORT_RE, (_, kind, name) => { exported.push(name); return `${kind} ${name}`; });
  order.push(`const ${id} = (() => {\n${imports.join('\n')}\n${code}\nreturn { ${exported.join(', ')} };\n})();`);
  return id;
}

export function bundle() {
  order.length = 0;
  seen.clear();
  visit(join(root, 'src', 'main.js'));
  const html = readFileSync(join(root, 'dev.html'), 'utf8');
  const css = readFileSync(join(root, 'style.css'), 'utf8');
  const js = `(() => {\n'use strict';\n${order.join('\n\n')}\n})();`;
  const out = html
    .replace(/<link[^>]*href="style\.css"[^>]*>/, () => `<style>\n${css}\n</style>`)
    .replace(/<script[^>]*src="src\/main\.js"[^>]*><\/script>/, () => `<script>\n${js}\n</script>`);
  if (out.includes('src/main.js') || out.includes('href="style.css"')) {
    throw new Error('dev.html must load style.css via <link href="style.css"> and the app via <script type="module" src="src/main.js">');
  }
  return { html: out, modules: order.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { html, modules } = bundle();
  mkdirSync(join(root, 'dist'), { recursive: true });
  writeFileSync(join(root, 'index.html'), html);
  writeFileSync(join(root, 'dist', 'tidepool.html'), html);
  console.log(`index.html, dist/tidepool.html  ${(html.length / 1024).toFixed(1)} KB  (${modules} modules)`);
}
