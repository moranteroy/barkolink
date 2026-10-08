<template>
  <ion-page><ion-content class="assistant-content"><main class="page-shell assistant-page">
    <PassengerHeader />
    <router-link class="back" to="/home">← Back to home</router-link>
    <section class="assistant-intro">
      <div class="assistant-avatar"><ion-icon :icon="chatbubbleEllipsesOutline" aria-hidden="true" /><span><ion-icon :icon="sparklesOutline" aria-hidden="true" /></span></div>
      <p class="eyebrow">BARKOLINK ASSISTANT</p><h1>Ask about your journey.</h1>
      <p class="intro-copy">Schedules, bookings, and travel help.<br />English, Tagalog, o Taglish—puwede lahat.</p>
      <span class="data-badge"><ion-icon :icon="shieldCheckmarkOutline" aria-hidden="true" /> Answers backed by your trip details</span>
    </section>
    <div v-if="!turns.length" class="suggestions" aria-label="Suggested questions"><button v-for="(question,index) in suggestions" :key="question" :disabled="busy" @click="send(question)"><ion-icon :icon="suggestionIcons[index]" aria-hidden="true" /><span><strong>{{ suggestionLabels[index] }}</strong><small>{{ question }}</small></span><ion-icon class="suggestion-arrow" :icon="arrowForwardOutline" aria-hidden="true" /></button></div>
    <section ref="conversation" class="conversation" aria-label="Chat conversation" role="log" aria-live="polite" :aria-busy="busy">
      <article v-for="(turn,index) in turns" :key="index" class="chat-turn" :class="turn.role">
        <strong>{{ turn.role==='user' ? 'You' : 'BarkoLink assistant' }}</strong><p>{{ turn.content }}</p>
        <div v-if="turn.reply?.configured===false" class="setup-note">AI setup is still in progress.</div>
        <details v-for="(source,sourceIndex) in turn.reply?.sources || []" :key="sourceIndex" class="source-details" :open="sourceIndex===0">
          <summary>{{ sourceTitle(source.topic) }} · {{ checkedTime(source.checkedAt) }}</summary>
          <p v-if="source.totalMatches!==undefined" class="scope">{{ source.totalMatches }} matching record{{ source.totalMatches===1?'':'s' }}<template v-if="source.totalMatches>(source.limit || 6)"> · Showing the first {{ source.limit || 6 }}</template></p>
          <p v-if="source.currentTier">{{ source.currentTier }} · {{ source.completedTrips }} completed trips · {{ source.tripsToNextReward }} trips to next reward (₱{{ source.nextRewardValue }})</p>
          <div v-for="(record,recordIndex) in source.records" :key="recordIndex" class="source-record"><dl><template v-for="(value,key) in record" :key="key"><template v-if="value!==null && value!==undefined"><dt>{{ fieldLabel(String(key)) }}</dt><dd>{{ fieldValue(String(key),value) }}</dd></template></template></dl></div>
          <p v-if="!source.records.length && source.topic!=='get_help'">No matching records were returned.</p>
        </details>
        <div v-if="turn.reply?.links.length" class="answer-links"><router-link v-for="link in turn.reply.links" :key="link.path" :to="link.path">{{ link.label }} →</router-link></div>
      </article>
      <p v-if="busy" class="chat-status" role="status">Checking your question and the latest system details…</p>
    </section>
    <p v-if="error" class="chat-error" role="alert">{{ error }}</p>
    <form class="composer" :class="{ 'has-conversation': turns.length }" @submit.prevent="send()"><label for="chat-question">Your question / Tanong mo</label><textarea id="chat-question" v-model="question" :disabled="busy" maxlength="1200" rows="2" placeholder="May biyahe ba bukas to Calapan?" @keydown.enter.exact.prevent="send()"></textarea><div class="composer-actions"><small><span>{{ question.length }}/1200</span><span class="keyboard-hint">Enter to send · Shift+Enter for a new line</span></small><button :disabled="busy || !question.trim()" type="submit"><span>{{ busy?'Checking…':'Send question' }}</span><ion-icon :icon="sendOutline" aria-hidden="true" /></button></div></form>
    <details class="data-notice"><summary><ion-icon :icon="informationCircleOutline" aria-hidden="true" /> About your data</summary><p>Your question and relevant trip or booking details are sent to Cloudflare AI to prepare a response. Avoid sharing passwords, ID numbers, or payment details.</p></details>
    <p class="assistant-note">AI responses may contain mistakes. Check the verified details below each answer and confirm important travel information with your operator.</p>
  </main><PassengerBottomNav /></ion-content></ion-page>
