// scripts/install-deps.js
const { exec } = require('child_process');
const os = require('os');

const platform = os.platform();

if (platform === 'linux') {
  console.log('Detected Linux. Installing TTS dependencies...');
  exec(
    'sudo apt-get update && sudo apt-get install -y espeak festival',
    (error, stdout, stderr) => {
      if (error) {
        console.error(`Error installing dependencies: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
        return;
      }
      console.log(`stdout: ${stdout}`);
    },
  );
} else {
  console.log(`No additional dependencies required for ${platform}`);
}
