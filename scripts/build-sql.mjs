import fs from 'node:fs'
const files = fs.readdirSync('supabase/migrations').filter(file => file.endsWith('.sql')).sort()
const sql = '-- BarkoLink setup: run once in Supabase SQL Editor on a new project.\n-- All migrations are applied together or rolled back on failure.\nbegin;\n\n' +
  files.map(file => `-- ${file}\n${fs.readFileSync(`supabase/migrations/${file}`, 'utf8')}`).join('\n\n') + '\ncommit;\n'
if (process.argv.includes('--check')) {
  const normalize = value => value.replaceAll('\r\n', '\n')
  if (normalize(fs.readFileSync('supabase/setup.sql', 'utf8')) !== normalize(sql)) {
    throw new Error('supabase/setup.sql is out of date. Run node scripts/build-sql.mjs.')
  }
  console.log(`Verified supabase/setup.sql matches ${files.length} migrations.`)
} else {
  fs.writeFileSync('supabase/setup.sql', sql)
  console.log(`Built supabase/setup.sql from ${files.length} migrations.`)
}
