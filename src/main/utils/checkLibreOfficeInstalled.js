import { spawn, exec } from 'child_process';

import fs from 'fs';


const libreOfficePath = {
  win32: 'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  darwin: '/Applications/LibreOffice.app/Contents/MacOS/soffice',
  linux: '/usr/bin/soffice',
}[process.platform];

function checkTwo() {
  return new Promise((resolve, reject) => {
    exec('soffice --version', (error, stdout, stderr) => {
      if (error) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

function checkExecutable() {
  // First, check if the executable exists
  return fs.existsSync(libreOfficePath);
}

// FIXME  bug here:  spawn is not executed.
function checkOne() {
  return new Promise((resolve) => {
    console.log('Checking LibreOffice installation...');

    const process = spawn(libreOfficePath, ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let output = '';
    let errorOutput = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    process.on('close', (code) => {
      console.log('Process closed with code:', code);
      console.log('stdout:', output);
      console.log('stderr:', errorOutput);
      if (
        output.includes('LibreOffice') ||
        errorOutput.includes('LibreOffice')
      ) {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    process.on('error', (err) => {
      console.error('Process error:', err);
      resolve(false);
    });
  });
}

async function checkLibreOfficeInstalled() {
  let r = checkExecutable();
  if (r) return r;
  r = await checkTwo();
  if (r) return r;
  // console.log(`start checkOne `);
  // r = await checkOne();
  // console.log(`checkOne ${r}`);
  return r;
}

export default checkLibreOfficeInstalled;
