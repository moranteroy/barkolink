import assert from 'node:assert/strict';

// Used by both public landing and authenticated Home fixtures.
export async function verifyPassengerCounter(page) {
  const field = page.locator('.passenger-field:visible').first();
  const group = field.getByRole('group', { name: 'Passengers', exact: true });
  const minus = group.getByRole('button', { name: 'Remove passenger', exact: true });
  const plus = group.getByRole('button', { name: 'Add passenger', exact: true });
  const value = group.locator('strong'),
    caption = value.locator('small');
  const original = parseInt(await value.textContent(), 10);
  const number = () => value.evaluate((el) => parseInt(el.textContent, 10));
  const checkLayout = async () => {
    const metrics = await group.evaluate((el) => {
      const box = el.getBoundingClientRect(),
        value = el.querySelector('strong'),
        caption = value.querySelector('small');
      const controls = [...el.querySelectorAll('button')];
      return {
        font: parseFloat(getComputedStyle(value).fontSize),
        captionFont: parseFloat(getComputedStyle(caption).fontSize),
        fits: [value, ...controls].every((child) => {
          const b = child.getBoundingClientRect();
          return (
            b.left >= box.left && b.right <= box.right && b.top >= box.top && b.bottom <= box.bottom
          );
        }),
        captionFits: caption.scrollWidth <= caption.clientWidth,
        buttons: controls.map((child) => ({
          width: child.getBoundingClientRect().width,
          height: child.getBoundingClientRect().height,
        })),
      };
    });
    assert.ok(metrics.font >= 20, 'Passenger number remains readable');
    assert.ok(metrics.fits, 'Counter value and controls fit inside their field');
    assert.ok(
      metrics.buttons.every((b) => b.width >= 44 && b.height >= 44),
      'Counter retains 44px touch targets',
    );
    await field.locator('.field-caption').waitFor({ state: 'visible' });
    if (page.viewportSize().width <= 600)
      assert.equal(
        await caption.isVisible(),
        false,
        'Mobile uses the full Passengers label above the number',
      );
    else {
      assert.equal(await caption.isVisible(), true);
      assert.ok(
        metrics.captionFont >= 12 && metrics.captionFits,
        'Desktop passenger label is readable and unbroken',
      );
    }
  };
  while ((await number()) > 1) await minus.click();
  assert.equal(await minus.isDisabled(), true);
  await checkLayout();
  await plus.click();
  assert.equal(await number(), 2);
  await checkLayout();
  if ([360, 1440].includes(page.viewportSize().width)) {
    while ((await number()) < 8) await plus.click();
    assert.equal(await plus.isDisabled(), true);
    await checkLayout();
    await minus.focus();
    await page.keyboard.press('Enter');
    assert.equal(await number(), 7, 'Keyboard operation decrements the count');
  }
  while ((await number()) > original) await minus.click();
  while ((await number()) < original) await plus.click();
}
