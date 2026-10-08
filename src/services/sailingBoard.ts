import { executeDatabase, type DatabaseClient } from './database/client';
export type BoardSailing = {
  code: string; departureAt: string; arrivalAt: string; status: string;
  origin: { id: string; name: string; city: string };
  destination: { id: string; name: string; city: string };
  vessel: { name: string };
};
export type SailingBoardData = { date: string; updatedAt: string; sailings: BoardSailing[] };
export function passengerSailingBoard(client: DatabaseClient) {
  return executeDatabase<SailingBoardData>(client, 'PassengerSailingBoard', {});
}
