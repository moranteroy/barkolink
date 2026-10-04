describe('Passenger to operations prototype flow', () => {
  beforeEach(() => {
    cy.visit('/home')
    cy.clearLocalStorage()
    cy.reload()
  })

  it('creates a reservation, issues its ticket, and checks a passenger in for boarding', () => {
    cy.visit('/home')
    cy.contains('Find your next ferry')
    cy.contains('Search sailings').click()
    cy.contains('AVAILABLE SAILINGS')
    cy.contains('Book this sailing').first().click()

    cy.url().should('include', '/trip-details')
    cy.get('ion-button.continue').click()
    cy.url().should('include', '/passenger-info')

    cy.get('.passenger-card').each(($card, index) => {
      cy.wrap($card).find('input').eq(0).type(index === 0 ? 'Juan Test' : 'Maria Test')
      cy.wrap($card).find('select').eq(0).select('Regular')
      cy.wrap($card).find('input[type="date"]').type('1990-01-01')
      cy.wrap($card).find('select').eq(1).select('Male')
      cy.wrap($card).find('input[type="tel"]').type('09171234567')
      cy.wrap($card).find('input').last().type('Filipino')
    })
    cy.contains('Review booking').click()
    cy.url().should('include', '/booking-summary')
    cy.contains('Confirm reservation').click()
    cy.contains('Your trip is booked.')

    cy.get('.reference strong').invoke('text').then(reference => {
      cy.visit('/staff/ticketing')
      cy.contains('.queue-item', 'Juan Test').should('contain', reference.trim())
      cy.contains('.queue-item', 'Juan Test').find('.queue-update').click()
      cy.contains('.queue-item', 'Juan Test').should('contain', 'ISSUED')

      cy.visit('/admin/bookings')
      cy.contains('Booking management')
      cy.contains('td', reference.trim()).should('exist')
      cy.contains('td', 'Juan Test').should('exist')

      cy.visit('/staff/boarding')
      cy.contains('.queue-item', 'Juan Test').find('.queue-update').click()
      cy.contains('.queue-item', 'Juan Test').should('contain', 'CHECKED-IN')
      cy.contains('.queue-item', 'Juan Test').find('.queue-update').click()
      cy.contains('.queue-item', 'Juan Test').should('contain', 'BOARDED')
    })
  })
})
