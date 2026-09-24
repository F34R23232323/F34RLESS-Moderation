export const STAFF_ROLE_IDS = {
  root: '1520031216651210773',
  sudo: '1490439698416402613',
  founders: '1479852874635939880',
  coOwner: '1534544391811891321',
  leadAdministrator: '1546938257990746183',
  administrator: '1534545792705237133',
  headModerator: '1538896865481850992',
  seniorModerator: '1534546302350659675',
  moderator: '1534546666726756373',
  trialModerator: '1534547067501023405',
} as const;

export const PUBLIC_STAFF_PROMOTION_ORDER = [
  STAFF_ROLE_IDS.trialModerator,
  STAFF_ROLE_IDS.moderator,
  STAFF_ROLE_IDS.seniorModerator,
  STAFF_ROLE_IDS.headModerator,
  STAFF_ROLE_IDS.administrator,
  STAFF_ROLE_IDS.leadAdministrator,
  STAFF_ROLE_IDS.coOwner,
] as const;

export const HIDDEN_PERMISSION_ROLE_IDS = [STAFF_ROLE_IDS.root, STAFF_ROLE_IDS.sudo] as const;
export const OWNERSHIP_ROLE_IDS = [STAFF_ROLE_IDS.founders, STAFF_ROLE_IDS.coOwner] as const;
