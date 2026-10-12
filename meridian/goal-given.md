ive created a branch in the repo called meridian-commerce-os, lets pull it and work on it and then run the harness with the goal being:

 # GOAL: Build Meridian Commerce OS

## 1. Mission

Autonomously design, implement, test, and polish Meridian Commerce OS, a premium, production-quality commerce application consisting of two interconnected experiences:

1. Meridian Store: a beautiful, fully interactive customer-facing e-commerce storefront.
2. Meridian Studio: a sophisticated merchant operations platform for managing the catalog, inventory, merchandising, customers, and demo orders.

Data must come from https://dummyjson.com/docs wherever the API provides the appropriate resource.

The final application must look and behave like a professionally designed commercial software product, not a tutorial, wireframe, generic dashboard, collection of API examples, or CRUD demonstration.

The primary objective is exceptional UI/UX combined with functional, maintainable engineering.

Work autonomously until the acceptance criteria are satisfied. Do not stop after analyzing the repository, producing a plan, creating the design system, or scaffolding the application. Implement the complete application, execute the available validation commands, inspect the running UI, fix the discovered problems, and repeat until the required quality gates pass.

Do not ask for clarification unless an actual external blocker makes progress impossible. Make reasonable engineering decisions independently.

## 2. Product Vision

Create a distinctive commerce platform under the brand Meridian.

The visual identity should combine the sophistication of a premium contemporary retailer with the operational clarity of excellent enterprise software.

The customer experience should feel editorial, immersive, and effortless.

The merchant experience should feel precise, information-rich, responsive, and powerful.

Both applications must share a consistent visual identity while using layouts optimized for their different purposes.

The product should communicate quality immediately through typography, imagery, spacing, composition, interaction design, and attention to small details.

Avoid the appearance of a template-based admin dashboard or an automatically generated storefront.

## 3. Autonomous Execution Rules

Before changing anything:

1. Inspect the repository, package manager, existing architecture, dependencies, scripts, tests, and available development tools.
2. Identify the framework, conventions, and infrastructure already established by the repository.
3. Read the relevant DummyJSON documentation and verify the actual API responses, available fields, supported parameters, and mutation behavior.
4. Establish a concise implementation plan in the harness's existing task system, organized around independently verifiable milestones.
5. Establish the UI Engineering Constitution described below.

If an application already exists, extend it while preserving working functionality. Do not replace established architecture without a compelling technical reason.

If the repository is empty, establish a complete application with a maintainable architecture and pinned, mutually compatible dependencies.

Use the existing package manager and lockfile. Do not introduce unnecessary dependencies or perform unrelated upgrades.

Do not create excessive planning documents. Keep planning proportional to the task and use the harness's existing orchestration, task tracking, and reporting mechanisms whenever possible.

After planning, begin implementation immediately.

Operate in a build-review-test-fix loop. A phase is not complete merely because its code has been written.

Maintain working software throughout implementation.

Do not leave primary features as placeholders, dead buttons, fake API integrations, incomplete routes, or TODO comments.

If a preferred implementation is blocked, implement the best functional alternative and document the limitation. Do not abandon the entire task because one dependency or external service is unavailable.

## 4. Technical Architecture

Preserve the repository's existing stack when appropriate.

For a new application, use these defaults:

* Framework: Next.js App Router.
* Language: TypeScript with strict checking.
* UI: React and Tailwind CSS.
* Components: shadcn/ui where appropriate, supplemented by purpose-built components.
* Icons: Lucide React.
* Remote data: TanStack Query.
* Client-side application state: Zustand.
* Forms and validation: React Hook Form and Zod.
* Charts: Recharts where charts improve decision-making.
* Unit and component testing: Vitest and React Testing Library.
* End-to-end testing: Playwright.

Use compatible stable dependency versions available in the environment.

Use server and client components appropriately. Keep remote data access, domain logic, UI components, and application state separated.

