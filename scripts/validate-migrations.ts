import { migrations } from '../shared/src/db/migrations';

const ids = migrations.map((migration) => migration.id);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length > 0) throw new Error(`Duplicate migration IDs: ${[...new Set(duplicates)].join(', ')}`);
for (let index = 1; index < ids.length; index += 1) {
  if (ids[index - 1].localeCompare(ids[index], undefined, { numeric: true }) >= 0) {
    throw new Error(`Migrations are out of order: ${ids[index - 1]} before ${ids[index]}`);
  }
}
console.log(`Validated ${migrations.length} ordered, unique migrations; latest is ${ids.at(-1)}.`);
