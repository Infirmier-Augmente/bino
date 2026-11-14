#!/usr/bin/env node
// Bloque un commit qui contiendrait une clé d'API (DeepSeek, OpenAI, Anthropic, Jev...).
// Appelé par lefthook avec la liste des fichiers indexés.
import { existsSync, readFileSync, statSync } from 'node:fs';

const PATTERNS = [
  { name: 'clé type OpenAI/DeepSeek (sk-...)', re: /\bsk-[A-Za-z0-9_-]{20,}/ },
  { name: 'clé Anthropic', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'clé TypeSafe/Jev (apikey_...)', re: /\bapikey_[A-Za-z0-9_]{20,}/ },
  { name: 'clé Google', re: /\bAIza[0-9A-Za-z_-]{30,}/ },
  { name: 'clé Groq', re: /\bgsk_[A-Za-z0-9]{20,}/ },
];

const files = process.argv.slice(2).filter((f) => existsSync(f) && statSync(f).isFile());
let found = 0;
for (const file of files) {
  if (file.endsWith('.env.example')) continue;
  const content = readFileSync(file, 'utf8');
  for (const { name, re } of PATTERNS) {
    if (re.test(content)) {
      console.error(`✖ ${file} contient une ${name}. Mets-la dans .env (ignoré par git).`);
      found++;
    }
  }
}
process.exit(found > 0 ? 1 : 0);