Establish a typed API service layer, a clear domain model, reusable design-system components, centralized error handling, and predictable state transitions.

Use Zod for important runtime validation boundaries.

Avoid giant components, duplicated business logic, excessive prop drilling, unnecessary client components, and tightly coupled page implementations.

Recommended organization:

* `app/`: routes, layouts, and page composition.
* `components/`: shared interface components.
* `components/ui/`: reusable primitives.
* `features/storefront/`: customer-facing features.
* `features/merchant/`: merchant workspace.
* `lib/api/`: API clients, queries, and response validation.
* `lib/domain/`: pricing, inventory, cart, and order calculations.
* `lib/state/`: persistent client-side state.
* `lib/validation/`: reusable schemas.
* `lib/utils/`: shared utilities.
* `tests/`: automated unit, integration, and end-to-end tests.

Adapt this structure to the existing repository rather than enforcing it unnecessarily.

## 5. UI Engineering Constitution — Binding Requirements

These rules apply to every route, component, and interaction.

### 5.1 Establish a coherent design system

Define design tokens for:

* Colors and semantic states.
* Typography and type scales.
* Spacing and layout.
* Content widths and grids.
* Borders and radii.
* Shadows, where appropriate.
* Interaction states.
* Responsive breakpoints.
* Transitions and animation durations.

Use a distinctive editorial-retail direction: warm neutral surfaces, confident dark typography, restrained accent colors, deliberate whitespace, subtle borders, and strong product photography.

Use the actual imagery supplied by DummyJSON where appropriate.

The storefront should prioritize visual storytelling. The merchant workspace should prioritize clarity, density, and rapid task completion.

Do not use gradients, glassmorphism, shadows, rounded cards, or decorative elements indiscriminately. Every visual decision must support the hierarchy or experience.

Do not produce pages that merely rearrange the same generic cards.

### 5.2 Design every state

Every significant feature must account for:

* Initial loading.
* Loading with existing content visible.
* Empty results.
* API failure.
* Retry behavior.
* Invalid input.
* Successful completion.
* Destructive actions.
* Pending mutations.
* Confirmation and recovery.
* Mobile interaction.

Skeletons should reflect the actual shape of the content they replace.

Empty states must explain what happened and provide a useful next action.

Errors must be understandable and recoverable.

Do not allow undefined values, broken images, NaN calculations, or unhandled network errors to become visible interface defects.

### 5.3 Interactions must be real

All visible controls must work.

Search must search.

Filters must filter.

Sorting must reorder results.

Pagination must change results.

Forms must validate and submit.

Drawers and dialogs must open and close correctly.

Cart controls must update quantities and totals.

Merchant actions must update the appropriate application state.

Feedback must reflect actual success or failure.

Do not simulate functionality using controls that merely look interactive.

If a feature is genuinely unavailable, communicate that limitation clearly instead of misleading the user.

### 5.4 Accessibility

Use semantic HTML and accessible controls.

Support keyboard navigation, visible focus indicators, appropriate labels, meaningful alternative text, accessible dialogs, and correct ARIA attributes.

Maintain readable contrast and comfortable target sizes.

Respect reduced-motion preferences.

Treat accessibility as a design requirement, not a final checklist.

### 5.5 Responsive behavior

Design for desktop, tablet, and mobile rather than compressing the desktop interface.

Validate at approximately:

* 1440px desktop.
* 1024px compact desktop or large tablet.
* 768px tablet.
* 390px mobile.
* 320px narrow mobile.

The storefront should retain its visual appeal on mobile.

Merchant tables should become usable compact views, controlled horizontal scrollers, or appropriate mobile layouts instead of causing page-wide horizontal overflow.

Navigation, drawers, product galleries, forms, filters, and dialogs must remain usable at narrow widths.

### 5.6 Mandatory UI quality gate

After implementing each major route:

