# Changelog

## Unreleased

## 0.9.0 (2026-10-19)

- Released in lockstep with the other Desktop Accounting API packages; no entries for this package.

## 0.8.0 (2026-10-13)

- `invoke_api_endpoint` checks required query arguments before calling, like path arguments: a delete without `confirm` or a custom field definition delete without `ownerId` returns an error naming the argument and sends nothing. A boolean query argument must be `true`, `false`, `"true"` or `"false"`.
- Tool annotations come from the API contract (`x-daapi-effect`, `x-daapi-idempotent`). `destructiveHint` is true for deletes, voids, merges, passthrough, a company file identity reset and a secret rotation, and no longer for updates, custom field values, cleared status or canceling a queued request. `idempotentHint` is true for reads and for `end_users_disable_connection`, `end_users_enable_connection`, `requests_cancel` and the cleared-status update.
- **Breaking:** custom field definition update and delete take the definition's current name as `definitionName` (it was `name`, next to the body's own `name`).
- A list-record delete reports `deleted: false` with `deactivated` and `isActive` when QuickBooks kept the record; see the API changelog.
- The README covers `confirm` on deletes and merges, the custom field `operation`, public and private owner IDs and the read-back of list deletes.
- **Breaking:** a list-object delete's `deleted` and `deactivated` can be null: QuickBooks accepted the delete but reading the record back failed. The request then succeeds with `outcome` applied and a new `QBD_DELETE_NOT_VERIFIED` warning; do not send the delete again. A failed write the API verified as applied keeps `outcome` applied and is not retryable.
- List-object delete results gain `retainedBecause`: `multi_user_mode` when QuickBooks kept the record because the company file was open in multi-user mode (it deletes in single-user mode).
- New error code `QBD_REQUIRES_SINGLE_USER_MODE` (`409`, not retryable, outcome `not_applied`): merges and custom field definition deletes are refused before sending while the company file is open in multi-user mode, and custom field values QuickBooks refuses there (status 3180 or 3120) map to it. `integrationConnections[].companyFile.fileMode` (`single_user` / `multi_user`) shows the mode of the last session.
- A lead request QuickBooks does not process (status 3231, even a plain lead list) answers `422 QBD_OPERATION_UNSUPPORTED` with alternatives instead of `QBD_REQUEST_ERROR`.
- `qbd.vehicleMileage.delete` reads the trip first: an unknown ID answers `404 QBD_OBJECT_NOT_FOUND`; an existing trip answers `422 QBD_OPERATION_UNSUPPORTED` (QuickBooks refuses the delete with status 3160 even on a fresh company file) without sending the delete.
- The `quickbooks_closed_unexpectedly` diagnosis needs QuickBooks' "Unexpected error" (HRESULT 0x80040402) in a session the Web Connector never closed, and silence since its last contact; its steps first have the end user check that QuickBooks closed and no other application is updating.
- Batches (`qbd.batch`) follow the same rules: a list-delete member reads the record back (`deleted`, `deactivated`, `retainedBecause`, and a `QBD_DELETE_NOT_VERIFIED` member warning when the read-back failed), a batch holding a merge or custom field definition delete is refused with `409 QBD_REQUIRES_SINGLE_USER_MODE` in multi-user mode (`details.index` names the member), a lead member QuickBooks does not process is `QBD_OPERATION_UNSUPPORTED`, a vehicle mileage delete member is refused with `422 QBD_OPERATION_UNSUPPORTED`, and batch delete and merge members require `confirm` like the typed calls.
- **Breaking:** a batch member for custom field definition update or delete takes `pathParams.definitionName` (was `pathParams.name`), as the typed calls do.
- A custom field definition delete reads the owner's definitions back in the same request: `CustomFieldDefinitionDeleted` gains `deleted` (true only when the definition is gone, false when QuickBooks kept it, null when the read-back failed with a `QBD_DELETE_NOT_VERIFIED` warning) and `retainedBecause` (`multi_user_mode` or `unknown`), on the typed call and as a batch member.
- `QBD_REQUIRES_SINGLE_USER_MODE` now needs QuickBooks' own evidence: a custom field value refused with another 3180/3120 message keeps its code (for example not found, or `QBD_TRANSIENT_ERROR` for a record modified by another user); a generic data-extension refusal in multi-user mode keeps its code with `details.possibleCause: multi_user_mode`.
- A batch member QuickBooks refused is `not_applied` in its result and its error, whatever other members did; a lead member under `continueOnError` after another member failed is `QBD_OPERATION_UNSUPPORTED`, not `not_processed`; the vehicle mileage refusal carries `details.index`.
- New error code `QBD_REAUTHORIZATION_REQUIRED`: `503`, not retryable. QuickBooks answered the Web Connector with 0x80040435 and asks its Admin to reauthorize the application in Edit > Preferences > Integrated Applications; nothing was sent. It answered `QBD_CONNECTION_ERROR`. New diagnosis cause `quickbooks_reauthorization_required`.
- A company file QuickBooks cannot reach at its stored location (0x80040408 for a path on a drive letter other than C:, usually a disconnected mapped network drive, or for the same path twice in a row) answers `QBD_COMPANY_FILE_NOT_FOUND` with `details.reason` `path_unreachable`, `details.pathKind` and `details.refusals`, and the new diagnosis cause `company_file_not_found` ranks first. It answered `QBD_WRONG_COMPANY_FILE_OPEN` ("a different company file is open").
- A QuickBooks status 3170 whose message says the record is in use, locked or being edited answers `409 QBD_OBJECT_IN_USE` with the `record_in_use` diagnosis (not retryable for a deletion). It answered `422 QBD_REQUEST_ERROR`. QuickBooks does not lock every open record, so the documentation no longer promises that an open window blocks a change.
- A payment item or job type name that is already in use answers `409 QBD_DUPLICATE_NAME` with `param` `name` (QuickBooks status 3180). It answered `422 QBD_REQUEST_ERROR`.
- `qbd.customFieldDefinitions.list` without filters returns the public definitions (`ownerId` `"0"`); it returned none. `ownerIds` together with `assignToObjects` lists the definitions of those owners assigned to those record types, private ones included; the combination was refused.
- Vehicle mileage `createdAt` and `updatedAt` are date-times: midnight UTC when QuickBooks reports only a date. They were plain dates, which the Java SDK could not parse.
- A single request ends its Web Connector session as soon as QuickBooks answers it, so QuickBooks no longer counts the application as using the company file for 2 seconds afterwards; only a request sent within 30 seconds of another keeps the session open for the next one.

