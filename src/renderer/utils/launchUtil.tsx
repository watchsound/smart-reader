import { isElectron } from 'react-device-detect';
import customStorage from '../store/customStorage';

export const initTheme = async () => {
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  let isNight = false;
  if (isElectron) {
    isNight = await window.electron.ipcRenderer.system_color(null); // ipcRenderer.sendSync("system-color");
  } else {
    isNight =
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  customStorage.setReaderConfig('isOSNight', isNight ? 'yes' : 'no');
  const appSkin = await customStorage.getReaderConfig('appSkin');
  if (!appSkin) {
    customStorage.setReaderConfig('appSkin', 'system');
    if (isNight) {
    }
  }
  const isOSNight = await customStorage.getReaderConfig('isOSNight');
  if (appSkin === 'night' || (appSkin === 'system' && isOSNight === 'yes')) {
    style.href = './styles/dark.css';
  } else {
    style.href = './styles/default.css';
  }
  document.head.appendChild(style);
};
export const initSystemFont = async () => {
  const systemFont = await customStorage.getReaderConfig('systemFont');
  if (systemFont) {
    const body = document.getElementsByTagName('body')[0];
    body.setAttribute('style', `font-family:${systemFont}!important`);
  }
};