1. Run the application.
2. Inspect the route at desktop and mobile sizes.
3. Exercise its primary interactions.
4. Capture screenshots when browser tooling is available.
5. Evaluate the implementation for visual hierarchy, consistency, usability, accessibility, responsiveness, and completeness.
6. Identify defects and implement fixes before considering the route complete.

Score each dimension from 1 to 10.

Dimensions:

* Visual hierarchy and composition.
* Typography and spacing.
* Product presentation and image quality.
* Interaction quality and feedback.
* Information architecture.
* Responsiveness.
* Accessibility.
* Consistency with the design system.

Target an overall score of at least 9/10, with no individual dimension below 8/10.

Scores must be justified by actual inspection, not assumed from successful compilation.

Continue the review-and-improve cycle until the target is met or a genuine environmental limitation is documented.

Treat this quality gate as binding.

## 6. DummyJSON Integration

Use https://dummyjson.com/docs as the authoritative reference.

Investigate the documentation before deciding how each feature should work.

Relevant resources include:

* Products.
* Product categories.
* Users.
* Authentication.
* Carts.
* Posts or comments if they provide useful secondary functionality.

Products are the primary domain resource.

Use the API's supported capabilities for retrieving, searching, sorting, and selecting appropriate records.

Use pagination and caching where appropriate. Avoid unnecessary requests and duplicate fetches.

Use API response types based on verified payloads. Do not invent API fields or endpoints.

Centralize network access so API behavior can be tested independently of the interface.

Handle network failures, non-success responses, malformed data, and missing records gracefully.

When possible, retain useful cached content during refetching.

### Critical data integrity rules

DummyJSON is a mock API, not a persistent production commerce backend.

Its simulated mutations must not be mistaken for durable server-side changes.

Implement a clear client-side persistence strategy for application-created and application-edited data.

Persist appropriate demo state across page refreshes, including:

* Cart contents.
* Wishlist.
* Local product changes.
* Locally created products.
* Local merchandising configuration.
* Demo orders.
* Relevant user preferences.

Use localStorage or another suitable existing client-side persistence mechanism.

Account for hydration and browser-only access in Next.js.

Do not overwrite valid API products with incomplete local copies. Use a predictable override or reconciliation strategy that merges local changes with the latest API data.

Handle storage failures without crashing the application.

Clearly distinguish remote sample data from local application state.

Where the API provides no order-management functionality, maintain orders within the application.

Never claim that local changes have been saved to DummyJSON.

## 7. Experience A: Meridian Store

Create a complete customer-facing storefront.

### 7.1 Homepage

Build an excellent editorial landing page containing:

* Premium brand header and navigation.
* A distinctive hero composition.
* Featured products and collections.
* Category discovery.
* Curated product sections.
* Promotional or editorial content based on real product data.
* Responsive product cards.
* A polished footer.

The page must have a strong visual identity and meaningful hierarchy.

Avoid generic hero layouts with oversized headings above an ordinary grid.

Use real product images and actual data wherever appropriate.

Make primary calls to action functional.

### 7.2 Product discovery

Create a catalog page with:

* Product search.
* Search suggestions or another useful autocomplete experience.
* Category navigation.
* Relevant filters.
* Price-range filtering.
* Minimum-rating filtering where useful.
* Discount and availability filters based on real product fields.
* Sorting by supported attributes.
* Pagination or a well-designed load-more experience.
* Product count and active-filter indicators.
* A way to clear filters.
* Responsive filter controls.
* Loading, empty, and error states.

Use the available API features where appropriate, but ensure filter combinations behave consistently.

Product images should use sensible sizing and cropping, with appropriate fallbacks.

Avoid unnecessary layout shifts while images load.

### 7.3 Product detail

Each product detail page must include:

* Product image gallery.
* Product title and category.
* Price and discount presentation.
* Rating and available review information.
* Stock availability.
* Description.
* Relevant specifications.
* Quantity controls.
* Add-to-cart interaction.
* Wishlist interaction.
* Related products based on available data.
* Clear feedback after user actions.

