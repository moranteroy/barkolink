import { executeDatabase, type DatabaseClient } from './database/client';
export type VoucherQuote = {code:string; discount:number; subtotal:number; total:number};
export type Voucher = {id:string;code:string;discountType:'FIXED'|'PERCENT';value:number;minimumSpend:number;usageLimit:number;used:number;startsAt:string;expiresAt:string;isActive:boolean};
export const quoteVoucher=(client:DatabaseClient,args:object)=>executeDatabase<VoucherQuote>(client,'QuoteVoucher',args);
export const listVouchers=(client:DatabaseClient)=>executeDatabase<{vouchers:Voucher[]}>(client,'AdminVouchers',{});
export const saveVoucher=(client:DatabaseClient,args:object)=>executeDatabase(client,'AdminSaveVoucher',args);
export type LoyaltyData = {completedTrips:number;tripsPerReward:number;rewardValue:number;tripsToNextReward:number;currentTier:string;tiers:{name:string;trips:number;value:number}[];vouchers:{code:string;value:number;expiresAt:string}[]};
export const myLoyalty=(client:DatabaseClient)=>executeDatabase<LoyaltyData>(client,'MyLoyalty',{});
export const quoteLoyaltyVoucher=(client:DatabaseClient,args:object)=>executeDatabase<{quote:VoucherQuote|null}>(client,'QuoteLoyaltyVoucher',args);
