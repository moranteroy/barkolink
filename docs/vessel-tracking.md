# Automatic vessel tracking

Fleet setup > Vessels shows automatic estimated locations from saved actual trips. Before the first departure the vessel is expected at its origin; between departure and arrival it is expected underway; at scheduled arrival it is expected at the destination. With no saved trip or manual observation, the location stays unknown. Daily schedule templates do not identify a vessel location until an actual trip is created.

The panel refreshes every 30 seconds and when the tab becomes visible. Five vessels appear per page with search and pagination. Failed refreshes retain the last received locations and show an updates-delayed notice. Refreshes pause while editing a correction and stop when the panel unmounts.

Routine tracking and passenger/walk-in booking availability do not require a manual port confirmation. Booking checks use the saved itinerary, exclude the trip being evaluated from already-underway checks, and reject incompatible, delayed, or disconnected voyages. Cancelled trips do not move a vessel. A cancelled-only itinerary stays unknown; when other trips remain, their itinerary supplies the estimate. Existing reservations and tickets are retained.

The collapsed **Correct a location (optional)** section records an actual port for an unscheduled transfer or a reported timetable discrepancy. Corrections take precedence over earlier voyages, then automatic tracking follows subsequent departures. Corrections require an active vessel and port, a note, and a nonfuture observation within 24 hours; they remain audited and private. Revised departure/arrival times should be recorded on delayed trips.

Expected positions are schedule estimates, not GPS or proof of actual departure/arrival. They are never saved as terminal observations. A Completed status does not independently establish an actual arrival.

Migrations `044_automatic_vessel_tracking.sql` and `045_schedule_based_vessel_positions.sql` provide the display feed and automatic itinerary-based availability. Deployment scripts preserve operational records and accounts transactionally, back up affected functions, and save verification receipts in ignored `.audit/`.