Validate product IDs and provide a proper not-found experience.

Use real data rather than hardcoded product details.

### 7.4 Cart

Implement a persistent shopping cart with:

* Add and remove operations.
* Quantity updates.
* Immediate feedback.
* Subtotals.
* Discount calculations.
* Clearly explained shipping and tax estimates.
* Order total.
* Empty-cart state.
* Cross-route state consistency.

Prevent invalid quantities and handle unavailable or modified products sensibly.

All calculations must use shared domain logic rather than duplicated component-level arithmetic.

Use a deliberate money-formatting and rounding strategy.

Cart state must survive a page refresh.

### 7.5 Checkout

Implement a complete demo checkout flow.

Include:

1. Customer information.
2. Shipping information.
3. Delivery selection.
4. Order review.
5. Confirmation.

Use validated forms with useful error messages.

Make progression between steps reliable.

Allow users to return to previous steps without losing entered information.

Display accurate totals based on the current cart and the application's documented demo pricing rules.

Do not integrate a real payment processor or collect real payment-card information.

Payment or payment-method selection, if implemented, must be explicitly simulated.

Submitting a valid checkout must create an application-managed demo order, clear the completed cart, and display an order confirmation with a unique identifier.

Persist demo orders locally.

Prevent duplicate order creation from repeated submissions.

Clearly label the entire flow as a demonstration rather than a real purchase.

### 7.6 Customer account

Provide a useful account experience with:

* Profile information when available.
* Order history from locally created demo orders.
* Order detail views.
* Saved products.
* Relevant account settings.

Implement DummyJSON authentication using its documented interface if practical within the existing architecture.

If authentication is unavailable, permit a clearly identified guest experience.

Do not claim that mock authentication provides production-grade security.

Do not invent a working password-reset or account-registration backend if the API does not support it.

### 7.7 Storefront quality

The storefront must feel cohesive from discovery through order confirmation.

Use persistent navigation where appropriate, informative feedback, subtle transitions, thoughtful mobile behavior, and consistent spacing.

No dead ends. No broken links. No placeholder content that looks unfinished.

## 8. Experience B: Meridian Studio

Create a merchant workspace that shares the Meridian identity but has a distinct information architecture.

Suggested entry point: `/studio`.

Provide clear navigation and a useful page structure for the merchant's daily operations.

### 8.1 Overview dashboard

Show meaningful metrics derived from the available sample data and application state.

Potential metrics:

* Catalog size.
* Number of categories.
* Average product rating.
* Products with low stock.
* Products with available discounts.
* Distribution by category.
* Rating or price distributions.
* Local demo-order counts and totals.

Give every metric a clear definition.

Use interactive charts only when they communicate meaningful information.

Make charts understandable through labels, legends, tooltips, and accessible alternatives.

Do not fabricate business history or claim to have reliable revenue analytics when historical sales records are unavailable.

Sample cart totals are not completed sales. If sample cart information is shown, label it accordingly.

Separate metrics derived from DummyJSON from metrics derived from local demo state.

The dashboard must work with actual loaded data rather than screenshots or hardcoded chart values.

### 8.2 Product catalog management

Build a sophisticated catalog management interface.

Include:

* Searchable product table.
* Sorting and filtering.
* Category selection.
* Stock and rating indicators.
* Price and discount presentation.
* Product thumbnails.
* Product detail inspection.
* Pagination or appropriate dataset navigation.
* Row selection and bulk actions where practical.
* Contextual action menus.
* Useful empty and loading states.

The table must be readable, responsive, and keyboard accessible.

Provide a polished product detail drawer or dedicated detail page.

### 8.3 Product creation and editing

Implement a complete product editor.

Support the appropriate available product fields, including:

* Title.
* Description.
* Category.
* Price.
* Discount.
* Stock.
* Rating where appropriate.
* Brand when present.
* Tags when present.
* Product images.