</template>
<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { IonPage, IonContent, IonIcon, onIonViewDidLeave } from '@ionic/vue';
import { chatbubbleEllipsesOutline, sparklesOutline, shieldCheckmarkOutline, informationCircleOutline, boatOutline, ticketOutline, giftOutline, qrCodeOutline, arrowForwardOutline, sendOutline } from 'ionicons/icons';
import PassengerHeader from '../../components/passenger/PassengerHeader.vue';
import PassengerBottomNav from '../../components/passenger/PassengerBottomNav.vue';
import { askAssistant, type ChatTurn, type ChatReply } from '../../services/chatbot';
const question=ref(''),busy=ref(false),error=ref(''),conversation=ref<HTMLElement>();
const turns=ref<Array<ChatTurn & {reply?:ChatReply}>>([]);
const suggestions=['May biyahe ba today?', 'Paid na ba ang booking ko?', 'Do I have loyalty rewards?', 'Paano gamitin ang QR ticket?'];
const suggestionLabels=['Find a sailing','My booking','Loyalty rewards','Boarding help'];
const suggestionIcons=[boatOutline,ticketOutline,giftOutline,qrCodeOutline];
let generation=0;
async function send(text?:string) {
  const message=(text ?? question.value).trim();if(busy.value || !message || message.length>1200)return;
  if(turns.value.length>=20){turns.value=turns.value.slice(-8);}
  const history=turns.value.map(({role,content})=>({role,content:content.slice(0,2000)}));
  const current=++generation;busy.value=true;error.value='';question.value='';
  turns.value.push({role:'user',content:message});
  try { const reply=await askAssistant(message,history);if(current===generation)turns.value.push({role:'assistant',content:reply.answer,reply}); }
  catch(cause){if(current===generation){error.value=cause instanceof Error?cause.message:'Try again.';question.value=message;turns.value.pop();}}
  finally {if(current===generation){busy.value=false;await nextTick();conversation.value?.lastElementChild?.scrollIntoView({block:'nearest',behavior:'smooth'});}}
}
onIonViewDidLeave(()=>{generation++;busy.value=false;turns.value=[];question.value='';error.value='';});
const sourceTitle=(topic:string)=>({get_sailings:'Verified sailing details',get_my_bookings:'Your booking details',get_my_rewards:'Your loyalty rewards',get_advisories:'Published advisories',get_help:'Travel guide'}[topic] || 'Verified details');
const checkedTime=(value:string)=>new Date(value).toLocaleString('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const labels:Record<string,string>={code:'Trip',reference:'Booking',from:'From',to:'To',origin:'Departure port',destination:'Arrival port',vessel:'Vessel',departureAt:'Departure',arrivalAt:'Arrival',status:'Status',sailingStatus:'Trip status',availableSeats:'Available seats',regularFare:'Regular fare',studentFare:'Student fare',seniorFare:'Senior fare',childFare:'Child fare',pwdFare:'PWD fare',paymentStatus:'Payment',paymentMethod:'Payment method',paymentVerificationRequired:'Payment verification pending',paymentDeadline:'Payment deadline',total:'Total',passengerCount:'Passengers',value:'Voucher amount',expiresAt:'Expiry',title:'Notice',message:'Details',priority:'Priority',category:'Category'};
const fieldLabel=(key:string)=>labels[key] || key;
function fieldValue(key:string,value:string|number|boolean) {
  if(typeof value==='boolean')return value?'Yes':'No';
  if(/At$|Deadline$/.test(key) && typeof value==='string')return `${checkedTime(value)} Philippine time`;
  if(/Fare$/.test(key) || ['total','value'].includes(key))return `₱${Number(value).toLocaleString('en-PH')}`;
  return String(value).replaceAll('_',' ');
}
</script>
<style scoped>
.assistant-page { width: 100%; max-width: 560px; margin: 0 auto; padding: 18px 16px calc(112px + env(safe-area-inset-bottom)); color: var(--ink); }
.back { display: inline-flex; align-items: center; min-height: 44px; margin: 10px 0 4px; color: var(--muted); font-size: 12px; text-decoration: none; }
.back:hover { color: var(--ocean); }
.assistant-intro { padding: 4px 4px 18px; text-align: center; }
.assistant-avatar { position: relative; display: grid; place-items: center; width: 58px; height: 58px; margin: 0 auto 18px; border: 1px solid var(--line); border-radius: 18px; background: var(--light-blue); color: var(--ocean); font-size: 30px; }
.assistant-avatar > span { position: absolute; right: -6px; bottom: -5px; display: grid; place-items: center; width: 24px; height: 24px; border: 3px solid var(--cloud); border-radius: 50%; background: var(--action); color: white; font-size: 12px; }
.eyebrow { margin: 0 0 10px; font-size: 9px; font-weight: 800; letter-spacing: .16em; color: var(--ocean); }
.assistant-intro h1 { margin: 0 0 12px; font-size: clamp(24px, 6vw, 29px); line-height: 1.3; letter-spacing: -.04em; }
.intro-copy { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.8; }
.data-badge { display: inline-flex; align-items: center; gap: 6px; margin-top: 16px; padding: 6px 10px; border-radius: 20px; background: var(--success-soft); color: var(--success); font-size: 10px; font-weight: 600; }
.data-badge ion-icon { font-size: 14px; }
.suggestions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0 0 14px; }
.suggestions button { display: flex; align-items: flex-start; gap: 9px; min-width: 0; padding: 15px 12px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); color: var(--ink); font: inherit; text-align: left; cursor: pointer; transition: border-color .15s, background .15s; }
.suggestions button:hover:not(:disabled) { border-color: var(--ocean); background: var(--light-blue); }
.suggestions button > ion-icon { flex: none; font-size: 19px; color: var(--ocean); margin-top: 1px; }
.suggestions button > span { min-width: 0; }
.suggestions strong { display: block; font-size: 11px; line-height: 1.5; }
.suggestions small { display: block; margin-top: 4px; color: var(--muted); font-size: 10px; line-height: 1.6; }
.suggestions .suggestion-arrow { display: none; }
.data-notice { margin: 12px 0 20px; color: var(--muted); font-size: 10px; line-height: 1.7; }
.data-notice summary { display: flex; justify-content: center; align-items: center; gap: 5px; min-height: 32px; cursor: pointer; list-style: none; }
.data-notice summary::-webkit-details-marker { display: none; }
.data-notice summary ion-icon { font-size: 14px; }
.data-notice p { margin: 8px 0 0; padding: 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); }
.conversation { display: grid; gap: 14px; margin-bottom: 18px; scroll-margin-bottom: 290px; }
.conversation:empty { display: none; margin: 0; }
.chat-turn { padding: 16px; border: 1px solid var(--line); border-radius: 16px 16px 16px 4px; background: var(--surface); min-width: 0; scroll-margin-bottom: 290px; }
.chat-turn.user { margin-left: 32px; border-radius: 16px 16px 4px 16px; background: var(--light-blue); }
.chat-turn > strong { font-size: 10px; color: var(--ocean); }
.chat-turn > p { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13px; line-height: 1.8; margin: 9px 0; }
.source-details { margin-top: 14px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-soft); font-size: 11px; line-height: 1.6; }
.source-details summary { cursor: pointer; min-height: 32px; font-weight: 700; overflow-wrap: anywhere; }
.source-record { padding-top: 8px; border-top: 1px solid var(--line); margin-top: 10px; }
dl { display: grid; grid-template-columns: minmax(85px, 1fr) minmax(0, 1.8fr); gap: 6px 12px; margin: 8px 0; }
dt { color: var(--muted); } dd { margin: 0; overflow-wrap: anywhere; }
.scope { color: var(--muted); }
.answer-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.answer-links a { display: inline-flex; align-items: center; min-height: 44px; padding: 8px 12px; border-radius: 9px; background: var(--light-blue); color: var(--ocean); font-size: 12px; text-decoration: none; }
.composer { position: relative; z-index: 5; padding: 15px; border: 1px solid var(--line); border-radius: 18px; background: var(--surface); box-shadow: 0 6px 28px #071a3018; }
.composer.has-conversation { position: sticky; bottom: calc(80px + env(safe-area-inset-bottom)); }
.composer label { display: block; font-size: 11px; font-weight: 700; margin-bottom: 10px; }
.composer textarea { display: block; box-sizing: border-box; resize: vertical; width: 100%; min-height: 74px; max-height: 180px; padding: 12px; border: 1px solid var(--line); border-radius: 11px; background: var(--surface-soft); color: var(--ink); font: inherit; font-size: 16px; line-height: 1.6; }
.composer textarea::placeholder { color: var(--muted); opacity: .85; }
.composer-actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 12px; }
.composer small { display: grid; gap: 3px; font-size: 9px; color: var(--muted); line-height: 1.5; }
.composer button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; flex-shrink: 0; min-height: 44px; padding: 10px 14px; border: 0; border-radius: 11px; background: var(--action); color: white; font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; }
.composer button ion-icon { font-size: 16px; }
button:disabled { opacity: .55; cursor: default; }
button:focus-visible, a:focus-visible, summary:focus-visible, textarea:focus-visible { outline: 2px solid var(--ocean); outline-offset: 3px; }
.chat-error { padding: 12px; border-radius: 10px; background: var(--danger-soft); color: var(--danger); font-size: 12px; line-height: 1.7; }
.chat-status, .setup-note { font-size: 12px; color: var(--muted); line-height: 1.7; }
.assistant-note { margin: 14px 6px 0; text-align: center; font-size: 10px; line-height: 1.7; color: var(--muted); }
@media (max-width: 360px) { .suggestions button { padding: 12px 10px; gap: 6px; } .suggestions button > ion-icon { font-size: 16px; } .keyboard-hint { display: none; } .composer-actions { gap: 8px; } }
@media (prefers-reduced-motion: reduce) { .suggestions button { transition: none; } }
</style>
