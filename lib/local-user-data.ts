import { mergeSavedUserData, savedUserDataSchema, type SavedUserData } from './user-data';

export const LOCAL_USER_DATA_KEY = 'bloomwell-local-user-data-v1';
export const LEGACY_USER_DATA_KEY = 'bloomwell-user-data-v1';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function loadLocalUserData(storage: StorageLike): SavedUserData {
  const currentValue = storage.getItem(LOCAL_USER_DATA_KEY);
  const legacyValue = storage.getItem(LEGACY_USER_DATA_KEY);
  const currentData = currentValue ? savedUserDataSchema.parse(JSON.parse(currentValue)) : {};
  const legacyData = legacyValue ? savedUserDataSchema.parse(JSON.parse(legacyValue)) : {};
  return mergeSavedUserData(legacyData, currentData);
}

export function saveLocalUserData(storage: StorageLike, data: SavedUserData) {
  const parsed = savedUserDataSchema.parse(data);
  storage.setItem(LOCAL_USER_DATA_KEY, JSON.stringify(parsed));
}