Validate input with Zod.

Make errors actionable.

Include save, cancel, validation, dirty-state handling, confirmation where appropriate, and success feedback.

Persist changes in the application's local overlay.

Allow new locally created products to appear in the storefront and merchant catalog.

Support editing and deleting appropriate locally managed demo records.

Ensure all derived views reflect the changes.

Do not imply that these changes modify the remote DummyJSON dataset permanently.

### 8.4 Inventory management

Build an inventory-focused workspace.

Include:

* Low-stock products.
* Out-of-stock products.
* Stock-level indicators.
* Filtering and sorting.
* Inventory search.
* Quick stock adjustment.
* Product detail access.
* Meaningful summary metrics.

Choose sensible thresholds and make them consistent.

Use the verified product stock field.

Any stock adjustment must update the same shared application state used by the storefront and catalog.

Define clear behavior when a product becomes unavailable while it remains in a user's cart.

### 8.5 Merchandising workspace

Create a feature that makes this project more distinctive than a conventional merchant dashboard.

Provide a visual merchandising editor that allows the merchant to:

* Choose featured products.
* Configure featured collections.
* Select categories for the storefront.
* Adjust the ordering of featured products.
* Preview the resulting storefront composition.

The storefront preview should update immediately when the configuration changes.

Persist merchandising settings locally.

Ensure that locally created or edited products can be included in merchandising.

Use a clear editing and preview workflow. Avoid introducing a needlessly complex drag-and-drop system if an accessible, simpler interaction provides equivalent functionality.

### 8.6 Customers

Build a customer directory using available DummyJSON user data.

Include:

* Search.
* Pagination.
* User profiles.
* Relevant contact information from sample records.
* Associated sample-cart information when supported.
* Useful order history for customers with locally generated demo orders.

Clearly distinguish actual sample records from local relationships created by the application.

Never imply that unrelated users have made purchases merely because sample carts exist.

### 8.7 Demo orders

Implement an order-management workspace using locally created demo orders.

Include:

* Order list.
* Order detail view.
* Order identifier.
* Customer information.
* Items and quantities.
* Pricing breakdown.
* Creation date.
* Current demo status.
* Status filtering.
* Search and sorting.
* Appropriate empty states.

If status changes are supported, persist them locally and reflect them in all relevant views.

Mark the workflow as simulated.

Do not claim integration with real fulfillment, shipping providers, payment processing, or an external order-management system.

### 8.8 Merchant usability

Prioritize high information density without sacrificing readability.

Use:

* Consistent page headers.
* Clear primary actions.
* Functional search and filters.
* Contextual menus.
* Useful bulk operations.
* Accessible dialogs and drawers.
* Clear saving indicators.
* Predictable keyboard and focus behavior.

The merchant workspace must remain useful at tablet and mobile widths.

## 9. Shared Cross-Application Behavior

The storefront and merchant workspace must operate on the same coherent application model.

A locally edited product must update in the catalog and storefront.

An inventory change must update product availability.

A product added to merchandising must appear in the correct storefront section.

A checkout-created order must appear in the order-management interface.

A product that has been removed from availability must not silently remain purchasable at its former stock level.

A cart must preserve consistent quantities and prices throughout the checkout process.

Define and test the rules for reconciling API data with local changes.

Do not implement separate, conflicting state stores for different pages.

When a cross-application action occurs, all affected views must update without requiring a full manual page reload.

Use optimistic updates when they improve the experience and when rollback behavior is well defined.

Provide appropriate feedback if an operation fails.

## 10. Additional Product Polish

After the core commerce flows work, implement the most valuable polish features within the remaining project scope.

Prioritize:

