import { beforeEach,describe,expect,it,vi } from 'vitest'
import { confirmAction,requestReason } from '../../src/composables/confirmation'

const mocks=vi.hoisted(()=>({create:vi.fn()}))
vi.mock('@ionic/vue',()=>({alertController:{create:mocks.create}}))
beforeEach(()=>vi.clearAllMocks())
describe('BarkoLink confirmations',()=>{
  it('treats cancellation as no approval and escapes dynamic message content',async()=>{
    mocks.create.mockResolvedValue({present:vi.fn(),onDidDismiss:async()=>({role:'cancel'})})
    expect(await confirmAction({title:'Delete traveler?',message:'Remove <img src=x> & "Juan"?',danger:true})).toBe(false)
    const options=mocks.create.mock.calls[0][0]
    expect(options.message).toBe('Remove &lt;img src=x&gt; &amp; &quot;Juan&quot;?')
    expect(options.cssClass).toContain('destructive-confirmation')
    expect(options.backdropDismiss).toBe(false)
  })
  it('approves only the explicit confirmation button',async()=>{
    mocks.create.mockResolvedValue({present:vi.fn(),onDidDismiss:async()=>({role:'confirm'})})
    expect(await confirmAction({title:'Receive cash?',message:'Confirm PHP 600 received.',confirmText:'Confirm cash received'})).toBe(true)
    expect(mocks.create.mock.calls[0][0].buttons[1].text).toBe('Confirm cash received')
  })
  it('keeps the reason dialog open for invalid input and returns a trimmed valid reason',async()=>{
    const dialog={message:'',present:vi.fn(),onDidDismiss:async()=>({role:'confirm'})}
    mocks.create.mockImplementation(async options=>{
      dialog.present.mockImplementation(async()=>{
        expect(options.buttons[1].handler({reason:' '})).toBe(false)
        expect(dialog.message).toContain('3 to 160 characters')
        expect(options.buttons[1].handler({reason:'  Weather cancellation  '})).toBe(true)
      })
      return dialog
    })
    expect(await requestReason({title:'Cancel sailing?',message:'Explain the reason.'})).toBe('Weather cancellation')
  })
})
