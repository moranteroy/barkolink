import { describe, expect, it } from 'vitest'
import { auditChanges, auditAction } from '../../src/data/auditPresentation'
describe('readable audit details',()=>{
  it('explains status transitions and formats operational amounts and deadlines',()=>{
    expect(auditChanges({ status:{after:'COMPLETED',before:'BOARDING'}, regular_fare:{before:500,after:600}, reservationMinutes:{before:1440,after:720}, studentDiscount:{before:20,after:25} })).toEqual([
      {label:'Status',text:'Changed from Boarding to Completed'},
      {label:'Regular fare',text:'Changed from PHP 500.00 to PHP 600.00'},
      {label:'Time allowed for payment',text:'Changed from 24 hours to 12 hours'},
      {label:'Student discount',text:'Changed from 20% to 25%'},
    ])
  })
  it('handles added and cleared values, booleans, and Manila dates',()=>{
    expect(auditChanges({isActive:{before:true,after:false},refundNote:{before:'Refund at counter',after:null},departureAt:{before:null,after:'2026-10-05T01:00:00Z'}})).toEqual([
      {label:'Active',text:'Changed from Yes to No'},
      {label:'Refund reason',text:'Cleared (previously Refund at counter)'},
      {label:'Departure',text:'Set to Oct 5, 2026, 9:00 AM'},
    ])
  })
  it('keeps nested details and plain text readable without serializing JSON',()=>{
    expect(auditChanges({ seats:{released:2}, note:'Keep BOARDING open', routes:['Calapan','Batangas'], amount:0 })).toEqual([
      {label:'Seats · Released',text:'2'}, {label:'Note',text:'Keep BOARDING open'},
      {label:'Routes',text:'Calapan; Batangas'}, {label:'Amount',text:'PHP 0.00'},
    ])
    expect(auditChanges(null)).toEqual([])
    expect(auditAction('UPDATE')).toBe('Updated')
  })
})
