import JSON5 from 'json5';

class StorageUtil {
  static async getReaderConfig(store, key) {
    const v0 = await store.get('readerConfig');
    const readerConfig = v0 ? JSON5.parse(v0) : {};
    return readerConfig[key];
  }

  static async setReaderConfigs(store, obj) {
    const v0 = await store.get('readerConfig');
    const readerConfig = v0 ? JSON5.parse(v0) : {};
    for (const [key, value] of Object.entries(obj)) {
      readerConfig[key] = value;
    }
    store.set('readerConfig', JSON.stringify(readerConfig));
  }

  static async setReaderConfig(store, key, value) {
    const v0 = await store.get('readerConfig');
    const readerConfig = v0 ? JSON5.parse(v0) : {};
    readerConfig[key] = value;
    store.set('readerConfig', JSON.stringify(readerConfig));
  }

  static async getAppSettingConfig(store, key) {
    const v0 = await store.get('appSettingConfig');
    const aconfig = v0 ? JSON5.parse(v0) : {};
    return aconfig[key];
  }

  static async setAppSettingConfig(store, key, value) {
    const v0 = await store.get('appSettingConfig');
    const aconfig = v0 ? JSON5.parse(v0) : {};
    aconfig[key] = value;
    store.set('appSettingConfig', JSON.stringify(aconfig));
  }

  static async setAppSettingConfigs(store, obj) {
    const v0 = await store.get('appSettingConfig');
    const aconfig = v0 ? JSON5.parse(v0) : {};
    for (const [key, value] of Object.entries(obj)) {
      aconfig[key] = value;
    }
    store.set('appSettingConfig', JSON.stringify(aconfig));
  }

}

export default StorageUtil;
