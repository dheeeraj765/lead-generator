export function normalizePhone(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 0) return undefined;
  
  // Format US phone numbers
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  
  return digits;
}

export function normalizeWebsite(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  
  let normalized = url.trim().toLowerCase();
  
  // Add protocol if missing
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }
  
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');
  
  try {
    const urlObj = new URL(normalized);
    return urlObj.href;
  } catch {
    return undefined;
  }
}

export function normalizeBusinessName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function normalizeAddress(address: string | null | undefined): string | undefined {
  if (!address) return undefined;
  return address.trim().replace(/\s+/g, ' ');
}