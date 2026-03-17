import net from 'net';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { spawn } from 'child_process';

async function checkIfChromaIsRunning(url) {
  // console.log(port + ":" + host)
  try {
    const response = await axios.get(url);
    console.log(`response = ${response}`);
    if (response.status === 200 || response.status === 404) {
      return true; // Server is running
    }
    return false; // Server responded, but not with 200
  } catch (error) {
    if (error.response) {
      console.log(
        `Server responded with error status: ${error.response.status}`,
      );
      return true; // Server is up but responded with an error (e.g., 404)
    }
    console.error('Error connecting to Chroma server:', error.message);
    return false; // Server is not reachable
  }
}
// function checkIfChromaIsRunning(port = 8000, host = '127.0.0.1') {
//   return new Promise((resolve, reject) => {
//     const socket = new net.Socket();

//     socket.setTimeout(2000); // Timeout after 2 seconds

//     socket
//       .connect(port, host, () => {
//         socket.end();
//         resolve(true);
//       })
//       .on('error', () => {
//         resolve(false);
//       })
//       .on('timeout', () => {
//         socket.destroy();
//         resolve(false);
//       });
//   });
// }

// async function startChroma(store) {
//   let dataPath = await global.shared.store.get('storageLocation');
//   dataPath = dataPath || global.shared.storageLocation;
//   const outPath = path.join(dataPath, `chroma-data`);
//   if (!fs.existsSync(outPath)) {
//     fs.mkdirSync(outPath, { recursive: true });
//   }
//   return new Promise((resolve, reject) => {
//     const chromaProcess = exec(
//       `chroma run --path ${outPath}`,
//       (error, stdout, stderr) => {
//         if (error) {
//           console.error(`!!!!! !!!!! Error starting Chroma: ${error.message}`);
//           reject(error);
//         }
//         if (stderr) {
//           console.error(`!!!!! !!!!! Chroma stderr: ${stderr}`);
//         }
//         resolve(stdout);
//       },
//     );

//     chromaProcess.on('close', (code) => {
//       console.log(`Chroma process exited with code ${code}`);
//     });
//   });
// }

async function startChroma(store) {
  let dataPath = await global.shared.store.get('storageLocation');
  dataPath = dataPath || global.shared.storageLocation;
  const outPath = path.join(dataPath, `chroma-data`);

  if (!fs.existsSync(outPath)) {
    fs.mkdirSync(outPath, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const chromaProcess = spawn('chroma', ['run', '--path', outPath], {
      stdio: 'inherit',
    });

    // Resolve when the process is successfully spawned
    chromaProcess.on('spawn', () => {
      console.log('Chroma process started successfully.');
      resolve(chromaProcess); // Return the process handle if needed
    });

    chromaProcess.on('error', (error) => {
      console.error(`Error starting Chroma: ${error.message}`);
      reject(error);
    });

    chromaProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Chroma process exited with code ${code}`);
      } else {
        console.log('Chroma process exited successfully.');
      }
    });
  });
}

// Example usage
// (async () => {
//   try {
//     await startChroma();
//     console.log("Chroma server is running!");
//   } catch (error) {
//     console.error("Failed to start Chroma server:", error);
//   }
// })();

async function ensureChromaIsRunning(store) {
  const urlpath = store.get('chroma_url') || 'http://127.0.0.1:8000';
  const url = new URL(urlpath);
  const { port } = url;
  const urlWithoutPort = `${url.protocol}//${url.hostname}${url.pathname}${url.search}${url.hash}`;

  const isRunning = await checkIfChromaIsRunning(urlpath); // port, urlWithoutPort);
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
