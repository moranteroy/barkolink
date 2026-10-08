import { executeDatabase, type DatabaseClient } from './database/client';
export type VerifiedTicket = {
  id:string;fullName:string;passengerType:string;ticketCode:string;ticketStatus:string;checkedInAt?:string;boardedAt?:string;
  booking:{reference:string;accommodationName?:string;paymentStatus:string;status:string;sailing:{code:string;departureAt:string;arrivalAt:string;status:string;vessel:{name:string};origin:{name:string};destination:{name:string}}};
};
export type TicketQrVerification = {passenger:VerifiedTicket;alreadyBoarded:boolean;legacyCode:boolean};
export function verifyTicketQr(client:DatabaseClient,payload:string,sailingCode:string){
  return executeDatabase<TicketQrVerification>(client,'VerifyTicketQr',{payload,sailingCode});
}
