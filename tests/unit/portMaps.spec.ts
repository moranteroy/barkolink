import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { googleMapDirections, googleMapEmbed, portCoordinates } from '../../src/data/portMaps'
import PortLocationMap from '../../src/components/shared/PortLocationMap.vue'

vi.mock('@ionic/vue', () => ({ IonIcon: { template: '<span />' } }))
const mocks = vi.hoisted(() => {
  const map = { remove: vi.fn(), invalidateSize: vi.fn(), setView: vi.fn(), fitBounds: vi.fn() };
  const layer = () => { const result = { addTo: vi.fn(), remove: vi.fn(), on: vi.fn(), bindPopup: vi.fn(), openPopup: vi.fn(), redraw: vi.fn() }; for (const key of ['addTo','on','bindPopup'] as const) result[key].mockReturnValue(result); return result; };
  return { map, layer };
});
vi.mock('leaflet', () => ({ map: () => mocks.map, tileLayer: () => mocks.layer(), layerGroup: () => mocks.layer(), marker: () => mocks.layer(), divIcon: vi.fn(), polyline: () => mocks.layer() }));
const ports = [
  { id: 'a', name: 'Batangas Port', city: 'Batangas' },
  { id: 'b', name: 'Calapan Port', city: 'Calapan' },
]
describe('Port map integration', () => {
  it('provides a keyless embed and directions without requesting a current location', () => {
    const embed = new URL(googleMapEmbed(ports[0]))
    expect(embed.hostname).toBe('maps.google.com')
    expect(embed.searchParams.get('output')).toBe('embed')
    expect(embed.searchParams.get('q')).toBe('Batangas Port, Batangas, Philippines')
    const directions = new URL(googleMapDirections(ports[0]))
    expect(directions.searchParams.get('api')).toBe('1')
    expect(directions.searchParams.get('destination')).toContain('Batangas Port')
    expect(directions.searchParams.has('origin')).toBe(false)
  })
  it('uses the Maps Embed API when an optional browser key is provided', () => {
    const embed = new URL(googleMapEmbed(ports[0], 'test-browser-key'))
    expect(embed.pathname).toBe('/maps/embed/v1/place')
    expect(embed.searchParams.get('key')).toBe('test-browser-key')
    expect(embed.searchParams.get('region')).toBe('PH')
  })
  it('encodes port names containing punctuation as one query value', () => {
    const url = new URL(googleMapEmbed({ id: 'x', name: 'Port & Wharf #1', city: 'City' }))
    expect(url.searchParams.get('q')).toBe('Port & Wharf #1, City, Philippines')
    expect([...url.searchParams.keys()].sort()).toEqual(['output', 'q', 'z'])
  })
  it('shows both ports, switches directions and recovers when a port is removed', async () => {
    const wrapper = mount(PortLocationMap, { props: { ports, journey: true } })
    await flushPromises()
    await vi.waitFor(() => expect(mocks.map.fitBounds).toHaveBeenCalledWith([portCoordinates(ports[0]), portCoordinates(ports[1])], expect.any(Object)))
    await wrapper.findAll('.port-tabs button')[1].trigger('click')
    expect(mocks.map.setView).toHaveBeenCalledWith(portCoordinates(ports[1]), 14)
    expect(wrapper.get('.map-footer a').attributes('href')).toContain('Calapan')
    expect(wrapper.findAll('.port-tabs button')[1].attributes('aria-pressed')).toBe('true')
    await wrapper.setProps({ ports: [ports[0]] })
    expect(wrapper.get('.map-footer').text()).toContain('Batangas')
    await wrapper.setProps({ ports: [] })
    expect(wrapper.find('.leaflet-map').exists()).toBe(false)
    expect(mocks.map.remove).toHaveBeenCalled()
    wrapper.unmount()
  })
  it('does not guess a marker from a city or ambiguous terminal name', async () => {
    expect(portCoordinates({id:'x',name:'Another Wharf',city:'Batangas'})).toBeNull()
    expect(portCoordinates({id:'x',name:'Puerto Galera Port',city:'Puerto Galera'})).toBeNull()
    expect(portCoordinates({...ports[0],latitude:91,longitude:121})).toBeNull()
    expect(portCoordinates({...ports[0],latitude:13,longitude:undefined})).toBeNull()
    expect(portCoordinates({...ports[0],latitude:0,longitude:0})).toEqual([0,0])
    const wrapper=mount(PortLocationMap,{props:{ports:[{id:'x',name:'Another Wharf',city:'Batangas'}]}})
    await flushPromises()
    expect(wrapper.get('.map-empty').text()).toContain('not yet available')
    expect(wrapper.get('.map-footer a').attributes('href')).toContain('Another')
    wrapper.unmount()
  })
  it('uses neutral labels for the landing page and admin port directory', async () => {
    const wrapper=mount(PortLocationMap,{props:{ports}})
    await flushPromises()
    expect(wrapper.get('h2').text()).toBe('Find your way to the terminal.')
    expect(wrapper.get('.port-tabs').text()).not.toMatch(/Departure|Arrival/)
    expect(wrapper.get('.map-note').text()).not.toContain('dashed line')
    wrapper.unmount()
  })
})