## 0.7.0 (2026-10-12)

- `qbd.batch` runs up to 25 typed QuickBooks Desktop operations in one call through `invoke_api_endpoint`. Its schema stays compact: each member names its `operationId` and carries that operation's `pathParams`, `query` and `body` (`get_api_endpoint_schema` of the member's operation describes them). A read-only connection keeps `qbd.batch` for reads and refuses a batch with a write member before sending it.
- A recovered `qbd.batch` (lost response, every create found in QuickBooks by its `externalId`) gives each create member's QuickBooks ID in `recoveredObjectId`; the agent retrieves the record by that ID instead of resending.
- Change feed subscription tools: `change_feed_subscriptions_create`, `_list`, `_retrieve`, `_update` and `_delete`. A subscription polls the project's connected end users for changed and deleted records and sends `data.changed` webhooks with their IDs.

## 0.6.0 (2026-10-12)

- `webhook_endpoints_rotate_secret` works: the API honors the idempotency key the server sends and answers an unknown endpoint with `404 RESOURCE_MISSING`.
- A `QBD_OBJECT_IN_USE` error that is not retryable (a deletion of an object other records still use) tells the agent not to retry the call and to deactivate the object instead.

### Operations added in this release

Listed after the release (2026-10-12): the entry above named the fixes but not the operations 0.6.0 added. 155 new operations, by operation ID (method names follow each SDK's conventions):

- `qbd.accounts`: `delete`, `merge`, `setCustomField`
- `qbd.billCheckPayments`: `setCustomField`
- `qbd.billCreditCardPayments`: `setCustomField`
- `qbd.billingRates`: `create`, `delete`, `list`, `retrieve`
- `qbd.bills`: `setCustomField`
- `qbd.buildAssemblies`: `setCustomField`
- `qbd.checks`: `setCustomField`
- `qbd.classes`: `delete`, `merge`
- `qbd.creditCardCharges`: `setCustomField`
- `qbd.creditCardCredits`: `setCustomField`
- `qbd.creditCardRefunds`: `setCustomField`
- `qbd.creditMemos`: `setCustomField`
- `qbd.currencies`: `delete`
- `qbd.customFieldDefinitions`: `create`, `delete`, `list`, `update`
- `qbd.customerMessages`: `create`, `delete`, `list`, `retrieve`
- `qbd.customerTypes`: `delete`
- `qbd.customers`: `delete`, `merge`, `setCustomField`
- `qbd.dateDrivenTerms`: `delete`
- `qbd.deposits`: `setCustomField`
- `qbd.discountItems`: `delete`, `merge`, `setCustomField`
- `qbd.employees`: `delete`, `setCustomField`
- `qbd.entities`: `list`, `retrieve`
- `qbd.estimates`: `setCustomField`
- `qbd.fixedAssetItems`: `create`, `delete`, `list`, `retrieve`, `setCustomField`, `update`
- `qbd.inventoryAdjustments`: `setCustomField`
- `qbd.inventoryAssemblyItems`: `canBuild`, `delete`, `setCustomField`
- `qbd.inventoryItems`: `delete`, `merge`, `setCustomField`
- `qbd.inventorySites`: `delete`
- `qbd.inventoryTransfers`: `create`, `delete`, `list`, `retrieve`, `update`
- `qbd.invoices`: `setCustomField`
- `qbd.itemGroups`: `delete`, `merge`, `setCustomField`
- `qbd.itemReceipts`: `setCustomField`
- `qbd.items`: `list`, `retrieve`
- `qbd.jobTypes`: `create`, `delete`, `list`, `retrieve`
- `qbd.journalEntries`: `setCustomField`
- `qbd.leads`: `create`, `list`, `retrieve`, `update`
- `qbd.nonInventoryItems`: `delete`, `merge`, `setCustomField`
- `qbd.otherChargeItems`: `delete`, `merge`, `setCustomField`
- `qbd.otherNames`: `delete`, `setCustomField`
- `qbd.paymentItems`: `create`, `delete`, `list`, `merge`, `retrieve`, `setCustomField`, `update`
- `qbd.paymentMethods`: `delete`
- `qbd.payrollNonWageItems`: `delete`, `list`, `retrieve`
- `qbd.payrollWageItems`: `delete`, `update`
- `qbd.priceLevels`: `delete`
- `qbd.purchaseOrders`: `setCustomField`
- `qbd.receivePayments`: `setCustomField`
- `qbd.salesOrders`: `setCustomField`
- `qbd.salesReceipts`: `setCustomField`
- `qbd.salesRepresentatives`: `delete`
- `qbd.salesTaxCodes`: `delete`
- `qbd.salesTaxGroupItems`: `delete`, `merge`, `setCustomField`
- `qbd.salesTaxItems`: `delete`, `merge`, `setCustomField`
- `qbd.salesTaxPaymentChecks`: `setCustomField`
- `qbd.serviceItems`: `delete`, `merge`, `setCustomField`
- `qbd.shippingMethods`: `delete`
- `qbd.standardTerms`: `delete`
- `qbd.statementCharges`: `create`, `delete`, `list`, `retrieve`, `setCustomField`, `update`, `void`
- `qbd.subtotalItems`: `delete`, `merge`, `setCustomField`
- `qbd.toDos`: `create`, `delete`, `list`, `retrieve`, `update`
- `qbd.transactions`: `updateClearedStatus`
- `qbd.unitOfMeasureSets`: `delete`
- `qbd.vehicleMileage`: `create`, `delete`, `list`, `retrieve`
- `qbd.vehicles`: `create`, `delete`, `list`, `retrieve`, `update`
- `qbd.vendorCredits`: `setCustomField`
- `qbd.vendorTypes`: `create`, `delete`, `list`, `retrieve`
- `qbd.vendors`: `delete`, `merge`, `setCustomField`
- `qbd.workersCompCodes`: `create`, `delete`, `list`, `retrieve`, `update`

## 0.5.4 (2026-10-09)

- Released in lockstep with the other Desktop Accounting API packages; no entries for this package.

## 0.5.3 (2026-10-09)

- Releases publish to npm through trusted publishing (GitHub OIDC) with provenance; no npm token is used. The publish script checks that npm is new enough.

## 0.5.2 (2026-10-09)

- Released in lockstep with the other Desktop Accounting API packages; no entries for this package.

## 0.5.1 (2026-10-09)

- Released in lockstep with the other Desktop Accounting API packages; no entries for this package.

## 0.5.0 (2026-10-09)

- `list_api_endpoints` finds the searches its description suggests: "profit and loss" and "open invoices" now return the report operation and name the matching `reportType` (for example `profit_and_loss_standard`, `open_invoices`). Words match as tokens against the operation name, resource, summary, description, path, parameter names and report types; case, plurals and stop words do not matter, common synonyms count (P&L, A/R, supplier for vendor), and results come best match first. An exact operation or tool name (`qbd.salesOrders.list`, `qbd_sales_orders_list`, `generalSummary`) is found and listed first.

## 0.4.0 (2026-10-08)

- The endpoint catalog follows the API contract: employee responses carry the warning `QBD_PERSONAL_DATA_WITHHELD` for each Social Security number QuickBooks withheld, integration connections report `personalDataAccess`, and a failed passthrough's error `details.requests` lists the status of every qbXML message.

## 0.3.0 (2026-10-08)

- Error results give the error catalog's cause and fixes before the `<untrusted-data>` envelope, so the model follows them; the message and details, which can quote QuickBooks data, stay inside it.
- A write whose outcome is pending and one whose outcome is unknown get different guidance, and both name the request that keeps running (`details.requestId`) instead of the HTTP call's ID. A read timeout gets a next step, a non-JSON error on a write says to resend only with the same idempotency key, and `Retry-After` is passed on.
- The endpoint catalog follows the API contract: `qbd.reports.budgetSummary` requires `fiscalYear`, the inventory valuation summary no longer takes `basis` (QuickBooks rejects it), and the `connection.company_file_remarked` webhook event is listed.

## 0.2.1 (2026-10-07)

- The endpoint catalog follows API contract sha256 `b5774d24bc81` (documentation only): `revisionNumber` and `updatedAt` change at most once per second, the status 3261 personal-data fixes, and what item sites return without Advanced Inventory.

## 0.2.0 (2026-10-07)

- QuickBooks data in tool results, and error details that may quote it, is wrapped in an `<untrusted-data>` envelope with a fixed note telling the model not to follow instructions inside it. `<` is escaped, so the data cannot close the envelope.
- `destructiveHint` marks every write tool except additive ones (creates, and testing or resending a webhook), so clients ask before an update, delete, void, cancel, passthrough, secret rotation or company file reset.
- Without `--read-only`, the server recognizes a read-only secret key, with a check that changes nothing, and hides the write tools.
- `--code-allow-http-gets`, Conductor's read-only flag, is accepted as an alias of `--read-only`, and `handleMcpRequest` treats Conductor's `x-stainless-mcp-client-permissions` header as read-only.
- The endpoint catalog follows the API contract: with `ids` or `refNumbers`, `limit` is ignored (every match comes in one page) instead of rejected.

## 0.1.1 (2026-10-06)

- The README is rewritten: setup for each MCP client, read-only keys, the tools and library use. Its code samples are type-checked against the package before release.

## 0.1.0 (2026-10-06)

First release of `@desktopaccountingapi/quickbooks-desktop-mcp`, generated from API contract sha256 `1cc3058cecb5` (API version 1.0.0, 275 operations).

- Local MCP server over stdio: `npx -y @desktopaccountingapi/quickbooks-desktop-mcp`. Node.js 20 or later on Windows, macOS and Linux; no other runtime and no runtime dependencies.
- Tools: `list_end_users`, `list_api_endpoints`, `get_api_endpoint_schema`, `invoke_api_endpoint`, `search_docs`; optional one tool per operation with `--resources`.
- Writes carry an `Idempotency-Key`; an unknown outcome is reported with recovery steps, never resent.
- `--read-only` hides and refuses writes; read-only secret keys are enforced by the API.
- Library exports (`McpServer`, `handleMcpRequest`, `Tools`) to embed the server in your own process.
