// UAE emirates, mainland licensing authorities and free zones (checked November 2026).
// The first authority in each list is preselected for mainland companies.

export const OTHER = 'Other (please specify)';

export const EMIRATES = {
  'Abu Dhabi': {
    mainland: [
      'Abu Dhabi Department of Economic Development (ADDED)',
      'Abu Dhabi Registration Authority (ADRA)',
    ],
    freeZones: [
      'Abu Dhabi Global Market (ADGM)',
      'Abu Dhabi Airports Free Zone (ADAFZ)',
      'Khalifa Economic Zones Abu Dhabi (KEZAD / KIZAD)',
      'Masdar City Free Zone',
      'twofour54 (Abu Dhabi Media Free Zone)',
    ],
  },
  Dubai: {
    mainland: ['Department of Economy and Tourism (DET), Dubai'],
    freeZones: [
      'Dubai Multi Commodities Centre (DMCC)',
      'Jebel Ali Free Zone (JAFZA)',
      'Dubai Airport Free Zone (DAFZA)',
      'Dubai South Free Zone',
      'International Free Zone Authority (IFZA)',
      'Meydan Free Zone',
      'Dubai International Financial Centre (DIFC)',
      'Dubai Silicon Oasis (DSO)',
      'Dubai CommerCity',
      'Dubai World Trade Centre Free Zone (DWTC)',
      'Dubai Healthcare City (DHCC)',
      'Dubai Internet City (DIC)',
      'Dubai Media City (DMC)',
      'Dubai Studio City',
      'Dubai Production City',
      'Dubai Knowledge Park (DKP)',
      'Dubai International Academic City (DIAC)',
      'Dubai Science Park',
      'Dubai Design District (d3)',
      'Dubai Outsource City',
      'Dubai Maritime City',
      'Dubai Cars and Automotive Zone (DUCAMZ)',
      'Gold and Diamond Park',
      'Dubai Textile City',
      'Expo City Dubai',
      'International Humanitarian City',
    ],
  },
  Sharjah: {
    mainland: ['Sharjah Economic Development Department (SEDD)'],
    freeZones: [
      'Sharjah Airport International Free Zone (SAIF Zone)',
      'Hamriyah Free Zone (HFZA)',
      'Sharjah Media City (Shams)',
      'Sharjah Publishing City Free Zone (SPC)',
      'Sharjah Research, Technology and Innovation Park (SRTI Park)',
      'Sharjah Healthcare City (SHCC)',
      'Sharjah Communication Technologies Free Zone (COMTECH)',
      'USA Regional Trade Center (USARTC)',
    ],
  },
  Ajman: {
    mainland: ['Ajman Department of Economic Development (Ajman DED)'],
    freeZones: [
      'Ajman Free Zone (AFZ)',
      'Ajman Media City Free Zone',
      'Ajman NuVentures Centre Free Zone',
    ],
  },
  'Umm Al Quwain': {
    mainland: ['Umm Al Quwain Department of Economic Development (UAQ DED)'],
    freeZones: ['Umm Al Quwain Free Trade Zone (UAQ FTZ)'],
  },
  'Ras Al Khaimah': {
    mainland: ['Ras Al Khaimah Department of Economic Development (RAK DED)'],
    freeZones: [
      'Ras Al Khaimah Economic Zone (RAKEZ)',
      'RAK Digital Assets Oasis (RAK DAO)',
      'RAK Maritime City Free Zone',
    ],
  },
  Fujairah: {
    mainland: [
      'Fujairah Department of Economic Development (Fujairah DED)',
      'Fujairah Municipality',
    ],
    freeZones: [
      'Fujairah Free Zone (FFZA)',
      'Creative City Fujairah',
      'Fujairah Oil Industry Zone (FOIZ)',
    ],
  },
};

export const EMIRATE_NAMES = Object.keys(EMIRATES);
