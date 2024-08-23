/* eslint-disable import/prefer-default-export */
/* eslint-disable @typescript-eslint/no-shadow */
import customStorage from '../store/customStorage';
import { getIframeDoc } from './docUtil';

declare let window: any;

export const tsTransform = async () => {
  const doc = getIframeDoc();
  if (!doc) return;
  const cc = await customStorage.getReaderConfig('convertChinese');
  if (cc && cc !== 'Default') {
    if (cc === 'Simplified To Traditional') {
      doc.querySelectorAll('p').forEach((item) => {
        item.innerHTML = item.innerHTML
          .split('')
          .map((item) => window.ChineseS2T.s2t(item))
          .join('');
        // item.innerHTML = item.innerHTML.replace(
        //   item.innerText,
        //   Chinese.s2t(item.innerText)
        // );
      });
    } else {
      doc.querySelectorAll('p').forEach((item) => {
        item.innerHTML = item.innerHTML
          .split('')
          .map((item) => window.ChineseS2T.t2s(item))
          .join('');
      });
    }
  }
};
