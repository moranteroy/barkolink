import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  offerToSaveBookingPassengers,
  type SaveableBookingPassenger,
} from '../../src/composables/bookingPassengerSave';
import type { DatabaseClient } from '../../src/services/database/client';
const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));
vi.mock('../../src/composables/confirmation', () => ({ confirmAction: mocks.confirm }));
vi.mock('../../src/composables/toast', () => ({
  notifyError: mocks.error,
  notifySuccess: mocks.success,
}));
vi.mock('../../src/services/database/experience', () => ({
  savedTravelers: mocks.load,
  saveTraveler: mocks.save,
}));
const client = {} as DatabaseClient;
const passenger = (): SaveableBookingPassenger => ({
  name: 'Ana Santos',
  birthDate: '1990-01-01',
  sex: 'Female',
  phone: '09123456789',
  nationality: 'Filipino',
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.load.mockResolvedValue({ data: { travelers: [] } });
  mocks.save.mockResolvedValue({ data: { id: 'new' } });
  mocks.confirm.mockResolvedValue(true);
});
describe('saving passengers from a booking', () => {
  it('does not prompt for the account passenger and only saves an additional passenger', async () => {
    const owner = { ...passenger(), name: 'Carlo Biado', isAccountPassenger: true };
    const relative = passenger();
    expect(await offerToSaveBookingPassengers(client, [owner], () => true)).toBe(0);
    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(await offerToSaveBookingPassengers(client, [owner, relative], () => true)).toBe(1);
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Would you like to add Ana Santos to your saved passengers for future bookings?',
      }),
    );
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.save.mock.calls[0][1].fullName).toBe('Ana Santos');
  });
  it('saves only after confirmation, maps the saved details and avoids asking again', async () => {
    const person = passenger();
    expect(await offerToSaveBookingPassengers(client, [person], () => true)).toBe(1);
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Would you like to add Ana Santos to your saved passengers for future bookings?',
        cancelText: 'Not now',
      }),
    );
    expect(mocks.save).toHaveBeenCalledWith(client, {
      fullName: 'Ana Santos',
      birthDate: '1990-01-01',
      sex: 'FEMALE',
      phone: '09123456789',
      nationality: 'Filipino',
    });
    await offerToSaveBookingPassengers(client, [person], () => true);
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
  });
  it('lets the user decline without saving or asking again until details change', async () => {
    mocks.confirm.mockResolvedValue(false);
    const person = passenger();
    expect(await offerToSaveBookingPassengers(client, [person], () => true)).toBe(0);
    await offerToSaveBookingPassengers(client, [person], () => true);
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(mocks.save).not.toHaveBeenCalled();
    person.name = 'Maria Santos';
    await offerToSaveBookingPassengers(client, [person], () => true);
    expect(mocks.confirm).toHaveBeenCalledTimes(2);
  });
  it('does not duplicate an existing saved passenger', async () => {
    mocks.load.mockResolvedValue({
      data: {
        travelers: [
          {
            fullName: '  ANA   SANTOS ',
            birthDate: '1990-01-01',
            sex: 'FEMALE',
            phone: '0912 345 6789',
            nationality: 'Filipino',
          },
        ],
      },
    });
    await offerToSaveBookingPassengers(client, [passenger()], () => true);
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('keeps booking available on save failure and allows a later retry', async () => {
    mocks.save.mockRejectedValueOnce(new Error('Unavailable'));
    const person = passenger();
    expect(await offerToSaveBookingPassengers(client, [person], () => true)).toBe(0);
    expect(person.savedPassengerDecision).toBeUndefined();
    expect(mocks.error).toHaveBeenCalled();
    expect(await offerToSaveBookingPassengers(client, [person], () => true)).toBe(1);
  });
  it('does not save after an account or trip changes while confirmation is open', async () => {
    let current = true;
    mocks.confirm.mockImplementation(async () => {
      current = false;
      return true;
    });
    await offerToSaveBookingPassengers(client, [passenger()], () => current);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('does not guess a saved sex value for Prefer not to say', async () => {
    await offerToSaveBookingPassengers(
      client,
      [{ ...passenger(), sex: 'Prefer not to say' }],
      () => true,
    );
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
