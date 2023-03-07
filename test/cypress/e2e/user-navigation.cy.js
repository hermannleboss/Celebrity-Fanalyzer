describe('User Navigation', () => {
  it.only('Should display properly and navigate between pages', () => {
    cy.visit('/')
    cy.getByData('month-link').click()
    cy.location("pathname").should(
      "eq",
      "/month"
    )

    cy.getByData('main-menu').find("a").eq(0).click()
    cy.location("pathname").should(
      "eq",
      "/"
    )

    cy.getByData('main-menu').find("a").eq(2).click()
    cy.location("pathname").should(
      "eq",
      "/month"
    )
    cy.get("h2").contains("Entries")

    // cy.getByData('main-menu').find("a").eq(1).click()
    // cy.location("pathname").should(
    //   "eq",
    //   "/search"
    // )
    //
    // cy.getByData('main-menu').find("a").eq(3).click()
    // cy.location("pathname").should(
    //   "eq",
    //   "/profile"
    // )
    // cy.get("h1").contains("You are not logged in.")
  })
})
