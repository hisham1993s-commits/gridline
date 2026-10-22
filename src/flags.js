// Country flag emoji from a country name (for race locations).
// Flag emoji are standard Unicode (regional-indicator pairs).

const NAME_TO_ISO2 = {
  australia: 'AU', china: 'CN', japan: 'JP', bahrain: 'BH',
  'saudi arabia': 'SA', usa: 'US', 'united states': 'US',
  'united states of america': 'US', italy: 'IT', monaco: 'MC',
  canada: 'CA', spain: 'ES', austria: 'AT', uk: 'GB',
  'united kingdom': 'GB', 'great britain': 'GB', england: 'GB',
  hungary: 'HU', belgium: 'BE', netherlands: 'NL', azerbaijan: 'AZ',
  singapore: 'SG', mexico: 'MX', brazil: 'BR', qatar: 'QA',
  uae: 'AE', 'united arab emirates': 'AE', france: 'FR',
  germany: 'DE', portugal: 'PT', turkey: 'TR', russia: 'RU',
  switzerland: 'CH', 'south africa': 'ZA', thailand: 'TH',
  'korea': 'KR', 'south korea': 'KR', india: 'IN', malaysia: 'MY',
};

function iso2ToFlag(code) {
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export function countryFlag(name) {
  if (!name) return '';
  const iso = NAME_TO_ISO2[name.trim().toLowerCase()];
  return iso ? iso2ToFlag(iso) : '';
}