* Global command or quick-action interface where appropriate.
* Useful keyboard shortcuts.
* Persistent user preferences.
* Dark mode if it can be implemented consistently and tested.
* Wishlist management.
* Recently viewed products.
* Toast notifications.
* Confirmation dialogs for destructive actions.
* Undo where a clear rollback operation exists.
* Thoughtful page transitions.
* Responsive navigation.
* Helpful tooltips.
* Sensible loading behavior.
* Consistent empty states.

Do not add features merely to increase the feature count.

Prefer several exceptionally well-integrated interactions over many superficial features.

## 11. Implementation Phases

Use the harness's task system to track progress and dependencies.

Execute these phases autonomously.

### Phase 1: Repository and API reconnaissance

Inspect the repository.

Read the necessary documentation.

Identify actual data shapes and API behavior.

Establish the implementation plan, architecture, design direction, and UI quality rubric.

Do not stop at the plan.

### Phase 2: Foundation

Implement the application shell, routing, theme, design tokens, typography, shared primitives, API layer, domain types, validation, state management, persistence, and test infrastructure.

Verify that the foundation runs and builds.

### Phase 3: Storefront vertical slice

Implement the homepage, catalog, search, filtering, product detail, wishlist, and persistent cart.

Validate the entire path from product discovery to cart modification.

### Phase 4: Checkout and account

Implement the demo checkout, order creation, confirmation, and account experiences.

Ensure that cart and order behavior remains consistent after refresh.

### Phase 5: Merchant operations

Implement the dashboard, catalog management, product editor, inventory, merchandising, customers, and demo-order management.

Connect all views to the same underlying data model.

### Phase 6: Cross-application integration

Verify synchronization between storefront, merchant catalog, inventory, merchandising, cart, and orders.

Fix state inconsistencies and edge cases.

### Phase 7: UI/UX hardening

Inspect every major route.

Test desktop and mobile behavior.

Improve visual composition, typography, responsiveness, empty states, loading states, feedback, accessibility, and interaction quality.

Repeat the UI review-and-fix cycle until the quality gate is satisfied.

### Phase 8: Automated validation

Run formatting, linting, type checking, unit tests, integration tests, end-to-end tests, and the production build as supported by the repository.

Resolve all actionable failures.

Execute primary user journeys in a browser when available.

Do not declare completion merely because the development server starts.

### Phase 9: Final certification

Perform a final code review and UI walkthrough.

Verify all acceptance criteria.

Document any remaining limitation honestly.

Produce a concise certification report.

Do not omit a required phase because the implementation appears visually complete.

## 12. Testing Requirements

Create automated tests for important business logic.

At a minimum, test:

* Product search and filtering.
* Sorting and pagination.
* Price and discount calculations.
* Cart addition, removal, and quantity changes.
* Cart totals and rounding.
* Input validation.
* Product creation and editing.
* Local override reconciliation.
* Local persistence and restoration.
* Inventory updates.
* Checkout validation.
* Order creation and duplicate-submission prevention.
* Merchandising updates.
* Relevant error and empty states.

Use mocked API responses for deterministic tests where appropriate.

Include end-to-end coverage for the following user journeys:

Journey A — Shopping:
Open the storefront, search for a product, open its details, add it to the cart, modify the quantity, complete the demo checkout, and verify the resulting order.

Journey B — Product management:
Open the merchant workspace, edit a product's price or stock, save the changes, refresh the page, and verify that the change persists in the merchant catalog and storefront.

Journey C — Merchandising:
Change the featured products or category selection in the merchant editor, verify the preview, navigate to the storefront, and confirm the selected configuration is reflected there.

Journey D — Inventory:
Adjust a product's stock, verify that the inventory summary updates, and confirm the storefront respects the resulting availability.

Journey E — Error recovery:
Simulate or mock an API error, verify that the interface reports the problem clearly, and test the available recovery action.

Journey F — Responsive behavior:
Exercise the primary storefront and merchant flows at desktop and mobile sizes.

Add tests for any additional critical integration logic discovered during implementation.

## 13. Performance and Maintainability

