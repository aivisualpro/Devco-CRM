# Agent Script Policy

This is a Next.js 16 / TypeScript project. Follow these rules when writing 
any one-off script (codemod, migration, analysis, extraction, batch edit):

1. NEVER create .py files. Python is not part of this stack. We will not 
   install Python on Vercel, in dev, or in CI.
2. NEVER create stray .js files at the repo root. 
3. For multi-file refactors, prefer the built-in Edit/Grep tools over 
   writing a script. Most "rewrite N files" tasks can be done with 5-20 
   direct Edit calls and zero scripts.
4. If a script is genuinely needed (e.g., Mongo data migration, complex AST 
   transform), write it as TypeScript in /scripts/<descriptive-name>.ts and 
   run with `npx tsx scripts/<name>.ts`. Import the project's existing 
   types from /lib and /lib/models. Add a JSDoc header explaining what the 
   script does, when to run it, and whether it's idempotent.
5. If the script is a one-time migration, after running it move it to 
   /scripts/_archive/ with a date prefix (e.g., 2026-04-26_migrate_X.ts) 
   so the codebase stays clean.
6. Never leave scratch/ folders, _temp/ folders, or *.bak / *.backup files 
   in the working tree.
