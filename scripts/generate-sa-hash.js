#!/usr/bin/env node
/**
 * Run: node scripts/generate-sa-hash.js
 * Outputs the bcrypt hash to paste into the seed SQL.
 */
const bcrypt = require('bcryptjs')
const password = 'Din@16285'
bcrypt.hash(password, 12).then(hash => {
  console.log('\nSA password hash for:', password)
  console.log('\n' + hash)
  console.log('\nRun this SQL in Supabase:')
  console.log(`UPDATE ca1_staff SET password_hash = '${hash}' WHERE email = 'dinesh.k.wadhwani@gmail.com';`)
  console.log('')
})
