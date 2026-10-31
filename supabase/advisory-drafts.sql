-- Reusable drafts only. Review the wording, audience and Philippine dates before publishing.
-- Stable IDs preserve any later admin edits when this script is run again.
insert into public.travel_advisory(id,title,message,category,priority,sailing_code,starts_at,ends_at,published)
select id::uuid,title,message,category,priority,null,now(),now()+interval '1 day',false
from (values
  ('d620ad00-1031-4000-8000-000000000001','Severe weather travel reminder',
   'Severe weather may affect sailing schedules. Check your trip status before traveling to the port, allow extra time, and follow updates from your ferry operator and terminal staff.', 'WEATHER','HIGH'),
  ('d620ad00-1031-4000-8000-000000000002','Temporary suspension of sailings',
   'Sailings on the affected route are temporarily suspended due to severe weather. Please do not proceed to the boarding area until operations are confirmed to resume. Contact your ferry operator or the ticketing desk for rebooking or refund assistance.', 'WEATHER','HIGH'),
  ('d620ad00-1031-4000-8000-000000000003','Sailing operations have resumed',
   'Sailing operations on the affected route have resumed. Departure times may still change as trips are reorganized. Check your booking and confirm your departure time with the ticketing desk before proceeding to the boarding area.', 'SCHEDULE','MEDIUM'),
  ('d620ad00-1031-4000-8000-000000000004','Departure time adjustment',
   'The departure time of the affected sailing has changed. Please check your booking for the revised schedule and confirm boarding instructions with terminal staff. Contact the ticketing desk if you need assistance with your reservation.', 'SCHEDULE','MEDIUM'),
  ('d620ad00-1031-4000-8000-000000000005','Vessel maintenance update',
   'The affected sailing may be delayed or reassigned while the vessel undergoes maintenance checks. Please wait for the confirmed vessel and departure details from your ferry operator or the ticketing desk before boarding.', 'SCHEDULE','MEDIUM'),
  ('d620ad00-1031-4000-8000-000000000006','Boarding gate or lane change',
   'The boarding gate or lane for the affected sailing has changed. Please follow the updated terminal signs and ask boarding staff to confirm the correct waiting area. Keep your ticket and valid identification ready.', 'PORT','MEDIUM'),
  ('d620ad00-1031-4000-8000-000000000007','Allow extra time during busy travel periods',
   'Expect longer queues and heavier traffic around the terminal during busy travel periods. Allow extra time for ticket verification, security checks and boarding, and follow the arrival time advised by your ferry operator.', 'PORT','LOW'),
  ('d620ad00-1031-4000-8000-000000000008','Keep your ticket and identification ready',
   'Before joining the boarding queue, prepare your ticket or booking reference and valid identification. Passengers using a discounted fare should also prepare the supporting document required for verification.', 'GENERAL','LOW'),
  ('d620ad00-1031-4000-8000-000000000009','Rough sea and passenger safety reminder',
   'Sea conditions may be rough along the affected route. Stay in designated passenger areas, keep walkways clear and follow all instructions from the vessel crew. Inform the crew immediately if you need assistance.', 'SAFETY','HIGH'),
  ('d620ad00-1031-4000-8000-000000000010','Baggage and personal belongings reminder',
   'Keep your baggage within the limits set by your ferry operator. Secure your belongings, keep valuables with you and do not leave bags unattended. Ask terminal staff for assistance with oversized baggage or special handling.', 'SAFETY','LOW')
) drafts(id,title,message,category,priority)
on conflict(id) do nothing;
