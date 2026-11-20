export const ORGANIZATION_TYPES: Record<string, { label: string; icon: string; code: string; person: string; unit: string; services: string[] }> = {
  HOSPITAL: { label: 'Hospital', icon: '🏥', code: 'HOSP', person: 'Patient', unit: 'Department', services: ['General Consultation', 'Cardiology', 'Pediatrics', 'Pharmacy', 'Billing', 'Laboratory'] },
  BANK: { label: 'Bank', icon: '🏦', code: 'BANK', person: 'Customer', unit: 'Banking Service', services: ['Cash Deposit', 'Withdrawal', 'Account Services', 'Loans', 'Customer Support'] },
  OFFICE: { label: 'Private Office', icon: '🏢', code: 'OFFICE', person: 'Visitor', unit: 'Service', services: ['Customer Support', 'Documentation', 'HR', 'Payments', 'Enquiries'] },
  GOVERNMENT: { label: 'Government Office', icon: '🏛️', code: 'GOV', person: 'Citizen', unit: 'Service', services: ['Certificates', 'Applications', 'Verification', 'Payments', 'Citizen Services'] },
  INSTITUTE: { label: 'Educational Institute', icon: '🎓', code: 'INST', person: 'Student', unit: 'Office', services: ['Admissions', 'Certificates', 'Fees', 'Examination Cell', 'Student Services'] },
  SERVICE: { label: 'Service Center', icon: '🛠️', code: 'SERV', person: 'Customer', unit: 'Service', services: ['Repair', 'Customer Support', 'Product Collection', 'Warranty', 'Payments'] }
};

export function getOperatingDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
