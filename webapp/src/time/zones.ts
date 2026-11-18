// IANA zone helpers. Zone rules always come from the engine (Intl / Temporal); nothing is bundled.

/**
 * Legacy IANA names (tzdata "backward" links) mapped to current names. Engines keep whatever name
 * they're given, and some report the device zone by a legacy name, so we normalise (decision D6).
 * A mapping is applied only if the engine knows the target, so older engines that predate a rename
 * (e.g. Europe/Kyiv, 2022b) keep the name they understand.
 */
export const ZONE_ALIASES: Readonly<Record<string, string>> = {
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Dacca': 'Asia/Dhaka',
  'Asia/Thimbu': 'Asia/Thimphu',
  'Asia/Ulan_Bator': 'Asia/Ulaanbaatar',
  'Asia/Macao': 'Asia/Macau',
  'Asia/Ujung_Pandang': 'Asia/Makassar',
  'Asia/Chongqing': 'Asia/Shanghai',
  'Asia/Chungking': 'Asia/Shanghai',
  'Asia/Harbin': 'Asia/Shanghai',
  'Asia/Tel_Aviv': 'Asia/Jerusalem',
  'Asia/Istanbul': 'Europe/Istanbul',
  'Asia/Ashkhabad': 'Asia/Ashgabat',
  'Europe/Kiev': 'Europe/Kyiv',
  'Europe/Uzhgorod': 'Europe/Kyiv',
  'Europe/Zaporozhye': 'Europe/Kyiv',
  'Europe/Belfast': 'Europe/London',
  'Europe/Nicosia': 'Asia/Nicosia',
  'America/Godthab': 'America/Nuuk',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'America/Catamarca': 'America/Argentina/Catamarca',
  'America/Cordoba': 'America/Argentina/Cordoba',
  'America/Jujuy': 'America/Argentina/Jujuy',
  'America/Mendoza': 'America/Argentina/Mendoza',
  'America/Indianapolis': 'America/Indiana/Indianapolis',
  'America/Fort_Wayne': 'America/Indiana/Indianapolis',
  'America/Louisville': 'America/Kentucky/Louisville',
  'America/Knox_IN': 'America/Indiana/Knox',
  'America/Montreal': 'America/Toronto',
  'America/Shiprock': 'America/Denver',
  'America/Ensenada': 'America/Tijuana',
  'America/Santa_Isabel': 'America/Tijuana',
  'America/Porto_Acre': 'America/Rio_Branco',
  'Atlantic/Faeroe': 'Atlantic/Faroe',
  'Africa/Asmera': 'Africa/Asmara',
  'Africa/Timbuktu': 'Africa/Bamako',
  'Pacific/Ponape': 'Pacific/Pohnpei',
  'Pacific/Truk': 'Pacific/Chuuk',
  'Pacific/Yap': 'Pacific/Chuuk',
  'Pacific/Enderbury': 'Pacific/Kanton',
  'Pacific/Samoa': 'Pacific/Pago_Pago',
  'Pacific/Johnston': 'Pacific/Honolulu',
  'Australia/ACT': 'Australia/Sydney',
  'Australia/Canberra': 'Australia/Sydney',
  'Australia/NSW': 'Australia/Sydney',
  'Australia/North': 'Australia/Darwin',
  'Australia/Queensland': 'Australia/Brisbane',
  'Australia/South': 'Australia/Adelaide',
  'Australia/Tasmania': 'Australia/Hobart',
  'Australia/Victoria': 'Australia/Melbourne',
  'Australia/West': 'Australia/Perth',
  'Australia/LHI': 'Australia/Lord_Howe',
  'US/Eastern': 'America/New_York',
  'US/Central': 'America/Chicago',
  'US/Mountain': 'America/Denver',
  'US/Pacific': 'America/Los_Angeles',
  'US/Alaska': 'America/Anchorage',
  'US/Hawaii': 'Pacific/Honolulu',
  'US/Arizona': 'America/Phoenix',
  'US/East-Indiana': 'America/Indiana/Indianapolis',
  'US/Michigan': 'America/Detroit',
  'US/Aleutian': 'America/Adak',
  'US/Samoa': 'Pacific/Pago_Pago',
  'Canada/Atlantic': 'America/Halifax',
  'Canada/Central': 'America/Winnipeg',
  'Canada/Eastern': 'America/Toronto',
  'Canada/Mountain': 'America/Edmonton',
  'Canada/Newfoundland': 'America/St_Johns',
  'Canada/Pacific': 'America/Vancouver',
  'Canada/Saskatchewan': 'America/Regina',
  'Canada/Yukon': 'America/Whitehorse',
  'Brazil/East': 'America/Sao_Paulo',
  'Brazil/West': 'America/Manaus',
  'Brazil/Acre': 'America/Rio_Branco',
  'Brazil/DeNoronha': 'America/Noronha',
  'Chile/Continental': 'America/Santiago',
  'Chile/EasterIsland': 'Pacific/Easter',
  'Mexico/General': 'America/Mexico_City',
  'Mexico/BajaNorte': 'America/Tijuana',
  'Mexico/BajaSur': 'America/Mazatlan',
  GB: 'Europe/London',
  'GB-Eire': 'Europe/London',
  Eire: 'Europe/Dublin',
  Japan: 'Asia/Tokyo',
  ROK: 'Asia/Seoul',
  PRC: 'Asia/Shanghai',
  ROC: 'Asia/Taipei',
  Hongkong: 'Asia/Hong_Kong',
  Singapore: 'Asia/Singapore',
  Israel: 'Asia/Jerusalem',
  Iran: 'Asia/Tehran',
  Egypt: 'Africa/Cairo',
  Libya: 'Africa/Tripoli',
  Turkey: 'Europe/Istanbul',
  Poland: 'Europe/Warsaw',
  Portugal: 'Europe/Lisbon',
  'W-SU': 'Europe/Moscow',
  Iceland: 'Atlantic/Reykjavik',
  Jamaica: 'America/Jamaica',
  Cuba: 'America/Havana',
  NZ: 'Pacific/Auckland',
  'NZ-CHAT': 'Pacific/Chatham',
  Navajo: 'America/Denver',
  Kwajalein: 'Pacific/Kwajalein',
  'Etc/UTC': 'UTC',
  'Etc/UCT': 'UTC',
  'Etc/Universal': 'UTC',
  'Etc/Zulu': 'UTC',
  UCT: 'UTC',
  Universal: 'UTC',
  Zulu: 'UTC',
  'Etc/GMT': 'UTC',
  'Etc/GMT0': 'UTC',
  'Etc/GMT+0': 'UTC',
  'Etc/GMT-0': 'UTC',
  'Etc/Greenwich': 'UTC',
  GMT: 'UTC',
  GMT0: 'UTC',
  'GMT+0': 'UTC',
  'GMT-0': 'UTC',
  Greenwich: 'UTC',
};

