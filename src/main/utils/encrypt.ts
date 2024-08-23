/* eslint-disable prettier/prettier */
import { safeStorage } from 'electron';
import { Buffer } from 'buffer';

export function hashText(text: string) {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return false;
    }

    return safeStorage.encryptString(text);
  } catch (err) {
    return false;
  }
}

export function decriptText(text: Buffer) {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return false;
    }

    return safeStorage.decryptString(text);
  } catch (err) {
    return false;
  }
}
