import * as migration_20260404_060059 from './20260404_060059';
import * as migration_20260425_000000_seed_ai_models from './20260425_000000_seed_ai_models';
import * as migration_20260426_000000_add_ai_prompts from './20260426_000000_add_ai_prompts';
import * as migration_20260426_200000_move_title_embeddings from './20260426_200000_move_title_embeddings';
import * as migration_20260930_000000_add_transaction_shares from './20260930_000000_add_transaction_shares';
import * as migration_20261001_000000_encrypt_api_keys from './20261001_000000_encrypt_api_keys';
import * as migration_20261002_000000_add_sms_capture from './20261002_000000_add_sms_capture';
import * as migration_20261004_000000_add_person_upi_ids from './20261004_000000_add_person_upi_ids';

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
  {
    up: migration_20260930_000000_add_transaction_shares.up,
    down: migration_20260930_000000_add_transaction_shares.down,
    name: '20260930_000000_add_transaction_shares',
  },
  {
    up: migration_20261001_000000_encrypt_api_keys.up,
    down: migration_20261001_000000_encrypt_api_keys.down,
    name: '20261001_000000_encrypt_api_keys',
  },
  {
    up: migration_20261002_000000_add_sms_capture.up,
    down: migration_20261002_000000_add_sms_capture.down,
    name: '20261002_000000_add_sms_capture',
  },
  {
    up: migration_20261004_000000_add_person_upi_ids.up,
    down: migration_20261004_000000_add_person_upi_ids.down,
    name: '20261004_000000_add_person_upi_ids',
  },
];
