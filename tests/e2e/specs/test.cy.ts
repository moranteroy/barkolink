describe('Supabase account navigation', () => {
  beforeEach(() => { cy.clearLocalStorage() })

  it('shows sign-in and registration forms', () => {
    cy.visit('/login')
    cy.contains('Welcome back')
    cy.get('input[type="email"]').should('be.visible')
    cy.get('input[name="password"]').should('be.visible')
    cy.visit('/register')
    cy.get('input[name="name"]').should('be.visible')
    cy.get('input[name="confirm-password"]').should('be.visible')
  })

  it('requires a session for passenger and staff workspaces', () => {
    for (const route of ['/home', '/admin', '/staff/ticketing', '/staff/boarding']) {
      cy.visit(route)
      cy.location('pathname').should('eq', '/login')
    }
  })

  it('provides the password recovery screen', () => {
    cy.visit('/reset-password')
    cy.contains('Set a new password')
    cy.get('input[autocomplete="new-password"]').should('have.length', 2)
  })
})
