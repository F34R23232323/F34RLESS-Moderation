import type { Migration } from '../migrationRunner';
import { migration001 } from './001_initial';
import { migration002 } from './002_message_builder';
import { migration003 } from './003_case_code';
import { migration004 } from './004_dashboard_log_requests';
import { migration005 } from './005_guild_roles';
import { migration006 } from './006_guild_channels_position';
import { migration007 } from './007_afk_mentions';
import { migration008 } from './008_reports_detail';
import { migration009 } from './009_archives';
import { migration010 } from './010_message_snapshots';
import { migration011 } from './011_archive_components';

export const migrations: Migration[] = [migration001, migration002, migration003, migration004, migration005, migration006, migration007, migration008, migration009, migration010, migration011];