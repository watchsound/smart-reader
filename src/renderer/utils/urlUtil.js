import { isElectron } from 'react-device-detect';
import customStorage from '../store/customStorage';

export const openExternalUrl = async (url) => {
  const isUseBuiltIn = await customStorage.getReaderConfig('isUseBuiltIn');
  isElectron
    ? isUseBuiltIn === 'yes'
      ? window.open(url)
      : window.electron.shell.openExternal(url)
    : window.open(url);
};