Avoid unnecessary client-side rendering, repeated requests, excessive component rerenders, oversized dependencies, and inefficient filtering.

Use appropriate image sizing and lazy loading.

Avoid blocking the entire interface for requests that do not prevent immediate user interaction.

Keep bundle size and loading behavior reasonable.

Do not sacrifice accessibility or maintainability to optimize prematurely.

Keep business calculations outside presentation components.

Use reusable primitives where reuse improves consistency, but avoid building abstractions that make simple features harder to implement.

Preserve clear TypeScript contracts.

Do not use `any` or suppress errors merely to get the build passing.

Do not disable lint rules globally to hide defects.

Keep secrets out of source control. No genuine external credentials should be required for the demo application.

The application must remain usable when optional features or nonessential external requests fail.

## 14. Definition of Done

The project is complete only when all applicable criteria below pass.

### Product completeness

* The customer storefront is fully implemented.
* Product discovery and detail pages work.
* The persistent cart works.
* The demo checkout completes successfully.
* Orders appear in the merchant workspace.
* Merchant catalog management works.
* Local product edits persist across refreshes.
* Inventory changes are reflected across the application.
* Merchandising changes are reflected in the storefront.
* Customer and demo-order views work.
* Primary navigation and all visible actions behave correctly.
* No critical user journey depends on unfinished placeholders.

### Data integrity

* DummyJSON is used for the appropriate external data.
* The implementation does not invent undocumented API behavior.
* Simulated remote mutations are not represented as permanently saved server-side changes.
* Application-created data is handled by an explicit persistence strategy.
* Derived metrics are based on actual available data.
* Sample data and simulated business records are clearly distinguished.
* Cross-application state remains consistent.

### Engineering

* Type checking passes.
* Linting passes.
* The production build passes.
* Unit and integration tests pass.
* Critical end-to-end flows pass.
* No unresolved critical runtime errors remain.
* No known critical security or data-integrity defects remain.
* Dependency and test commands are documented and reproducible.

### UI/UX

* Every major route has been inspected.
* The UI Engineering Constitution's quality gate is satisfied.
* Desktop, tablet, and mobile layouts are usable.
* Primary interactions provide appropriate feedback.
* Loading, error, and empty states are implemented.
* Keyboard navigation and accessibility fundamentals are verified.
* No critical visual defects or broken assets remain.
* No unintended horizontal overflow exists at the required viewport sizes.
* The storefront and merchant workspace feel like parts of one coherent product.

Do not claim a check passed if it was not executed.

If a check cannot run because a tool or external service is unavailable, report exactly what was blocked and what alternative validation was performed.

## 15. Final Certification Report

When the project is complete, provide a concise report containing:

1. Overall result: PASS or PASS WITH DOCUMENTED LIMITATIONS.
2. Features implemented.
3. Major architectural decisions.
4. DummyJSON resources and integration behavior.
5. Local persistence and demo-mode limitations.
6. Commands executed.
7. Actual results of build, type checking, linting, and automated tests.
8. End-to-end journeys verified.
9. UI quality scores by dimension and viewport.
10. Remaining known issues.
11. The commands required to install, run, and test the application.

List failures honestly. Do not fabricate test counts, screenshots, coverage percentages, or successful builds.

Do not stop early to produce this report. Produce it only after attempting to complete the implementation and validation.

## Final Instruction

Build Meridian Commerce OS as if it were going to be demonstrated to senior engineers, product designers, and potential customers.

The storefront must be beautiful.

The merchant platform must be operationally convincing.

The data model must be coherent.

The interactions must work.

The application must be tested.

The UI must be continuously reviewed and improved.

Autonomously make the implementation decisions necessary to achieve these objectives.

Start by inspecting the existing repository and verifying the DummyJSON documentation. Then execute the implementation phases until the definition of done is satisfied.

Your deliverable is a working, polished, tested application—not a plan, prototype, design specification, or explanation of how someone else could build it.
