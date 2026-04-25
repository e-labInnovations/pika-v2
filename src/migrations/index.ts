import * as migration_20260404_060059 from './20260404_060059';
import * as migration_20260425_000000_seed_ai_models from './20260425_000000_seed_ai_models';

export const migrations = [
  {
    up: migration_20260404_060059.up,
    down: migration_20260404_060059.down,
    name: '20260404_060059',
  },
  {
    up: migration_20260425_000000_seed_ai_models.up,
    down: migration_20260425_000000_seed_ai_models.down,
    name: '20260425_000000_seed_ai_models',
  },
];