const formatterCache = new Map<string, Intl.DateTimeFormat | null>();

/** The engine's DateTimeFormat for a zone, or null if the engine doesn't know the zone. */
export function zoneFormatter(zone: string): Intl.DateTimeFormat | null {
  let f = formatterCache.get(zone);
  if (f === undefined) {
    try {
      f = new Intl.DateTimeFormat('en-US', { timeZone: zone });
    } catch {
      f = null;
    }
    formatterCache.set(zone, f);
  }
  return f;
}

export function isValidZone(zone: string): boolean {
  return zone.trim() !== '' && zoneFormatter(zone) !== null;
}

/**
 * Normalises a zone ID: fixes case the way the engine does, then maps legacy aliases.
 * Returns undefined for a zone the engine doesn't recognise.
 */
export function canonicalZone(zone: string): string | undefined {
  const f = zoneFormatter(zone.trim());
  if (!f) return undefined;
  const cased = f.resolvedOptions().timeZone;
  const target = ZONE_ALIASES[cased];
  return target !== undefined && isValidZone(target) ? target : cased;
}

/** The device's zone, normalised. Falls back to UTC if the engine reports nothing usable. */
export function deviceZone(): string {
  let reported: string | undefined;
  try {
    reported = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    reported = undefined;
  }
  return (reported && canonicalZone(reported)) ?? 'UTC';
}
