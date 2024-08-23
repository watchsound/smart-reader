import JSON5 from 'json5';
import customStorage from '../store/customStorage';

class ThemeUtil {
  static async setThemes(themeName: string) {
    const themeArr0 = (await customStorage.getItem('themeColors')) as string;
    const themeArr =
      themeArr0 !== '{}' && themeArr0 ? JSON5.parse(themeArr0 || '') : [];
    const index = themeArr.indexOf(themeName);
    if (index > -1) {
      themeArr.splice(index, 1);
      themeArr.unshift(themeName);
    } else {
      themeArr.unshift(themeName);
    }

    customStorage.setItem('themeColors', JSON.stringify(themeArr));
  }

  static async clear(themeName: string) {
    const themeArr0 = (await customStorage.getItem('themeColors')) as string;
    const themeArr =
      themeArr0 !== '{}' && themeArr0 ? JSON5.parse(themeArr0 || '') : [];
    const index = themeArr.indexOf(themeName);
    if (index > -1) {
      themeArr.splice(index, 1);
    }
    customStorage.setItem('themeColors', JSON.stringify(themeArr));
  }

  static async getAllThemes() {
    const themeArr0 = (await customStorage.getItem('themeColors')) as string;
    const themeArr =
      themeArr0 !== '{}' && themeArr0 ? JSON5.parse(themeArr0 || '') : [];
    return themeArr || [];
  }
}

export default ThemeUtil;
