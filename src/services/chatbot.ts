import { requireSupabase } from './supabase';
export type ChatTurn={role:'user'|'assistant';content:string};
export type ChatSource={topic:string;checkedAt:string;records:Record<string,string|number|boolean|null>[];totalMatches?:number;limit?:number;completedTrips?:number;currentTier?:string;tripsToNextReward?:number;nextRewardValue?:number;filters?:{from?:string;to?:string;date?:string;event?:string}};
export type ChatReply={configured:boolean;answer:string;sources:ChatSource[];links:{label:string;path:string}[]};
export async function askAssistant(message:string,history:ChatTurn[]):Promise<ChatReply> {
  const {data,error}=await requireSupabase().functions.invoke('chatbot',{body:{message,history:history.slice(-8)}});
  if(error){
    const response=(error as {context?:Response}).context;
    const body=await response?.clone().json().catch(()=>null);
    throw new Error(body?.error || 'The assistant is unavailable. Subukan ulit o gamitin ang Travel guide.');
  }
  if(data?.error || typeof data?.answer!=='string')throw new Error(data?.error || 'The assistant could not answer. Try again.');
  // Carry filters from older deployed tool responses into the Search action too.
  const source = data.sources?.find((source:ChatSource)=>source.topic==='get_sailings');
  if(source?.filters && data.links) {
    const query=new URLSearchParams({source:'assistant'});
    for(const key of ['from','to','date','event'] as const)if(source.filters[key])query.set(key,source.filters[key]);
    data.links=data.links.map((link:{label:string;path:string})=>['/search','/trips'].includes(link.path)?{...link,path:`/trips?${query}`}:link);
  }
  return data;
}
