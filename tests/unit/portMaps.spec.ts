import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { googleMapDirections, googleMapEmbed } from '../../src/data/portMaps'
import PortLocationMap from '../../src/components/shared/PortLocationMap.vue'

vi.mock('@ionic/vue', () => ({ IonIcon: { template: '<span />' } }))
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
  it('switches the map and directions together and recovers when a port is removed', async () => {
    const wrapper = mount(PortLocationMap, { props: { ports } })
    expect(wrapper.get('iframe').attributes('title')).toContain('Batangas')
    await wrapper.findAll('.port-tabs button')[1].trigger('click')
    expect(wrapper.get('iframe').attributes('src')).toContain('Calapan')
    expect(wrapper.get('.map-footer a').attributes('href')).toContain('Calapan')
    expect(wrapper.findAll('.port-tabs button')[1].attributes('aria-pressed')).toBe('true')
    await wrapper.setProps({ ports: [ports[0]] })
    expect(wrapper.get('iframe').attributes('title')).toContain('Batangas')
    await wrapper.setProps({ ports: [] })
    expect(wrapper.find('iframe').exists()).toBe(false)
    wrapper.unmount()
  })
})
