import { DatabaseUtils } from './src/utils/DBHelper/DatabaseUtils';

async function globalTeardown(): Promise<void> {
  await DatabaseUtils.disconnect();
}

export default globalTeardown;
