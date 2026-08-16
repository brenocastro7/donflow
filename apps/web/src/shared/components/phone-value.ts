const supportedPrefixes = [
  '+351',
  '+353',
  '+352',
  '+258',
  '+245',
  '+244',
  '+239',
  '+238',
  '+55',
  '+49',
  '+44',
  '+41',
  '+39',
  '+34',
  '+33',
  '+32',
  '+31',
  '+1',
];

export function optionalPhone(value: string): string | undefined {
  const normalized = value.trim();
  const prefix = supportedPrefixes.find((candidate) => normalized.startsWith(candidate));
  return prefix && normalized.length > prefix.length ? normalized : undefined;
}
