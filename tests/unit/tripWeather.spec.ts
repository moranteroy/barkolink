import { mount,flushPromises } from '@vue/test-utils';
import { beforeEach,describe,expect,it,vi } from 'vitest';
import TripWeather from '../../src/components/shared/TripWeather.vue';
const mocks=vi.hoisted(()=>({load:vi.fn()}));
vi.mock('../../src/services/weather',()=>({tripWeather:mocks.load}));
vi.mock('@ionic/vue',()=>({IonIcon:{template:'<span />'}}));
const reading={at:'2026-10-07T12:00:00Z',condition:'Light rain',temperatureC:29,windKph:18,visibilityKm:9,rainChance:75};
const fixture={configured:true,departureAt:'2026-10-08T04:16:00Z',ports:[{id:'port',name:'Batangas Port',role:'Departure port',available:true,current:reading,forecast:reading}]};
beforeEach(()=>vi.clearAllMocks());
describe('trip weather display',()=>{
  it('distinguishes the departure forecast from current conditions and credits the provider',async()=>{
    mocks.load.mockResolvedValue(fixture);
    const wrapper=mount(TripWeather,{props:{sailingCode:'TRIP-1'}});await flushPromises();
    expect(wrapper.text()).toContain('Forecast at departure');
    expect(wrapper.text()).toContain('75%');
    expect(wrapper.text()).toContain('Powered by WeatherAPI.com');
    expect(wrapper.text()).toContain('They do not confirm sailing safety');
    wrapper.unmount();
  });
  it('does not invent a departure forecast for a sailing outside the forecast window',async()=>{
    mocks.load.mockResolvedValue({...fixture,ports:[{...fixture.ports[0],forecast:null,stale:true}]});
    const wrapper=mount(TripWeather,{props:{sailingCode:'TRIP-1'}});await flushPromises();
    expect(wrapper.text()).toContain('Current weather');
    expect(wrapper.text()).toContain('Departure forecast is not available yet');
    expect(wrapper.text()).toContain('update delayed');
    wrapper.unmount();
  });
  it('shows an unavailable state without measurements when the API key is not configured',async()=>{
    mocks.load.mockResolvedValue({configured:false,ports:[]});
    const wrapper=mount(TripWeather,{props:{sailingCode:'TRIP-1'}});await flushPromises();
    expect(wrapper.text()).toContain('Weather updates are currently unavailable');
    expect(wrapper.find('dl').exists()).toBe(false);
    wrapper.unmount();
  });
  it('ignores an older trip response after the user changes sailing',async()=>{
    let resolve!:(data:unknown)=>void;
    mocks.load.mockReturnValueOnce(new Promise(done=>{resolve=done})).mockResolvedValueOnce({configured:false,ports:[]});
    const wrapper=mount(TripWeather,{props:{sailingCode:'TRIP-1'}});
    await wrapper.setProps({sailingCode:'TRIP-2'});await flushPromises();
    resolve(fixture);await flushPromises();
    expect(wrapper.text()).not.toContain('Batangas Port');
    expect(wrapper.text()).toContain('currently unavailable');
    wrapper.unmount();
  });
});
