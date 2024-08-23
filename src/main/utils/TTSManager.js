// src/main/tts.js
import say from 'say';
import { exec } from 'child_process';

class TTSManager {
  constructor() {
    if (TTSManager.instance) {
      return TTSManager.instance;
    }

    this.canUseTTS4Linux = false;
    TTSManager.instance = this;
  }

  async speakTextBySay(text) {
    say.stop();
    console.log(` speakTextBySay: ${text}`);
    return new Promise((resolve, reject) => {
      say.speak(text, undefined, 1.0, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async speakTextBySayImp(text) {
    const { platform } = process;
    if (platform === 'linux') {
      if (typeof this.canUseTTS4Linux === 'undefined') {
        exec('which espeak', (error, stdout, stderr) => {
          if (error || !stdout) {
            console.error('espeak is not installed. Please install espeak.');
            this.canUseTTS4Linux = false;
          } else {
            this.canUseTTS4Linux = true;
          }
        });
        return false;
      }
      if (!this.canUseTTS4Linux) {
        return false;
      }
    }
    try {
      console.log('in speakTextBySay');
      await this.speakTextBySay(text);
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }
}

// Export the singleton instance
const instance = new TTSManager();
// Object.freeze(instance);

export default instance;


