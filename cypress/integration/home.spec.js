describe('Home page', () => {
  context("Roadmap Section", ()=>{
    it('Testing accordion', () => {
      cy.visit('/')
      cy.get('h3').should('have.length', 4)
      cy.get('h3').eq(0).contains('“Celebrity Fanalyzer?”')
      cy.getByData('roadmap').find("h3").contains('Development Roadmap')

      cy.getByData('roadmap').get(".q-expansion-item").eq(0).click()

      cy.getByData('roadmap').get(".q-expansion-item").eq(0).contains("Celebrity Fanalyzer is an iteration engine: give us your feedback! We try to release a new version every month. We are " +
        "particularly interested in how to tweek contributor compensation for participating.")
      //q-expansion-item
    })
  })
  it('Should display properly', () => {
    cy.visit('/')
    cy.get('h2').contains('Welcome to Celebrity Fanalyzer!')
    // cy.get('h3').should('have.length', 3)
    cy.get('h3').eq(0).contains('“Celebrity Fanalyzer?”')
    cy.get('[data-test="roadmap"]').find("h3").contains('Development Roadmap')
  })
})
