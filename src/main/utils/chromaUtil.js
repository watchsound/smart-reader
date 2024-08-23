import net from 'net';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';

function checkIfChromaIsRunning(port = 8000, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();

    socket.setTimeout(2000); // Timeout after 2 seconds

    socket
      .connect(port, host, () => {
        socket.end();
        resolve(true);
      })
      .on('error', () => {
        resolve(false);
      })
      .on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
  });
}

async function startChroma(store) {
  let dataPath = await global.shared.store.get('storageLocation');
  dataPath = dataPath || global.shared.storageLocation;
  const outPath = path.join(dataPath, `chroma-data`);
  if (!fs.existsSync(outPath)) {
    fs.mkdirSync(outPath, { recursive: true });
  }
  return new Promise((resolve, reject) => {
    const chromaProcess = exec(
      `chroma run --path ${outPath}`,
      (error, stdout, stderr) => {
        if (error) {
          console.error(`!!!!! !!!!! Error starting Chroma: ${error.message}`);
          reject(error);
        }
        if (stderr) {
          console.error(`!!!!! !!!!! Chroma stderr: ${stderr}`);
        }
        resolve(stdout);
      },
    );

    chromaProcess.on('close', (code) => {
      console.log(`Chroma process exited with code ${code}`);
    });
  });
}

async function ensureChromaIsRunning(store) {
  const urlpath = store.get('chroma_url') || 'http://localhost:8000';
  const url = new URL(urlpath);
  const { port } = url;
  const urlWithoutPort = `${url.protocol}//${url.hostname}${url.pathname}${url.search}${url.hash}`;

  const isRunning = await checkIfChromaIsRunning(port, urlWithoutPort);
  if (!isRunning) {
    console.log('Chroma is not running, starting Chroma...');
    try {
      await startChroma(store);
      console.log('Chroma started successfully.');
    } catch (e) {
      console.log(`Chroma started failed. ${e}`);
    }
  } else {
    console.log('Chroma is already running.');
  }
}

export default ensureChromaIsRunning;
