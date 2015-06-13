#!/usr/bin/env node

const spawn = require('win-spawn')

if (process.env.OPENSHIFT_REPO_DIR) {
  process.env.HOME = process.env.OPENSHIFT_REPO_DIR
}

const proc = spawn('gulp', ['build'])
proc.stdout.on('data', function (data) {
  process.stdout.write('' + data)
})
proc.stderr.on('data', function (data) {
  process.stderr.write('' + data)
})
proc.on('close', process.exit)
