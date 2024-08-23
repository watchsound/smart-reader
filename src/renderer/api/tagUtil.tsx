import JSON5 from 'json5';
import customStorage from '../store/customStorage';

class TagUtil {
  static async setTags(tagName: string) {
    const tagArr0 = (await customStorage.getItem('noteTags')) as string;
    const tagArr = tagArr0 !== '{}' && tagArr0 ? JSON5.parse(tagArr0 || '') : [];
    const index = tagArr.indexOf(tagName);
    if (index > -1) {
      tagArr.splice(index, 1);
      tagArr.unshift(tagName);
    } else {
      tagArr.unshift(tagName);
    }

    customStorage.setItem('noteTags', JSON.stringify(tagArr));
  }

  static async clear(tagName: string) {
    const tagArr0 = (await customStorage.getItem('noteTags')) as string;
    const tagArr = tagArr0 !== '{}' && tagArr0 ? JSON5.parse(tagArr0 || '') : [];
    const index = tagArr.indexOf(tagName);
    if (index > -1) {
      tagArr.splice(index, 1);
    }
    customStorage.setItem('noteTags', JSON.stringify(tagArr));
  }

  static async getAllTags() {
    const tagArr0 = (await customStorage.getItem('noteTags')) as string;
    const tagArr = tagArr0 !== '{}' && tagArr0 ? JSON5.parse(tagArr0 || '') : [];
    return tagArr || [];
  }
}

export default TagUtil;
