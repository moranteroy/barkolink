import { executeDatabase, type DatabaseClient } from './client';
export type VesselPosition = { state: 'UNKNOWN'|'CONFIRMED'|'EXPECTED'|'UNDERWAY'|'DELAYED'|'CONFLICT'; portId?:string; portName?:string; confirmedPortName?:string; confirmedAt?:string; reason?:string; tripCode?:string; originPortId?:string; destinationPortId?:string; arrivalAt?:string };
export type VesselPositions = { vessels:{id:string;name:string;operator?:string;position:VesselPosition}[]; ports:{id:string;name:string}[] };
export const vesselPositions = (client:DatabaseClient) => executeDatabase<VesselPositions>(client,'AdminVesselPositions',{});
export const confirmVesselPort = (client:DatabaseClient,args:{vesselId:string;portId:string;observedAt:string;note:string}) => executeDatabase<VesselPositions>(client,'AdminConfirmVesselPort',args);
export const vesselAvailability = (client:DatabaseClient,args:{originPortId:string;departureAt:string;excludeCode?:string}) => executeDatabase<{vessels:{id:string;issue:string|null}[]}>(client,'AdminVesselAvailability',args);
