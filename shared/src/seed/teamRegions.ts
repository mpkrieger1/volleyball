// Region mapping by team abbreviation. Used by the league seeder to set
// `Team.region` without requiring a CSV column. Approximate — Sprint 7
// uses this only for soft travel-sanity scheduling.
//
// Regions:
//   EAST:     NY / NJ / MA / CT / RI / NH / VT / ME / PA / DE / MD / DC /
//             VA / WV / NC / SC / GA / FL
//   MOUNTAIN: AZ / CO / UT / NM / MT / ID / WY / NV
//   PACIFIC:  CA / OR / WA / HI / AK
//   CENTRAL:  everything else (TX / OK / KS / NE / MN / WI / MI / IL / IN /
//             OH / KY / TN / AL / MS / LA / AR / MO / IA / ND / SD)
//
// Any abbr NOT in this map defaults to CENTRAL at seed time.

export type TeamRegion = 'EAST' | 'CENTRAL' | 'MOUNTAIN' | 'PACIFIC';

export const TEAM_REGION_OVERRIDES: Record<string, TeamRegion> = {
  // ─── PACIFIC ────────────────────────────────────────────────────
  CAL: 'PACIFIC', STAN: 'PACIFIC', UCLA: 'PACIFIC', USC: 'PACIFIC',
  ORE: 'PACIFIC', ORST: 'PACIFIC', WASH: 'PACIFIC',
  CPSL: 'PACIFIC', CSUB: 'PACIFIC', CSUF: 'PACIFIC', CSUN: 'PACIFIC',
  HAW: 'PACIFIC', LBSU: 'PACIFIC', UCD: 'PACIFIC', UCI: 'PACIFIC',
  UCR: 'PACIFIC', UCSD: 'PACIFIC', UCSB: 'PACIFIC',
  LMU: 'PACIFIC', PEPP: 'PACIFIC', POR: 'PACIFIC', STM: 'PACIFIC',
  SD: 'PACIFIC', USF2: 'PACIFIC', SCU: 'PACIFIC', PAC: 'PACIFIC', GONZ: 'PACIFIC',
  SJSU: 'PACIFIC', FRES: 'PACIFIC', SDSU: 'PACIFIC', SEA: 'PACIFIC',
  EWU: 'PACIFIC', PSU2: 'PACIFIC', SAC: 'PACIFIC',

  // ─── MOUNTAIN ───────────────────────────────────────────────────
  ARIZ: 'MOUNTAIN', ASU: 'MOUNTAIN', COLO: 'MOUNTAIN', UTAH: 'MOUNTAIN',
  BYU: 'MOUNTAIN',
  AF: 'MOUNTAIN', BSU: 'MOUNTAIN', CSU: 'MOUNTAIN', NEV: 'MOUNTAIN',
  UNM: 'MOUNTAIN', UNLV: 'MOUNTAIN', USU: 'MOUNTAIN', WYO: 'MOUNTAIN',
  DEN: 'MOUNTAIN', GCU: 'MOUNTAIN', SUU: 'MOUNTAIN', UTCH: 'MOUNTAIN',
  UVU: 'MOUNTAIN', NAU: 'MOUNTAIN', UNCO: 'MOUNTAIN', IDA: 'MOUNTAIN',
  IDST: 'MOUNTAIN', MONT: 'MOUNTAIN', MTST: 'MOUNTAIN', WEB: 'MOUNTAIN',
  NMST: 'MOUNTAIN', UTEP: 'MOUNTAIN',

  // ─── EAST ───────────────────────────────────────────────────────
  BC: 'EAST', CLEM: 'EAST', DUKE: 'EAST', FSU: 'EAST', GT: 'EAST',
  LOU: 'EAST', MIA: 'EAST', NCST: 'EAST', UNC: 'EAST', ND: 'EAST',
  PITT: 'EAST', SYR: 'EAST', UVA: 'EAST', VT: 'EAST', WAKE: 'EAST',
  ALA: 'EAST', AUB: 'EAST', FLA: 'EAST', UGA: 'EAST', UK: 'EAST',
  MSST: 'EAST', MISS: 'EAST', SC: 'EAST', TENN: 'EAST', VAN: 'EAST',
  UMD: 'EAST', PSU: 'EAST', RUT: 'EAST',
  UCF: 'EAST', WVU: 'EAST', CIN: 'EAST',
  BUT: 'EAST', CREI: 'EAST', DEP: 'EAST', GTWN: 'EAST', MARQ: 'EAST',
  PROV: 'EAST', STJ: 'EAST', SHU: 'EAST', CONN: 'EAST', VILL: 'EAST',
  XAV: 'EAST',
  CLT: 'EAST', ECU: 'EAST', FAU: 'EAST', TEM: 'EAST', USF: 'EAST',
  BRWN: 'EAST', COL: 'EAST', CRNL: 'EAST', DART: 'EAST', HARV: 'EAST',
  PENN: 'EAST', PRIN: 'EAST', YALE: 'EAST',
  AMER: 'EAST', ARMY: 'EAST', BU: 'EAST', BUCK: 'EAST', COLG: 'EAST',
  HC: 'EAST', LAF: 'EAST', LEH: 'EAST', LOYM: 'EAST', NAVY: 'EAST',
  DAV: 'EAST', DAY: 'EAST', DUQ: 'EAST', FOR: 'EAST', GMU: 'EAST',
  GW: 'EAST', LAS: 'EAST', UMAS: 'EAST', URI: 'EAST', RICH: 'EAST',
  SJU: 'EAST', VCU: 'EAST',
  CAMP: 'EAST', COFC: 'EAST', DEL: 'EAST', DREX: 'EAST', ELON: 'EAST',
  HAMP: 'EAST', HOF: 'EAST', MON: 'EAST', NCAT: 'EAST', NE: 'EAST',
  SBU: 'EAST', TOW: 'EAST', UNCW: 'EAST', WM: 'EAST',
  CAN: 'EAST', FAIR: 'EAST', IONA: 'EAST', MAN: 'EAST', MRST: 'EAST',
  MER: 'EAST', MSM: 'EAST', NIA: 'EAST', QUIN: 'EAST', RID: 'EAST',
  SH: 'EAST', SP: 'EAST', SIE: 'EAST',
  CSU2: 'EAST', GARW: 'EAST', HP: 'EAST', LONG: 'EAST', PRES: 'EAST',
  RAD: 'EAST', UNCA: 'EAST', WIN: 'EAST',
  CHAT: 'EAST', ETSU: 'EAST', FUR: 'EAST', MERC: 'EAST', SAM: 'EAST',
  UNCG: 'EAST', VMI: 'EAST', WCU: 'EAST', WOF: 'EAST',
  COP: 'EAST', DSU: 'EAST', HOW: 'EAST', UMES: 'EAST', MOR: 'EAST',
  NSU: 'EAST', NCCU: 'EAST', SCST: 'EAST',
  CCSU: 'EAST', FDU: 'EAST', LIU: 'EAST', MERC2: 'EAST', LEM: 'EAST',
  SFP: 'EAST', STON: 'EAST', WAG: 'EAST',
  ALB: 'EAST', BING: 'EAST', BRY: 'EAST', ME: 'EAST', NJIT: 'EAST',
  UML: 'EAST', UNH: 'EAST', UMBC: 'EAST', UVM: 'EAST',
  JAX: 'EAST', JVST: 'EAST', LIB: 'EAST', MTSU: 'EAST', SHSU: 'EAST',
  FGCU: 'EAST', UNF: 'EAST', STET: 'EAST', UWG: 'EAST', BELL: 'EAST',
  UNA: 'EAST', LIPS: 'EAST',
  GASO: 'EAST', GSU: 'EAST', JMU: 'EAST', ODU: 'EAST', APP: 'EAST',
  CCU: 'EAST', USA: 'EAST', ALST: 'EAST', BCU: 'EAST', FAMU: 'EAST',
  APSU: 'EAST', AAMU: 'EAST',
  FIU: 'EAST', MRSH: 'EAST', KSU2: 'EAST',
  // All NCAA women's volleyball AAC teams that play in SE/East proper
};
