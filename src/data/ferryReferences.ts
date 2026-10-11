export type ReferenceMetadata = {
  kind: 'verified-reference' | 'demo-archive';
  operator?: string;
  operators?: string[];
  terminalOperator?: string | null;
  checkedAt?: string;
  sourceUrls?: string[];
  capacityStatus?: string;
  publishedCapacities?: number[];
  inactiveReason?: string | null;
  serviceNote?: string;
  schedules?: Array<{ operator: string; departureTimes: string[]; timezone: string; published: string | null }>;
  accommodationProfiles?: Array<{ operator: string; classes: string[]; scope: string }>;
};
export type VesselRouteReference = {
  id: string; code: string; originPortId: string; destinationPortId: string;
  origin: string; destination: string; isActive: boolean;
};
export type ReferenceRecord = {
  name?: string; code: string; referenceMetadata?: ReferenceMetadata | null;
  routes?: VesselRouteReference[];
  vessels?: Array<{ id: string; name: string; operator: string }>;
};
