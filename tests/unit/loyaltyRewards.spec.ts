import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoyaltyRewards from '../../src/components/passenger/LoyaltyRewards.vue';
import {clearToasts,toastMessages} from '../../src/composables/toast';
const mocks=vi.hoisted(()=>({load:vi.fn()}));
vi.mock('../../src/services/vouchers',()=>({myLoyalty:mocks.load}));
vi.mock('../../src/services/session',()=>({database:{}}));
vi.mock('@ionic/vue',()=>({IonIcon:{template:'<span />'}}));
describe('passenger loyalty reward display',()=>{
  beforeEach(()=>clearToasts());
  afterEach(()=>vi.unstubAllGlobals());
  it('shows earned reward codes without claiming they apply automatically',async()=>{
    mocks.load.mockResolvedValue({data:{completedTrips:5,tripsPerReward:5,rewardValue:200,tripsToNextReward:5,currentTier:'Silver',tiers:[{name:'Silver',trips:5,value:100},{name:'Gold',trips:10,value:200},{name:'Platinum',trips:15,value:300}],vouchers:[{code:'LOYAL-TEST',value:100,expiresAt:'2027-01-01T00:00:00Z'}]}});
    const copy=vi.fn().mockResolvedValue(undefined);vi.stubGlobal('navigator',{clipboard:{writeText:copy}});
    const wrapper=mount(LoyaltyRewards);await flushPromises();
    expect(wrapper.text()).toContain('₱100 off your next eligible booking');expect(wrapper.text()).not.toContain('automatically at booking review');expect(wrapper.text()).toContain('1 reward');
    expect(wrapper.find('.reward-code code').text()).toBe('LOYAL-TEST');
    await wrapper.find('.reward-code button').trigger('click');await flushPromises();
    expect(copy).toHaveBeenCalledWith('LOYAL-TEST');expect(toastMessages.value.some(t=>t.message==='Loyalty voucher code copied.')).toBe(true);
    expect(wrapper.findAll('.reward-tiers > div')).toHaveLength(3);expect(wrapper.findAll('.reward-tiers .reached')).toHaveLength(1);
    expect(wrapper.find('progress').attributes('value')).toBe('0');wrapper.unmount();
  });
  it('shows progress and reloads when returning to Home',async()=>{
    mocks.load.mockResolvedValue({data:{completedTrips:3,tripsPerReward:5,rewardValue:100,tripsToNextReward:2,currentTier:'Getting started',tiers:[],vouchers:[]}});
    const wrapper=mount(LoyaltyRewards,{props:{active:false}});await flushPromises();
    await wrapper.setProps({active:true});await flushPromises();
    expect(wrapper.text()).toContain('2 more trips to unlock');expect(wrapper.find('.reward-amount').text()).toContain('₱100');expect(wrapper.find('progress').attributes('value')).toBe('3');wrapper.unmount();
  });
  it('retains a selectable code and explains a clipboard failure',async()=>{
    mocks.load.mockResolvedValue({data:{completedTrips:10,tripsPerReward:5,rewardValue:300,tripsToNextReward:5,currentTier:'Gold',tiers:[],vouchers:[{code:'GOLD-DEMO',value:200,expiresAt:'2027-01-29T00:00:00Z'}]}});
    vi.stubGlobal('navigator',{clipboard:{writeText:vi.fn().mockRejectedValue(new Error('Denied'))}});
    const wrapper=mount(LoyaltyRewards);await flushPromises();
    await wrapper.find('.reward-code button').trigger('click');await flushPromises();
    expect(wrapper.find('.reward-code code').text()).toBe('GOLD-DEMO');
    expect(toastMessages.value.some(t=>t.title==='Copy unavailable'&&t.message.includes('copy it manually'))).toBe(true);wrapper.unmount();
  });

  it('shows Claimed from actual voucher use and Ready to use for an unused earned reward',async()=>{
    const tiers=[{name:'Silver',trips:5,value:100},{name:'Gold',trips:10,value:200},{name:'Platinum',trips:15,value:300}];
    const usage=(rewardNumber:number,readyCount=0,usedCount=0)=>({rewardNumber,readyCount,usedCount,expiredCount:0,unavailableCount:0,pendingCount:0});
    mocks.load.mockResolvedValue({data:{completedTrips:10,tripsPerReward:5,rewardValue:300,tripsToNextReward:5,currentTier:'Gold',tiers,vouchers:[],milestones:[usage(1,0,1),usage(2,1),usage(3)]}});
    const wrapper=mount(LoyaltyRewards);await flushPromises();
    expect(wrapper.find('[data-tier="silver"] .milestone-state').text()).toBe('Claimed');
    expect(wrapper.find('[data-tier="gold"] .milestone-state').text()).toBe('Ready to use');
    expect(wrapper.find('[data-tier="platinum"] .milestone-state').text()).toBe('Up next');
    expect(wrapper.find('.reward-tiers button').exists()).toBe(false);
    wrapper.unmount();
  });

  it('does not treat expired, paused, or future rewards as Claimed',async()=>{
    mocks.load.mockResolvedValue({data:{completedTrips:15,tripsPerReward:5,rewardValue:300,tripsToNextReward:5,currentTier:'Platinum',tiers:[{name:'Silver',trips:5,value:100},{name:'Gold',trips:10,value:200},{name:'Platinum',trips:15,value:300}],vouchers:[],milestones:[
      {rewardNumber:1,readyCount:0,usedCount:0,expiredCount:1,unavailableCount:0,pendingCount:0},
      {rewardNumber:2,readyCount:0,usedCount:0,expiredCount:0,unavailableCount:1,pendingCount:0},
      {rewardNumber:3,readyCount:0,usedCount:0,expiredCount:0,unavailableCount:0,pendingCount:1},
    ]}});
    const wrapper=mount(LoyaltyRewards);await flushPromises();
    expect(wrapper.findAll('.milestone-state').map(el=>el.text())).toEqual(['Expired','Unavailable','Not yet valid']);
    wrapper.unmount();
  });

  it('keeps recurring Platinum rewards available while retaining its claimed count after a reload',async()=>{
    const result={completedTrips:20,tripsPerReward:5,rewardValue:300,tripsToNextReward:5,currentTier:'Platinum',tiers:[{name:'Silver',trips:5,value:100},{name:'Gold',trips:10,value:200},{name:'Platinum',trips:15,value:300}],vouchers:[],milestones:[{rewardNumber:3,readyCount:1,usedCount:2,expiredCount:0,unavailableCount:0,pendingCount:0}]};
    mocks.load.mockResolvedValue({data:result});
    const wrapper=mount(LoyaltyRewards);await flushPromises();
    expect(wrapper.find('[data-tier="platinum"] .milestone-state').text()).toBe('Ready to use');
    expect(wrapper.find('.milestone-detail').text()).toBe('2 claimed');
    await wrapper.setProps({active:false});
    mocks.load.mockResolvedValue({data:{...result,milestones:[{...result.milestones[0],readyCount:0,usedCount:3}]}});
    await wrapper.setProps({active:true});await flushPromises();
    expect(wrapper.find('[data-tier="platinum"] .milestone-state').text()).toBe('Claimed');
    wrapper.unmount();
  });

});
