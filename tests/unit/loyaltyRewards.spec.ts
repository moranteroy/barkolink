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
  it('shows earned rewards and explains automatic application',async()=>{
    mocks.load.mockResolvedValue({data:{completedTrips:5,tripsPerReward:5,rewardValue:200,tripsToNextReward:5,currentTier:'Silver',tiers:[{name:'Silver',trips:5,value:100},{name:'Gold',trips:10,value:200},{name:'Platinum',trips:15,value:300}],vouchers:[{code:'LOYAL-TEST',value:100,expiresAt:'2027-01-01T00:00:00Z'}]}});
    const copy=vi.fn().mockResolvedValue(undefined);vi.stubGlobal('navigator',{clipboard:{writeText:copy}});
    const wrapper=mount(LoyaltyRewards);await flushPromises();
    expect(wrapper.text()).toContain('₱100 off your next eligible booking');expect(wrapper.text()).toContain('Applies automatically at booking review.');expect(wrapper.text()).toContain('1 reward');
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

});
