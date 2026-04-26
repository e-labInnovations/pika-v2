import * as migration_20260404_060059 from './20260404_060059';
import * as migration_20260425_000000_seed_ai_models from './20260425_000000_seed_ai_models';
import * as migration_20260426_000000_add_ai_prompts from './20260426_000000_add_ai_prompts';
import * as migration_20260426_200000_move_title_embeddings from './20260426_200000_move_title_embeddings';

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
  {
    up: migration_20260426_000000_add_ai_prompts.up,
    down: migration_20260426_000000_add_ai_prompts.down,
    name: '20260426_000000_add_ai_prompts',
  },
  {
    up: migration_20260426_200000_move_title_embeddings.up,
    down: migration_20260426_200000_move_title_embeddings.down,
    name: '20260426_200000_move_title_embeddings',
  },
];
