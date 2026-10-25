// Read fixture for existing role/screenshot suites. Interactive adjustment tests
// supply their own stateful save handler; this helper never contacts a backend.
export function boardingTimingFixture(sailing) {
  return {timing:{sailingCode:sailing.code || sailing.id,departureAt:sailing.departureAt,
    boardingAt:null,effectiveBoardingAt:new Date(Date.parse(sailing.departureAt)-30*60000).toISOString(),
    boardingTimeSource:'Synthetic operator confirmation',usesOperatorDefault:true,
    updatedAt:'2026-10-24T00:00:00Z',status:sailing.status,
    canEdit:['SCHEDULED','BOARDING'].includes(sailing.status) && Date.parse(sailing.departureAt)>Date.now()}};
}
