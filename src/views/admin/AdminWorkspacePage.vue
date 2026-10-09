<template>
  <ion-page
    ><ion-content :fullscreen="true">
      <div class="shell design-workspace" :class="{ 'admin-booking-directory': section === 'bookings', 'admin-passenger-directory': section === 'passengers', 'admin-trips-directory': section === 'trips', 'admin-port-directory': section === 'ports', 'admin-vessel-directory': section === 'vessels', 'admin-checkin-directory': section === 'check-in', 'admin-boarding-directory': section === 'boarding', 'admin-manifest-directory': section === 'manifest', 'admin-noshows-directory': section === 'no-shows', 'admin-advisory-directory': section === 'advisories', 'admin-broadcast-directory': section === 'notifications', 'admin-reports-directory': section === 'reports', 'admin-audit-directory': section === 'audit-logs', 'admin-settings-directory': section === 'operations', 'admin-inbox-directory': section === 'inbox', 'admin-user-directory': section === 'users', 'admin-route-directory': section === 'routes', 'admin-accommodation-directory': section === 'accommodation' }">
        <button
          v-if="menuOpen"
          class="scrim"
          aria-label="Close menu"
          @click="menuOpen = false"
        ></button>
        <aside id="admin-sidebar" class="sidebar" :class="{ open: menuOpen }">
          <BrandMark />
          <nav aria-label="Admin navigation">
            <div
              v-for="group in navigation"
              :key="group.label"
              class="nav-group"
            >
              <button
                class="nav-group-toggle"
                :aria-expanded="expandedNavigation === group.label"
                :aria-controls="`admin-nav-${group.items[0].key}`"
                @click="expandedNavigation = expandedNavigation === group.label ? '' : group.label"
              >
                <span class="nav-group-label">
                  <ion-icon :icon="group.icon" aria-hidden="true" />
                  {{ group.label }}
                </span>
                <ion-icon class="nav-group-chevron" :icon="chevronDownOutline" aria-hidden="true" />
              </button>
              <div
                v-show="expandedNavigation === group.label"
                :id="`admin-nav-${group.items[0].key}`"
                class="nav-group-items"
              >
              <router-link
                v-for="item in group.items"
                :key="item.key"
                :to="item.key === 'dashboard' ? '/admin' : `/admin/${item.key}`"
                :class="{ active: section === item.key }"
                @click="menuOpen = false"
                ><ion-icon :icon="item.icon" aria-hidden="true" />{{
                  item.label
                }}</router-link
              >
              </div>
            </div>
          </nav>
        </aside>
        <div class="workspace">
          <header class="topbar glass-toolbar">
            <button
              class="menu-button"
              :aria-expanded="menuOpen"
              aria-controls="admin-sidebar"
              aria-label="Open menu"
              @click="menuOpen = true"
            >
              <ion-icon :icon="menuOutline" />
            </button>
            <div class="admin-breadcrumbs">
              <strong>Admin workspace</strong>
            </div>
            <form
              class="admin-global-search"
              @submit.prevent="
                router.push({
                  path: '/admin/bookings',
                  query: { search: globalSearch },
                })
              "
            >
              <ion-icon :icon="searchOutline" /><input
                v-model.trim="globalSearch"
                type="search"
                placeholder="Search bookings..."
                aria-label="Search all bookings"
              />
            </form>
            <div class="admin-header-actions">
            <router-link
              to="/admin/inbox"
              :aria-current="section === 'inbox' ? 'page' : undefined"
              class="admin-bell"
              :aria-label="notificationUnreadCount ? `Notifications, ${notificationUnreadCount} unread` : 'Notifications'"
              title="Notifications"
              ><ion-icon :icon="notificationsOutline" aria-hidden="true" />
              <span v-if="notificationUnreadCount" class="admin-unread-badge" aria-hidden="true">{{ notificationUnreadCount > 99 ? '99+' : notificationUnreadCount }}</span>
            </router-link>
            <AdminAccountMenu />
            </div>
          </header>
          <main class="content">
            <div class="heading">
              <div>
                <p class="eyebrow">{{ page.group }}</p>
                <h1>{{ page.title }}</h1>
                <p>{{ page.description }}</p>
              </div>
              <div class="heading-actions">
                <Button variant="outline" class="secondary" :disabled="loading || refreshDecision" @click="loadData">
                  <ion-icon :icon="refreshOutline" />Refresh</Button
                ><Button
                  v-if="primaryAction"
                  class="primary"
                  @click="openAction"
                >
                  {{ primaryAction }}
                </Button>
              </div>
            </div>
            <p v-if="error" class="alert" role="alert">{{ error }}</p>
            <p v-if="notice" class="notice" role="status">{{ notice }}</p>
            <AdminReportsPanel
              v-if="section === 'reports'"
              :refresh-token="reportsRefresh"
              @loading="loading = $event"
            />
            <AdminOverviewPanel
              v-else-if="section === 'dashboard' || section === 'analytics'"
              :refresh-token="reportsRefresh"
              :analytics="section === 'analytics'"
            />
            <AccommodationPanel
              ref="childEditorRef"
              v-else-if="section === 'accommodation'"
              :key="`accommodation-${reportsRefresh}`"
            />
            <RoutesPanel
              ref="childEditorRef"
              v-else-if="section === 'routes'"
              :key="`routes-${reportsRefresh}`"
            />
            <NoShowsPanel
              v-else-if="section === 'no-shows'"
              :key="`no-shows-${reportsRefresh}`"
            />
            <NotificationsPanel
              ref="childEditorRef"
              v-else-if="section === 'notifications'"
              :key="`notifications-${reportsRefresh}`"
            />
            <InboxPanel v-else-if="section === 'inbox'" :key="`inbox-${reportsRefresh}`" />
            <AuditLogsPanel
              v-else-if="section === 'audit-logs'"
              :key="`audit-${reportsRefresh}`"
            /><AdvisoriesPanel
              ref="childEditorRef"
              embedded
              v-else-if="section === 'advisories'"
              :key="`advisories-${reportsRefresh}`"
            /><TripOperationsPanel
              embedded
              v-else-if="section === 'trip-operations'"
              :key="`trip-${reportsRefresh}`"
            /><OperationsPanel v-else-if="section === 'operations'" />
            <VouchersPanel v-else-if="section === 'vouchers'" :key="`vouchers-${reportsRefresh}`" />
            <section
              v-else-if="section === 'fares'"
              class="fare-settings-panel"
              aria-label="Fare configuration"
            >
              <div class="panel fare-vessel-picker">
                <div class="fare-vessel-heading">
                  <span class="fare-card-icon"><ion-icon :icon="boatOutline" aria-hidden="true" /></span>
                  <div>
                  <p class="eyebrow">VESSEL PRICING</p>
                  <h2>Choose a vessel</h2>
                  <p>
                    Each ferry has its own regular fare and passenger discounts.
                  </p>
                  </div>
                </div>
                <div>
                  <label for="fare-vessel">Vessel</label
                  ><select
                    id="fare-vessel"
                    v-model="selectedFareVesselId"
                    :disabled="loading || !!busy || !fareSettingsLoaded"
                  >
                    <option value="" disabled>Select a vessel</option>
                    <option
                      v-for="v in activeVessels"
                      :key="v.id"
                      :value="v.id"
                    >
                      {{ v.name }} · {{ v.code }}
                    </option></select
                  ><span
                    class="fare-config-status"
                    :class="{ configured: selectedVesselHasFares }"
                    >{{
                      selectedFareVesselId
                        ? selectedVesselHasFares
                          ? "Saved rates"
                          : "Rates not saved yet"
                        : "No active vessels"
                    }}</span
                  >
                </div>
              </div>
              <p
                v-if="fareSettingsLoaded && !activeVessels.length"
                class="fare-vessel-note"
              >
                Add an active vessel in
                <router-link to="/admin/vessels">Vessels</router-link> to
                configure its fares.
              </p>
              <p
                v-else-if="
                  fareSettingsLoaded &&
                  selectedFareVesselId &&
                  !selectedVesselHasFares
                "
                class="fare-vessel-note"
              >
                Set and save rates for {{ selectedFareVessel?.name }} before
                creating its trips. The values below are a starting point.
              </p>
              <form @submit.prevent="saveFareSettings">
                <fieldset
                  :disabled="
                    loading ||
                    !!busy ||
                    !fareSettingsLoaded ||
                    !selectedFareVesselId
                  "
                >
                  <div class="fare-layout">
                    <div class="fare-editor">
                      <section class="panel fare-card fare-base-card">
                        <div class="fare-card-heading">
                          <span class="fare-card-icon"
                            ><ion-icon :icon="ticketOutline" aria-hidden="true"
                          /></span>
                          <div>
                            <h2>Regular fare</h2>
                            <p>
                              The base price for
                              {{
                                selectedFareVessel?.name ||
                                "the selected vessel"
                              }}.
                            </p>
                          </div>
                        </div>
                        <div class="regular-fare-control">
                        <label for="regular-fare">Base fare</label>
                        <div class="fare-input fare-base-input">
                          <span aria-hidden="true">PHP</span
                          ><input
                            id="regular-fare"
                            v-model.number="fareSettingsForm.regularFare"
                            type="number"
                            min="1"
                            max="2147483647"
                            step="1"
                            required
                            aria-describedby="regular-fare-hint"
                          />
                        </div>
                        <p id="regular-fare-hint" class="fare-hint">
                          Passenger discounts are calculated from this amount.
                        </p>
                        </div>
                      </section>
                      <section class="panel fare-card custom-discounts">
                        <div class="fare-card-heading">
                          <span class="fare-card-icon"><ion-icon :icon="pricetagsOutline" aria-hidden="true" /></span>
                          <div>
                            <h2>Passenger discounts</h2>
                            <p>
                              Edit, delete, or add any passenger discount.
                              Active discounts become available on new trips.
                            </p>
                          </div>
                          <span class="discount-count">{{ fareSettingsForm.passengerDiscounts?.filter(d => d.isActive).length || 0 }} active</span>
                        </div>
                        <div
                          v-for="(
                            discount, index
                          ) in fareSettingsForm.passengerDiscounts"
                          :key="discount.id"
                          class="custom-discount-row"
                          :class="{ 'discount-row-inactive': !discount.isActive }"
                        >
                          <label :for="'custom-name-' + discount.id"
                            >Discount name<input
                              :id="'custom-name-' + discount.id"
                              v-model="discount.name"
                              maxlength="60"
                              required
                              :placeholder="
                                discount.name || 'Special discount'
                              "
                          /></label>
                          <label :for="'custom-percent-' + discount.id"
                            >Discount (%)<div class="discount-percent-input"><input
                              :id="'custom-percent-' + discount.id"
                              v-model.number="discount.percentage"
                              type="number"
                              min="0"
                              max="99"
                              step="1"
                              required
                          /><span aria-hidden="true">%</span></div></label>
                          <label class="custom-active"
                            ><input
                              v-model="discount.isActive"
                              type="checkbox"
                              :aria-label="'Enable discount ' + (discount.name || index + 1)"
                            />{{ discount.isActive ? 'Active' : 'Inactive' }}</label
                          >
                          <button
                            type="button"
                            class="text-action danger"
                            :aria-label="
                              'Delete discount ' + (discount.name || index + 1)
                            "
                            @click="
                              fareSettingsForm.passengerDiscounts?.splice(
                                index,
                                1,
                              )
                            "
                          >
                            Delete
                          </button>
                        </div>
                        <p
                          v-if="!fareSettingsForm.passengerDiscounts?.length"
                          class="fare-hint"
                        >
                          No passenger discounts. New trips will offer the
                          regular fare only.
                        </p>
                        <p
                          v-if="
                            passengerDiscountError(
                              fareSettingsForm.passengerDiscounts,
                            )
                          "
                          class="alert"
                          role="alert"
                        >
                          {{
                            passengerDiscountError(
                              fareSettingsForm.passengerDiscounts,
                            )
                          }}
                        </p>
                        <button
                          type="button"
                          class="secondary"
                          :disabled="
                            (fareSettingsForm.passengerDiscounts?.length ||
                              0) >= 20
                          "
                          @click="addCustomDiscount"
                        >
                          + Add discount
                        </button>
                        <p class="fare-hint">
                          Deleting or deactivating a discount affects new trips.
                          Existing trips keep their saved discounts.
                        </p>
                      </section>
                    </div>
                    <aside
                      class="panel fare-preview-card"
                      aria-labelledby="fare-preview-title"
                    >
                      <div class="fare-preview-heading">
                        <p class="eyebrow">LIVE PREVIEW</p>
                        <h2 id="fare-preview-title">Passenger fares</h2>
                        <p>
                          {{
                            selectedFareVessel?.name ||
                            "Select a vessel to configure its rates."
                          }}
                        </p>
                      </div>
                      <div class="fare-preview">
                        <div class="fare-preview-regular">
                          <span>Regular<small>Base fare</small></span
                          ><strong
                            >PHP
                            {{
                              validFareSettings(fareSettingsForm)
                                ? settingsFarePreview.regularFare.toLocaleString()
                                : "—"
                            }}</strong
                          >
                        </div>
                        <div
                          v-for="discount in fareSettingsForm.passengerDiscounts"
                          :key="discount.id"
                          :class="{ 'fare-preview-inactive': !discount.isActive }"
                        >
                          <span
                            >{{ discount.name || "Unnamed discount"
                            }}<small
                              >{{ discount.percentage }}% discount{{
                                discount.isActive ? "" : " (inactive)"
                              }}</small
                            ></span
                          ><strong
                            >PHP
                            {{
                              validFareSettings(fareSettingsForm)
                                ? discountFare(
                                    fareSettingsForm.regularFare,
                                    discount.percentage,
                                  ).toLocaleString()
                                : "-"
                            }}</strong
                          >
                        </div>
                      </div>
                      <p class="fare-preview-note">
                        <ion-icon
                          :icon="ticketOutline"
                          aria-hidden="true"
                        />Fares are rounded to whole pesos, with a minimum of
                        PHP 1.
                      </p>
                    </aside>
                  </div>
                  <div class="panel fare-save-bar">
                    <div>
                      <strong>{{
                        loading
                          ? "Loading fare settings…"
                          : `Apply to new trips for ${selectedFareVessel?.name || "this vessel"}`
                      }}</strong>
                      <p>
                        Existing trips and reservations keep their saved fares.
                      </p>
                    </div>
                    <button
                      class="primary"
                      type="submit"
                      :disabled="
                        !validFareSettings(fareSettingsForm) ||
                        !selectedFareVesselId
                      "
                    >
                      {{
                        busy === "fares" ? "Saving…" : "Save fares & discounts"
                      }}
                    </button>
                  </div>
                </fieldset>
              </form>
            </section>
            <template v-else
              ><p v-if="section === 'boarding'" class="boarding-help">
                <ion-icon
                  :icon="informationCircleOutline"
                  aria-hidden="true"
                /><span
                  >Boarding is available for checked-in passengers on paid,
                  confirmed reservations when the trip status is
                  <strong>BOARDING</strong>. Open boarding in
                  <router-link to="/admin/trips">Trips & schedules</router-link
                  >.</span
                >
              </p>
              <AdminManifestExport v-if="section === 'manifest'" class="manifest-download-card" :external-selection="true" :sailing-code="sailingFilter === 'ALL' ? '' : sailingFilter" :sailings="sailingOptions.map(s => ({ code: s.code, origin: s.origin.name, destination: s.destination.name, vessel: s.vessel.name }))" />
              <div v-if="['check-in', 'boarding', 'manifest'].includes(section)" class="booking-filters check-in-filters">
                <label class="booking-search-field" for="check-in-search"><span>Search passengers</span><div class="booking-search-input"><ion-icon :icon="searchOutline" aria-hidden="true" /><input id="check-in-search" v-model.trim="search" type="search" placeholder="Passenger name or booking reference" /></div></label>
                <label v-if="section !== 'manifest'" for="check-in-status"><span>Ticket status</span><select id="check-in-status" v-model="statusFilter" aria-label="Filter by status"><option value="ALL">All statuses</option><option v-for="value in filterOptions" :key="value" :value="value">{{ value.replaceAll('_', ' ') }}</option></select></label>
                <label class="check-in-sailing-filter" for="check-in-sailing"><span>Sailing</span><select id="check-in-sailing" v-model="sailingFilter" aria-label="Filter by sailing"><option value="ALL">All sailings</option><option v-for="s in sailingOptions" :key="s.code" :value="s.code">{{ s.code }} · {{ routeLabel(s) }}</option></select></label>
                <Button variant="ghost" :disabled="!search && statusFilter === 'ALL' && sailingFilter === 'ALL'" @click="search = ''; statusFilter = 'ALL'; sailingFilter = 'ALL'">Reset filters</Button>
              </div>
              <div v-else-if="section === 'users'" class="booking-filters user-filters">
                <label class="booking-search-field" for="user-search"><span>Search users</span><div class="booking-search-input"><ion-icon :icon="searchOutline" aria-hidden="true" /><input id="user-search" v-model.trim="search" type="search" placeholder="Full name or email address" /></div></label>
                <label for="user-role-filter"><span>Account role</span><select id="user-role-filter" v-model="statusFilter"><option value="ALL">All roles</option><option v-for="value in filterOptions" :key="value" :value="value">{{ userRoleLabel(value) }}</option></select></label>
                <Button variant="ghost" :disabled="!search && statusFilter === 'ALL'" @click="search = ''; statusFilter = 'ALL'">Reset filters</Button>
              </div>
              <div v-else-if="['bookings', 'passengers', 'trips', 'ports', 'vessels'].includes(section)" class="booking-filters" :class="{ 'trip-filters': section === 'trips' }">
                <label class="booking-search-field" for="directory-search">
                  <span>{{ section === 'vessels' ? 'Search vessels' : section === 'ports' ? 'Search ports' : section === 'trips' ? 'Search trips' : section === 'passengers' ? 'Search passengers' : 'Search bookings' }}</span>
                  <div class="booking-search-input">
                    <ion-icon :icon="searchOutline" aria-hidden="true" />
                    <input id="directory-search" v-model.trim="search" type="search" :placeholder="section === 'vessels' ? 'Vessel code or name' : section === 'ports' ? 'Port code, name, city, or region' : section === 'trips' ? 'Trip code, route, or vessel' : section === 'passengers' ? 'Passenger name or booking reference' : 'Booking reference or account name'" />
                  </div>
                </label>
                <label for="directory-status">
                  <span>{{ section === 'vessels' ? 'Vessel status' : section === 'ports' ? 'Port status' : section === 'trips' ? 'Trip status' : section === 'passengers' ? 'Ticket status' : 'Payment / booking status' }}</span>
                  <select id="directory-status" v-model="statusFilter">
                    <option value="ALL">All statuses</option>
                    <option v-for="value in filterOptions" :key="value" :value="value">{{ section === 'trips' ? value.toLowerCase().replaceAll('_', ' ') : value }}</option>
                  </select>
                </label>
                <Button variant="ghost" :disabled="!search && statusFilter === 'ALL'" @click="search = ''; statusFilter = 'ALL'">Reset filters</Button>
              </div>
              <div v-else class="toolbar">
                <input
                  v-model.trim="search"
                  type="search"
                  :placeholder="`Search ${page.title.toLowerCase()}`"
                  :aria-label="`Search ${page.title}`"
                /><select
                  v-if="
                    [
                      'bookings',
                      'passengers',
                      'trips',
                      'check-in',
                      'boarding',
                      'users',
                    ].includes(section)
                  "
                  v-model="statusFilter"
                  aria-label="Filter by status"
                >
                  <option value="ALL">All statuses</option>
                  <option
                    v-for="value in filterOptions"
                    :key="value"
                    :value="value"
                  >
                    {{ value }}
                  </option></select
                ><select
                  v-if="['check-in', 'boarding', 'manifest'].includes(section)"
                  v-model="sailingFilter"
                  aria-label="Filter by sailing"
                >
                  <option value="ALL">All sailings</option>
                  <option v-for="s in sailingOptions" :key="s.code" :value="s.code">
                    {{ s.code }} · {{ routeLabel(s) }}
                  </option>
                </select>
              </div>
              <p v-if="section === 'check-in'" class="check-in-guidance"><ion-icon :icon="informationCircleOutline" aria-hidden="true" /><span>Check in issued tickets for paid, confirmed bookings. Choose a sailing to focus on its passengers.</span></p>
              <details v-if="section === 'trips'" class="admin-trip-weather"><summary><span><ion-icon :icon="boatOutline" aria-hidden="true" /> Port weather</span><span>Choose a sailing to view its forecast</span></summary><WeatherTripPicker :trips="sailings" /></details>
              <section class="panel" :class="{ 'booking-records-panel': ['bookings', 'passengers', 'trips', 'ports', 'vessels', 'check-in', 'boarding', 'manifest', 'users'].includes(section), 'passenger-records-panel': section === 'passengers', 'trip-records-panel': section === 'trips', 'boarding-records-panel': section === 'boarding', 'manifest-records-panel': section === 'manifest' }">
                <div class="panel-head">
                  <div>
                    <p class="eyebrow">{{ section === 'users' ? 'ACCOUNT DIRECTORY' : section === 'manifest' ? 'PAID PASSENGER RECORDS' : section === 'boarding' ? 'PASSENGER BOARDING' : section === 'check-in' ? 'PASSENGER CHECK-IN' : section === 'vessels' ? 'FLEET RECORDS' : section === 'ports' ? 'PORT RECORDS' : section === 'trips' ? 'TRIP SCHEDULES' : section === 'passengers' ? 'PASSENGER RECORDS' : 'RECORDS' }}</p>
                    <h2>{{ page.table }}</h2>
                  </div>
                  <span class="count" :class="{ 'booking-record-count': ['bookings', 'passengers', 'trips', 'ports', 'vessels', 'check-in', 'boarding', 'manifest', 'users'].includes(section) }"
                    >{{ rows.length }}
                    {{ rows.length === 1 ? "record" : "records" }}</span
                  >
                </div>
                <RecordsGrid
                  :key="section"
                  :title="page.table || page.title"
                  :columns="columns"
                  :rows="rows"
                  :loading="loading"
                  :column-min-widths="section === 'bookings' ? [180, 210, 85, 100, 165] : section === 'passengers' ? [160, 95, 155, 155, 125, 125] : section === 'trips' ? [220, 120, 155, 95, 135] : section === 'ports' ? [110, 190, 210, 100] : section === 'vessels' ? [110, 210, 120, 100] : section === 'check-in' ? [170, 160, 155, 175, 115] : section === 'boarding' ? [155, 140, 145, 165, 115, 130] : section === 'manifest' ? [145, 65, 85, 145, 145, 105, 145] : section === 'users' ? [190, 250, 145, 165] : []"
                  :column-flex="section === 'manifest' ? [1.2, .45, .65, 1.15, 1.15, .85, 1.15] : section === 'users' ? [1.1, 1.6, .8, 1] : []"
                  :density="['bookings', 'passengers', 'trips', 'ports', 'vessels', 'check-in', 'boarding', 'manifest', 'users'].includes(section) ? 'compact' : 'comfortable'"
                  :max-grid-height="['ports', 'vessels', 'users'].includes(section) ? 360 : ['check-in', 'boarding', 'manifest'].includes(section) ? 440 : ['bookings', 'passengers', 'trips'].includes(section) ? 480 : 560"
                  :action-width="['check-in', 'boarding'].includes(section) ? 130 : section === 'trips' ? 150 : ['check-in', 'boarding'].includes(section) ? 140 : ['bookings', 'ports', 'vessels'].includes(section) ? 110 : 170"
                  ><template v-if="section === 'bookings'" #cell="{ row, index, value }">
                    <div v-if="index === 0" class="booking-identity"><strong>{{ row.source.reference }}</strong><small>{{ row.source.owner.fullName }}</small></div>
                    <div v-else-if="index === 1" class="booking-sailing"><strong>{{ row.source.sailing.origin.name }} → {{ row.source.sailing.destination.name }}</strong><small>{{ dateTime(row.source.sailing.departureAt) }}</small></div>
                    <span v-else-if="index === 2" class="booking-passengers">{{ value }}</span>
                    <strong v-else-if="index === 3" class="booking-amount">{{ value }}</strong>
                    <div v-else class="booking-payment"><Badge :class="['booking-status-badge', String(value).toLowerCase().replaceAll(' ', '-')]" :variant="value === 'PAID' ? 'success' : ['CANCELLED', 'EXPIRED'].includes(String(value)) ? 'destructive' : ['AWAITING PAYMENT', 'AWAITING STAFF VERIFICATION', 'REFUND PENDING'].includes(String(value)) ? 'warning' : 'default'">{{ String(value).toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase()) }}</Badge><small>{{ paymentMethodLabel(row.source) }}</small><small v-if="row.source.voucherCode" class="booking-voucher">{{ row.source.voucherCode }} · − PHP {{ (row.source.voucherDiscount ?? 0).toLocaleString() }}</small></div>
                  </template>
                  <template v-else-if="section === 'passengers'" #cell="{ row, index, value }">
                    <strong v-if="index === 0" class="passenger-name">{{ value }}</strong>
                    <span v-else-if="index === 1" class="passenger-type">{{ value === 'PWD' ? 'PWD' : String(value).toLowerCase().replaceAll('_', ' ') }}</span>
                    <Badge v-else-if="index === row.statusIndex" :class="['passenger-status-badge', String(value).toLowerCase().replaceAll('_', '-').replaceAll(' ', '-')]" :variant="['CANCELLED', 'NO_SHOW'].includes(String(value)) ? 'destructive' : value === 'PAYMENT PENDING' ? 'warning' : value === 'BOARDED' ? 'success' : 'default'">{{ String(value).toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()) }}</Badge>
                    <span v-else :class="{ 'passenger-reference': index === 2 || index === 3 }">{{ value }}</span>
                  </template>
                  <template v-else-if="section === 'users'" #cell="{ index, value, row }">
                    <div v-if="index === 0" class="user-name-cell"><span class="user-initials" aria-hidden="true">{{ userInitials(String(value)) }}</span><div><strong>{{ value || 'Unnamed user' }}</strong><small v-if="row.source.uid === auth?.currentUser?.uid">Your account</small></div></div>
                    <span v-else-if="index === 1" class="user-email">{{ value }}</span>
                    <Badge v-else-if="index === 2" :variant="value === 'ADMIN' ? 'warning' : value === 'PASSENGER' ? 'default' : 'success'">{{ userRoleLabel(String(value)) }}</Badge>
                    <span v-else class="user-created-date">{{ value }}</span>
                  </template>
                  <template v-else-if="section === 'trips'" #cell="{ row, index, value }">
                    <div v-if="index === 0" class="schedule-identity"><strong class="trip-reference">{{ row.source.code }}</strong><small>{{ routeLabel(row.source) }}</small></div>
                    <div v-else-if="index === 3" class="trip-capacity"><strong>{{ value }}</strong><div class="schedule-seat-track" aria-hidden="true"><i :style="{ width: `${row.source.vessel.passengerCapacity ? Math.max(0, Math.min(100, 100 * (row.source.vessel.passengerCapacity - row.source.availableSeats) / row.source.vessel.passengerCapacity)) : 0}%` }"></i></div></div>
                    <template v-else-if="index === row.statusIndex"><select v-if="nextStatuses(row.source).length > 1" class="schedule-status-select" :class="row.source.status.toLowerCase()" :value="row.source.status" :disabled="!!busy" :aria-label="`Change status for ${row.key}`" @change="changeSailingStatus(row.source, $event)"><option v-for="state in nextStatuses(row.source)" :key="state" :value="state">{{ state.toLowerCase().replaceAll('_', ' ') }}</option></select><Badge v-else class="schedule-status-badge" :class="row.source.status.toLowerCase()" :variant="value === 'CANCELLED' ? 'destructive' : value === 'COMPLETED' ? 'success' : 'default'">{{ String(value).toLowerCase() }}</Badge></template>
                    <span v-else>{{ value }}</span>
                  </template>
                  <template v-else-if="['ports', 'vessels'].includes(section)" #cell="{ row, index, value }">
                    <strong v-if="index === 0" class="port-code">{{ value }}</strong>
                    <strong v-else-if="index === 1" class="port-name">{{ value }}</strong>
                    <Badge v-else-if="index === row.statusIndex" :variant="row.source.isActive ? 'success' : 'destructive'">{{ row.source.isActive ? 'Active' : 'Inactive' }}</Badge>
                    <span v-else-if="section === 'vessels' && index === 2" class="vessel-capacity">{{ value }} seats</span>
                    <span v-else>{{ value }}</span>
                  </template>
                  <template v-else-if="['check-in', 'boarding'].includes(section)" #cell="{ row, index, value }">
                    <strong v-if="index === 0" class="passenger-name">{{ value }}</strong>
                    <Badge v-else-if="index === row.statusIndex" :variant="value === 'ISSUED' ? 'default' : ['CHECKED_IN', 'BOARDED'].includes(String(value)) ? 'success' : ['PENDING', 'PAYMENT_PENDING'].includes(String(value)) ? 'warning' : 'destructive'">{{ String(value).replaceAll('_', ' ') }}</Badge>
                    <Badge v-else-if="section === 'boarding' && index === 5" :variant="value === 'CANCELLED' ? 'destructive' : ['BOARDING', 'DELAYED'].includes(String(value)) ? 'warning' : value === 'COMPLETED' ? 'success' : 'default'">{{ String(value).replaceAll('_', ' ') }}</Badge>
                    <span v-else :class="{ 'passenger-reference': index === 1 || index === 2 }">{{ value }}</span>
                  </template>
                  <template v-else-if="section === 'manifest'" #cell="{ row, index, value }">
                    <strong v-if="index === 0" class="passenger-name">{{ value }}</strong>
                    <span v-else-if="index === 1" class="manifest-sex">{{ String(value).toLowerCase() }}</span>
                    <span v-else-if="index === 2" class="passenger-type">{{ value === 'PWD' ? 'PWD' : String(value).toLowerCase().replaceAll('_', ' ') }}</span>
                    <Badge v-else-if="index === row.statusIndex" :variant="value === 'ISSUED' ? 'default' : ['CHECKED_IN', 'BOARDED'].includes(String(value)) ? 'success' : ['PENDING', 'PAYMENT_PENDING'].includes(String(value)) ? 'warning' : 'destructive'">{{ String(value).replaceAll('_', ' ') }}</Badge>
                    <span v-else-if="index === 6 && !row.source.boardedAt" class="manifest-not-boarded">Not boarded</span>
                    <span v-else :class="{ 'passenger-reference': index === 3 || index === 4 }">{{ value }}</span>
                  </template>
                  <template v-if="hasRowAction" #actions="{ row }"
                    ><template v-if="section === 'bookings'"
                      ><button
                        v-if="row.source.paymentStatus === 'UNPAID' && ['PENDING', 'CONFIRMED'].includes(row.source.status)"
                        class="text-action danger"
                        :aria-label="`Cancel booking ${row.key}`"
                        :title="row.source.paymentStatus === 'UNPAID' && ['PENDING', 'CONFIRMED'].includes(row.source.status) ? 'Cancel this unpaid booking' : 'Only unpaid pending or confirmed bookings can be cancelled'"
                        :disabled="
                          row.source.paymentStatus !== 'UNPAID' ||
                          !['PENDING', 'CONFIRMED'].includes(
                            row.source.status,
                          ) ||
                          busy === row.key
                        "
                        @click="cancelBooking(row.source)"
                      >
                        Cancel
                      </button><span v-else class="booking-no-action" title="Only unpaid pending or confirmed bookings can be cancelled" aria-label="Cancellation unavailable">—</span></template
                    ><template
                      v-else-if="section === 'ports' || section === 'vessels'"
                      ><button
                        class="text-action"
                        :aria-label="`Edit ${section === 'ports' ? 'port' : 'vessel'} ${row.source.name}`"
                        @click="editRecord(row.source)"
                      >
                        Edit
                      </button></template
                    ><template v-else-if="section === 'trips'"
                      ><div class="trip-row-actions">
                        <router-link
                          class="text-action"
                          :aria-label="`Open operations for trip ${row.key}`"
                          :to="`/admin/trip-operations?sailing=${encodeURIComponent(row.key)}`"
                          >Operations</router-link
                        ><button
                          class="text-action"
                          type="button"
                          :aria-label="`Edit trip ${row.key}`"
                          :disabled="!canEditTrip(row.source) || !!busy"
                          :title="
                            canEditTrip(row.source)
                              ? 'Edit trip details'
                              : 'Boarding or completed trips cannot be edited'
                          "
                          @click="openTripEditor(row.source)"
                        >
                          Edit</button
                        >
                      </div></template
                    ><template v-else-if="section === 'check-in'"
                      ><button
                        class="text-action check-in-action"
                        :aria-label="row.source.ticketStatus === 'ISSUED' ? `Check in ${row.source.fullName}` : `${row.source.fullName}: ${row.source.ticketStatus.replaceAll('_', ' ').toLowerCase()}`"
                        :disabled="
                          !!ticketActionBlockReason(row.source, 'check-in') ||
                          !!busy
                        "
                        :title="
                          ticketActionBlockReason(row.source, 'check-in') ||
                          'Check in passenger'
                        "
                        @click="processTicket(row.source, 'check-in')"
                      >
                        <ion-icon :icon="row.source.ticketStatus === 'ISSUED' ? scanOutline : ['CHECKED_IN', 'BOARDED'].includes(row.source.ticketStatus) ? checkmarkCircleOutline : informationCircleOutline" aria-hidden="true" />
                        {{
                          busy === row.key ? 'Checking in…' : row.source.ticketStatus === "ISSUED"
                            ? "Check in"
                            : row.source.ticketStatus === 'CHECKED_IN' ? 'Checked in' : row.source.ticketStatus === 'BOARDED' ? 'Boarded' : 'Unavailable'
                        }}
                      </button></template
                    ><template v-else-if="section === 'boarding'"
                      ><div class="boarding-row-action">
                        <button
                          class="text-action check-in-action"
                          :aria-label="row.source.ticketStatus === 'BOARDED' ? `${row.source.fullName} has boarded` : `Board ${row.source.fullName}`"
                          :disabled="
                            !!ticketActionBlockReason(row.source, 'boarding') ||
                            !!busy
                          "
                          :title="
                            ticketActionBlockReason(row.source, 'boarding') ||
                            'Board passenger'
                          "
                          @click="processTicket(row.source, 'boarding')"
                        >
                          <ion-icon :icon="row.source.ticketStatus === 'BOARDED' ? checkmarkCircleOutline : boatOutline" aria-hidden="true" />
                          {{
                            busy === row.key
                              ? "Boarding…"
                              : row.source.ticketStatus === "BOARDED"
                                ? "Boarded"
                                : row.source.ticketStatus === 'ISSUED' ? 'Check in first' : row.source.ticketStatus !== 'CHECKED_IN' ? 'Unavailable' : row.source.booking.sailing.status !== 'BOARDING' ? 'Not open' : 'Board'
                          }}
                        </button>
                      </div></template
                    ></template
                  ></RecordsGrid
                >
                <p class="table-foot">
                  {{ section === 'ports' ? `${rows.length} of ${recordTotal} ports.` : `${recordTotal} records.` }}
                  {{
                    section === 'ports' ? 'Search and status filters apply to all ports. Inactive ports are unavailable for new sailings.' : section === 'bookings' ? 'Search and status filters apply to all bookings. Cancellation is available only for eligible unpaid reservations.' : ['trips', 'users', 'passengers', 'check-in', 'boarding', 'manifest'].includes(section)
                      ? "Primary filters search all records. Column sorting and filtering apply to the loaded page."
                      : "Search, column sorting, and filters apply to the loaded page."
                  }}
                </p>
<WorkspacePagination v-if="!['ports', 'vessels'].includes(section) && (['bookings', 'passengers'].includes(section) ? recordTotal > 0 : recordTotal > pageSize)" :page="recordPage" :total="recordTotal" :page-size="pageSize" :disabled="loading || !!busy" @change="recordPage = $event; loadData()"><span v-if="['bookings', 'passengers'].includes(section)">{{ rows.length ? recordPage * pageSize + 1 : 0 }}–{{ rows.length ? recordPage * pageSize + rows.length : 0 }} of {{ recordTotal.toLocaleString() }} {{ section === 'passengers' ? 'passengers' : 'bookings' }}</span><span v-else>{{ recordTotal.toLocaleString() }} records</span></WorkspacePagination>
              </section></template
            >
            <PortLocationMap
              v-if="section === 'ports' && ports.length"
              :ports="ports"
              class="admin-port-map"
              admin
            />
          </main>
        </div>
      </div>
      <ion-modal
        :is-open="modal !== ''"
        :can-dismiss="canDismissEditor"
        :class="{
          'trip-modal': modal === 'trip',
          'user-modal': modal === 'user',
          'port-modal': modal === 'port' || modal === 'vessel',
          'port-editor-modal': modal === 'port',
          'vessel-editor-modal': modal === 'vessel',
        }"
        @didDismiss="resetModal"
        ><div
          class="modal-body"
          :class="{
            'trip-dialog': modal === 'trip',
            'user-dialog': modal === 'user',
            'port-dialog': modal === 'port' || modal === 'vessel',
            'port-editor-dialog': modal === 'port',
            'vessel-editor-dialog': modal === 'vessel',
          }"
        >
          <div class="modal-head">
            <div class="trip-modal-title">
              <span v-if="modal === 'port' || modal === 'vessel'" class="port-title-icon"><ion-icon :icon="modal === 'vessel' ? boatOutline : locationOutline" aria-hidden="true" /></span>
              <span v-if="modal === 'user'" class="account-title-icon"
                ><ion-icon
                  :icon="peopleCircleOutline"
                  aria-hidden="true" /></span
              ><span v-if="modal === 'trip'" class="trip-title-icon"
                ><ion-icon :icon="boatOutline" aria-hidden="true"
              /></span>
              <div>
                <p v-if="modal === 'trip'" class="eyebrow">TRIPS & SCHEDULES</p>
                <p v-if="modal === 'user'" class="eyebrow">USER MANAGEMENT</p>
                <p v-if="modal === 'port'" class="eyebrow">PORT DIRECTORY</p>
                <p v-if="modal === 'vessel'" class="eyebrow">FLEET DIRECTORY</p>
                <h2>{{ modalTitle }}</h2>
                <p v-if="modal === 'port'" class="port-subtitle">{{ editingId ? 'Update this port’s details and availability.' : 'Add a departure or arrival port for new sailings.' }}</p>
                <p v-if="modal === 'vessel'" class="port-subtitle">{{ editingId ? 'Update this vessel’s name and availability.' : 'Add a ferry and set its passenger capacity.' }}</p>
                <p v-if="modal === 'user'" class="account-subtitle">
                  {{
                    createdAccount
                      ? "The account is ready to sign in."
                      : "Add a passenger or staff member to BarkoLink."
                  }}
                </p>
                <p v-if="modal === 'trip'" class="trip-subtitle">
                  {{
                    editingId
                      ? "Review sailing details and update the schedule."
                      : "Choose a route, vessel, and departure schedule."
                  }}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close dialog"
              :disabled="!!busy"
              @click="closeModal"
            >
              <ion-icon :icon="closeOutline" />
            </button>
          </div>
          <p v-if="formError" class="alert" role="alert">{{ formError }}</p>
          <form v-if="modal === 'port'" class="port-form" @submit.prevent="savePort">
            <fieldset class="port-fields" :disabled="!!busy">
              <p class="port-form-note">Fields marked * are required.</p>
              <h3 class="port-field-heading">Port details</h3>
              <div class="port-field-grid">
                <label for="port-code">Port code *<input id="port-code" v-model.trim="portForm.code" :disabled="!!editingId" required maxlength="12" placeholder="e.g. BTG" aria-describedby="port-code-hint" /><small id="port-code-hint">{{ editingId ? 'Port codes stay fixed after creation.' : 'Use a short, unique code. Saved in uppercase.' }}</small></label>
                <label for="port-name">Port name *<input id="port-name" v-model.trim="portForm.name" required maxlength="120" placeholder="e.g. Batangas Port" /></label>
              </div>
              <h3 class="port-field-heading">Location</h3>
              <div class="port-field-grid">
                <label for="port-city">City *<input id="port-city" v-model.trim="portForm.city" required maxlength="120" placeholder="e.g. Batangas City" /></label>
                <label for="port-region">Region (optional)<input id="port-region" v-model.trim="portForm.region" maxlength="120" placeholder="e.g. Batangas" /></label>
              </div>
              <label v-if="editingId" class="port-availability"><input v-model="portForm.isActive" type="checkbox" /><span><strong>Active port</strong><small>Available when creating new sailings.</small></span></label>
            </fieldset>
            <footer class="port-form-footer">
              <button class="secondary" type="button" :disabled="!!busy" @click="closeModal">Cancel</button>
              <button class="primary" type="submit" :disabled="!!busy">{{ busy ? "Saving…" : editingId ? "Save changes" : "Add port" }}</button>
            </footer>
          </form>
          <form v-else-if="modal === 'vessel'" class="port-form" @submit.prevent="saveVessel">
            <div class="catalog-modal-scroll">
              <fieldset class="port-fields" :disabled="!!busy">
                <p class="port-form-note">Vessel code, name, and passenger capacity are required.</p>
                <div class="port-field-grid">
                  <label for="vessel-code">Vessel code<input id="vessel-code" v-model.trim="vesselForm.code" :disabled="!!editingId" required maxlength="20" placeholder="e.g. VSL-005" /><small>{{ editingId ? 'Vessel codes stay fixed after creation.' : 'Use a unique code. Saved in uppercase.' }}</small></label>
                  <label for="vessel-name">Vessel name<input id="vessel-name" v-model.trim="vesselForm.name" required maxlength="120" placeholder="e.g. MV Island Ferry" /></label>
                  <label for="vessel-capacity">Passenger capacity<input id="vessel-capacity" v-model.number="vesselForm.capacity" type="number" min="1" max="10000" :disabled="!!editingId" required /><small>{{ editingId ? 'Capacity is fixed after creation to preserve existing sailing availability.' : 'Maximum number of passenger seats, from 1 to 10,000.' }}</small></label>
                </div>
                <label v-if="editingId" class="port-availability"><input v-model="vesselForm.isActive" type="checkbox" /><span><strong>Active vessel</strong><small>Available when creating new sailings.</small></span></label>
              </fieldset>
            </div>
            <footer class="port-form-footer"><button class="secondary" type="button" :disabled="!!busy" @click="closeModal">Cancel</button><button class="primary" type="submit" :disabled="!!busy">{{ busy ? 'Saving…' : 'Save vessel' }}</button></footer>
          </form>
          <form
            v-else-if="modal === 'trip'"
            class="trip-form"
            @submit.prevent="saveTrip"
          >
            <div class="trip-scroll">
              <div class="trip-code-banner">
                <label
                  >Trip code<input
                    :value="tripForm.code"
                    readonly
                    required /></label
                ><span class="trip-code-badge">{{
                  editingId ? "Existing sailing" : "Auto-generated"
                }}</span>
                <p v-if="!editingId">
                  Today's daily number is finalized when you create the trip.
                </p>
              </div>
              <div v-if="editingId && tripEditLoading" class="trip-callout">
                <ion-icon :icon="refreshOutline" aria-hidden="true" />
                <p>Checking active reservations…</p>
              </div>
              <div
                v-if="editingId && tripBookingsLoaded && tripHasBookings"
                class="trip-callout"
              >
                <ion-icon :icon="lockClosedOutline" aria-hidden="true" />
                <div>
                  <strong
                    >{{ tripBookings.length }} active
                    {{
                      tripBookings.length === 1 ? "reservation" : "reservations"
                    }}</strong
                  >
                  <p>
                    Only departure and arrival can be changed. Account holders
                    will receive a schedule notification.
                  </p>
                  <p
                    v-if="
                      tripBookings.some(
                        (item) => item.bookingChannel === 'WALK_IN',
                      )
                    "
                  >
                    Contact walk-in passengers directly about the new schedule.
                  </p>
                </div>
              </div>
              <div class="trip-grid">
                <div class="trip-details">
                  <section
                    class="trip-section"
                    aria-labelledby="trip-route-title"
                  >
                    <div class="trip-section-heading">
                      <span
                        ><ion-icon :icon="locationOutline" aria-hidden="true"
                      /></span>
                      <div>
                        <h3 id="trip-route-title">Route & vessel</h3>
                        <p>Choose where and how passengers will travel.</p>
                      </div>
                      <small v-if="tripFieldsLocked" class="trip-lock-badge"
                        ><ion-icon
                          :icon="lockClosedOutline"
                          aria-hidden="true"
                        />Locked</small
                      >
                    </div>
                    <div class="form-grid">
                      <label
                        >Origin<select
                          v-model="tripForm.originPortId"
                          :disabled="tripFieldsLocked"
                          required
                        >
                          <option value="" disabled>Select origin port</option>
                          <option
                            v-for="p in activePorts"
                            :key="p.id"
                            :value="p.id"
                          >
                            {{ p.name }}
                          </option>
                        </select></label
                      ><label
                        >Destination<select
                          v-model="tripForm.destinationPortId"
                          :disabled="tripFieldsLocked"
                          required
                        >
                          <option value="" disabled>
                            Select destination port
                          </option>
                          <option
                            v-for="p in activePorts"
                            :key="p.id"
                            :value="p.id"
                          >
                            {{ p.name }}
                          </option>
                        </select></label
                      >
                    </div>
                    <label
                      >Vessel<select
                        v-model="tripForm.vesselId"
                        :disabled="tripFieldsLocked"
                        required
                      >
                        <option value="" disabled>Select vessel</option>
                        <option
                          v-for="v in activeVessels"
                          :key="v.id"
                          :value="v.id"
                        >
                          {{ v.name }} · {{ v.passengerCapacity }} seats
                        </option>
                      </select></label
                    >
                    <p v-if="selectedTripVessel" class="trip-field-hint">
                      <ion-icon :icon="peopleOutline" aria-hidden="true" />{{
                        selectedTripVessel.passengerCapacity
                      }}
                      passenger seats on {{ selectedTripVessel.name }}
                    </p>
                    <label v-if="routeOptions.length"
                      >Saved route (optional)<select
                        v-model="savedRouteId"
                        :disabled="tripFieldsLocked"
                        @change="useSavedRoute"
                      >
                        <option value="">Choose ports manually</option>
                        <option
                          v-for="r in routeOptions"
                          :key="r.id"
                          :value="r.id"
                        >
                          {{ r.code }} · {{ r.origin.name }} →
                          {{ r.destination.name }} · {{ r.durationMinutes }} min
                        </option>
                      </select></label
                    >
                  </section>
                  <section
                    class="trip-section"
                    aria-labelledby="trip-schedule-title"
                  >
                    <div class="trip-section-heading">
                      <span
                        ><ion-icon :icon="calendarOutline" aria-hidden="true"
                      /></span>
                      <div>
                        <h3 id="trip-schedule-title">Sailing schedule</h3>
                        <p>Set the departure and expected arrival.</p>
                      </div>
                    </div>
                    <div class="form-grid">
                      <label
                        >Departure<input
                          v-model="tripForm.departureAt"
                          type="datetime-local"
                          required /></label
                      ><label
                        >Arrival<input
                          v-model="tripForm.arrivalAt"
                          type="datetime-local"
                          required
                      /></label>
                    </div>
                    <p class="trip-field-hint">
                      <ion-icon :icon="timeOutline" aria-hidden="true" />{{
                        tripDurationLabel ||
                        "Arrival must be later than departure."
                      }}
                    </p>
                  </section>
                </div>
                <aside
                  class="trip-section trip-fare-section"
                  aria-labelledby="trip-fares-title"
                >
                  <div class="trip-section-heading">
                    <span
                      ><ion-icon :icon="ticketOutline" aria-hidden="true"
                    /></span>
                    <div>
                      <h3 id="trip-fares-title">Passenger fares</h3>
                      <p>
                        {{
                          tripFieldsLocked
                            ? "Saved fares are locked."
                            : "Based on the selected vessel."
                        }}
                      </p>
                    </div>
                  </div>
                  <div
                    v-if="tripForm.vesselId || editingId"
                    class="trip-fare-values"
                  >
                    <label class="trip-regular-fare"
                      >Regular fare (PHP)<input
                        v-model.number="tripForm.regularFare"
                        type="number"
                        min="1"
                        max="2147483647"
                        step="1"
                        :readonly="!editingId"
                        :disabled="tripFieldsLocked || !tripVesselFares"
                        required
                    /></label>
                    <div
                      v-if="dynamicTripDiscounts !== null"
                      class="trip-discount-fares"
                    >
                      <label
                        v-for="discount in dynamicTripDiscounts"
                        :key="discount.id"
                        ><span>{{ discount.name }}<small>PHP</small></span
                        ><input
                          :value="
                            tripFieldsLocked
                              ? discount.fare
                              : discountFare(
                                  tripForm.regularFare,
                                  discount.percentage,
                                )
                          "
                          type="number"
                          readonly
                      /></label>
                      <p v-if="!dynamicTripDiscounts.length">
                        Regular fare only.
                      </p>
                    </div>
                    <div v-else class="trip-discount-fares">
                      <label v-for="type in discountTypes" :key="type.key"
                        ><span>{{ type.label }}<small>PHP</small></span
                        ><input
                          :value="tripForm[type.fareKey]"
                          type="number"
                          readonly
                      /></label>
                    </div>
                  </div>
                  <div v-else class="trip-fares-empty">
                    <ion-icon :icon="boatOutline" aria-hidden="true" /><strong
                      >Select a vessel</strong
                    >
                    <p>
                      Its regular and discounted fares will appear here
                      automatically.
                    </p>
                  </div>
                  <p
                    v-if="
                      tripForm.vesselId && !tripVesselFares && !tripFieldsLocked
                    "
                    class="trip-fare-warning"
                  >
                    Save fares for this vessel in
                    <router-link to="/admin/fares"
                      >Fares & discounts</router-link
                    >
                    before creating a trip or changing its fares.
                  </p>
                  <p
                    v-else-if="tripForm.vesselId && !tripFieldsLocked"
                    class="trip-field-hint"
                  >
                    {{
                      editingId
                        ? "Changing the regular fare recalculates fares using this vessel’s saved discounts."
                        : "Fares are filled automatically from this vessel’s saved rates."
                    }}
                  </p>
                </aside>
              </div>
            </div>
            <footer class="trip-form-footer">
              <span
                ><ion-icon :icon="boatOutline" aria-hidden="true" />{{
                  editingId
                    ? "Review your changes before saving."
                    : "New trips start as Scheduled."
                }}</span
              >
              <div>
                <button
                  class="secondary"
                  type="button"
                  :disabled="!!busy"
                  @click="closeModal"
                >
                  Cancel</button
                ><button
                  class="primary"
                  type="submit"
                  :disabled="
                    !!busy ||
                    tripEditLoading ||
                    (!editingId && !tripVesselFares) ||
                    (!!editingId && !tripBookingsLoaded) ||
                    (!!editingId && tripHasBookings && !tripScheduleChanged) ||
                    (!tripHasBookings &&
                      (activePorts.length < 2 || !activeVessels.length))
                  "
                >
                  {{
                    busy
                      ? "Saving…"
                      : editingId
                        ? "Save trip changes"
                        : "Create trip"
                  }}
                </button>
              </div>
            </footer>
          </form>
          <div v-else-if="modal === 'user'" class="account-content">
            <div v-if="createdAccount" class="created account-success">
              <div class="account-success-heading">
                <span
                  ><ion-icon :icon="checkmarkCircleOutline" aria-hidden="true"
                /></span>
                <div>
                  <strong>Ready for their first sign-in</strong>
                  <p>{{ createdAccount.email }}</p>
                </div>
              </div>
              <dl class="account-created-details">
                <div>
                  <dt>Account role</dt>
                  <dd>
                    {{
                      createdAccount.role === "TICKETING"
                        ? "Ticketing staff"
                        : createdAccount.role === "BOARDING"
                          ? "Boarding staff"
                          : "Passenger"
                    }}
                  </dd>
                </div>
              </dl>
              <div class="account-password-block">
                <span>Temporary password</span>
                <div class="account-password-copy">
                  <code>{{ createdAccount.password }}</code
                  ><button
                    type="button"
                    aria-label="Copy temporary password"
                    @click="copyPassword"
                  >
                    {{ accountPasswordCopied ? "Copied" : "Copy" }}
                  </button>
                </div>
              </div>
              <p class="account-hint">
                Share these sign-in details privately with the account holder.
              </p>
              <p
                v-if="accountPasswordCopied"
                class="account-copy-notice"
                role="status"
              >
                Temporary password copied.
              </p>
              <footer class="account-footer">
                <button class="primary" type="button" @click="closeModal">
                  Done
                </button>
              </footer>
            </div>
            <form v-else class="account-form" @submit.prevent="saveUser">
              <div class="account-scroll"><fieldset :disabled="!!busy">
                <div class="account-section-heading">
                  <strong>Account details</strong
                  ><span>All fields are required</span>
                </div>
                <label for="new-user-name"
                  >Full name<input
                    id="new-user-name"
                    v-model.trim="userForm.fullName"
                    required
                    maxlength="120"
                    autocomplete="name"
                    placeholder="Juan Dela Cruz"
                /></label>
                <label for="new-user-email"
                  >Email address<input
                    id="new-user-email"
                    v-model.trim="userForm.email"
                    type="email"
                    required
                    autocomplete="email"
                    placeholder="juan@example.com"
                /></label>
                <label for="new-user-role"
                  >Account role<select
                    id="new-user-role"
                    v-model="userForm.role"
                    aria-label="Account role"
                  >
                    <option value="PASSENGER">Passenger</option>
                    <option value="TICKETING">Ticketing staff</option>
                    <option value="BOARDING">Boarding staff</option>
                  </select></label
                >
                <label for="new-user-password"
                  >Temporary password
                  <div class="account-password-field">
                    <input
                      id="new-user-password"
                      v-model="userForm.password"
                      :type="showTemporaryPassword ? 'text' : 'password'"
                      required
                      minlength="8"
                      autocomplete="new-password"
                      placeholder="At least 8 characters"
                    /><button
                      type="button"
                      class="account-password-visibility"
                      :aria-label="
                        showTemporaryPassword
                          ? 'Hide temporary password'
                          : 'Show temporary password'
                      "
                      @click="showTemporaryPassword = !showTemporaryPassword"
                    >
                      <ion-icon
                        :icon="
                          showTemporaryPassword ? eyeOffOutline : eyeOutline
                        "
                        aria-hidden="true"
                      />
                    </button></div
                ></label>
                <p class="account-role-note">
                  <ion-icon
                    :icon="shieldCheckmarkOutline"
                    aria-hidden="true"
                  /><span>{{
                    userForm.role === "TICKETING"
                      ? "Manage reservations, collect payments, and issue walk-in tickets."
                      : userForm.role === "BOARDING"
                        ? "Check in passengers and manage boarding and trip attendance."
                        : "Book ferry trips and manage personal reservations and tickets."
                  }}</span>
                </p>
                <div class="account-generate">
                  <p>Generate a password or enter one above.</p>
                  <button
                    type="button"
                    :disabled="!!busy"
                    @click="generatePassword"
                  >
                    {{ busy === "password" ? "Generating..." : "Generate" }}
                  </button>
                </div>
                </fieldset></div><footer class="account-footer">
                  <button
                    type="button"
                    class="secondary"
                    :disabled="!!busy"
                    @click="closeModal"
                  >
                    Cancel</button
                  ><button type="submit" class="primary" :disabled="!!busy">
                    {{ busy === "user" ? "Creating..." : "Create account" }}
                  </button>
                </footer>
            </form>
          </div>
        </div></ion-modal
      >
    </ion-content></ion-page
  >
</template>

<script setup lang="ts">
import { paymentMethodLabel } from '../../data/paymentMethod';
import WeatherTripPicker from '../../components/shared/WeatherTripPicker.vue';
import { awaitingPaymentVerification } from '../../data/paymentVerification';
import WorkspacePagination from "../../components/shared/WorkspacePagination.vue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { confirmAction, requestReason } from "../../composables/confirmation";
import { useUnsavedChanges } from "../../composables/unsavedChanges";
import { notificationUnreadCount } from "../../composables/notificationUnread";
import AuditLogsPanel from "../../components/admin/AuditLogsPanel.vue";
import AdminOverviewPanel from "../../components/admin/AdminOverviewPanel.vue";
import AccommodationPanel from "../../components/admin/AccommodationPanel.vue";
import RoutesPanel from "../../components/admin/RoutesPanel.vue";
import {
  routes as savedRoutes,
  type FerryRoute,
} from "../../services/database/workspaces";
import NoShowsPanel from "../../components/admin/NoShowsPanel.vue";
import NotificationsPanel from "../../components/admin/NotificationsPanel.vue";
import RecordsGrid, {
  type RecordGridRow,
} from "../../components/shared/RecordsGrid.vue";
import OperationsPanel from "../../components/admin/OperationsPanel.vue";
import VouchersPanel from "../../components/admin/VouchersPanel.vue";
import AdvisoriesPanel from "../../components/admin/AdvisoriesPanel.vue";
import TripOperationsPanel from "../../components/admin/TripOperationsPanel.vue";
import { useQueueRefresh } from "../../composables/queueRefresh";
import { databaseRequestError } from "../../data/databaseErrors";
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AdminAccountMenu from "../../components/admin/AdminAccountMenu.vue";
import { accountFunction } from "../../services/accountFunctions";
import {
  IonContent,
  IonIcon,
  IonModal,
  IonPage,
  onIonViewWillEnter,
} from "@ionic/vue";
import {
  bedOutline,
  homeOutline,
  briefcaseOutline,
  compassOutline,
  constructOutline,
  walkOutline,
  chatbubblesOutline,
  businessOutline,
  chevronDownOutline,
  clipboardOutline,
  documentTextOutline,
  enterOutline,
  megaphoneOutline,
  navigateOutline,
  optionsOutline,
  personRemoveOutline,
  pricetagsOutline,
  receiptOutline,
  eyeOutline,
  eyeOffOutline,
  checkmarkCircleOutline,
  searchOutline,
  settingsOutline,
  notificationsOutline,
  boatOutline,
  calendarOutline,
  closeOutline,
  gridOutline,
  informationCircleOutline,
  locationOutline,
  lockClosedOutline,
  menuOutline,
  peopleCircleOutline,
  peopleOutline,
  refreshOutline,
  scanOutline,
  shieldCheckmarkOutline,
  ticketOutline,
  timeOutline,
} from "ionicons/icons";
import PortLocationMap from "../../components/shared/PortLocationMap.vue";
import BrandMark from "../../components/shared/BrandMark.vue";
import AdminReportsPanel from "../../components/admin/AdminReportsPanel.vue";
import AdminManifestExport from "../../components/admin/AdminManifestExport.vue";
import InboxPanel from "../../components/admin/InboxPanel.vue";
import {
  adminCancelBooking,
  adminCreatePort,
  adminCreateSailing,
  adminCreateVessel,
  adminDashboardStats,
  adminPassengerRecords,
  adminPorts,
  adminRescheduleSailing,
  adminSailingBookings,
  adminSailings,
  adminSailingOptions,
  adminUpdatePort,
  adminUpdateSailingStatus,
  adminUpdateUnbookedSailing,
  adminUpdateVessel,
  adminUsers,
  adminVessels,
  boardTicket,
  checkInTicket,
  staffBookings,
  type AdminDashboardStatsData,
  type AdminPassengerRecordsData,
  type AdminPortsData,
  type AdminSailingBookingsData,
  type AdminSailingsData,
  type AdminUsersData,
  type AdminVesselsData,
  type StaffBookingsData,
} from "../../services/database/staff";
import { auth, functions, staffDatabase } from "../../services/session";
import {
  adminFareSettings,
  adminNextTripCode,
  adminSaveFareSettings,
} from "../../services/database/staff";
import {
  calculateFares,
  copyFareSettings,
  passengerDiscountError,
  discountFare,
  defaultFareSettings,
  discountTypes,
  passengerTypeCode,
  validFareSettings,
  type FareSettings,
} from "../../data/fareSettings";
import {
  ticketActionBlockReason,
  ticketRequestError,
} from "../../data/ticketActions";
import { accountRequestError } from "../../data/accountErrors";

const fareSettings = reactive({ ...defaultFareSettings });
const vesselFareSettings = ref<Record<string, FareSettings>>({});
const fareDrafts = ref<Record<string, FareSettings>>({});
const selectedFareVesselId = ref("");
const fareSettingsForm = reactive({ ...defaultFareSettings });
const fareSettingsLoaded = ref(false);
const nextTripCode = ref("");
const childEditorRef = ref<{ hasUnsavedChanges?: () => boolean } | null>(null);
const refreshDecision = ref(false);
const settingsFarePreview = computed(() =>
  calculateFares(fareSettingsForm.regularFare, fareSettingsForm),
);

const route = useRoute(),
  router = useRouter();
const section = computed(() => String(route.params.section || "dashboard"));
const isWorkspaceRoute = computed(
  () =>
    route.path === "/admin" ||
    (route.path.startsWith("/admin/") &&
      !route.path.startsWith("/admin/settings")),
);
const menuOpen = ref(false),
  loading = ref(false),
  error = ref(""),
  notice = ref(""),
  busy = ref(""),
  modal = ref(""),
  formError = ref(""),
  editingId = ref("");
const globalSearch = ref("");
const search = ref(String(route.query.search || "")),
  statusFilter = ref("ALL"),
  sailingFilter = ref(String(route.query.sailing || "ALL"));
const reportsRefresh = ref(0);
const routeOptions = ref<FerryRoute[]>([]),
  savedRouteId = ref("");
function useSavedRoute() {
  const selected = routeOptions.value.find((r) => r.id === savedRouteId.value);
  if (!selected) return;
  tripForm.originPortId = selected.originPortId;
  tripForm.destinationPortId = selected.destinationPortId;
  if (tripForm.departureAt) {
    const arrival = new Date(
      new Date(tripForm.departureAt).getTime() +
        selected.durationMinutes * 60000,
    );
    tripForm.arrivalAt = new Date(
      arrival.getTime() - arrival.getTimezoneOffset() * 60000,
    )
      .toISOString()
      .slice(0, 16);
  }
}
watch(section, () => {
  if (!isWorkspaceRoute.value) return;
  recordPage.value = 0;
  search.value = String(route.query.search || "");
  statusFilter.value = "ALL";
  sailingFilter.value = String(route.query.sailing || "ALL");
  menuOpen.value = false;
  void loadData();
});
watch(() => route.query.search, (value) => {
  if (section.value !== "bookings") return;
  recordPage.value = 0;
  search.value = String(value || "");
});
const bookings = ref<StaffBookingsData["bookings"]>([]),
  sailings = ref<AdminSailingsData["sailings"]>([]),
  users = ref<AdminUsersData["users"]>([]),
  passengers = ref<AdminPassengerRecordsData["bookingPassengers"]>([]),
  ports = ref<AdminPortsData["ports"]>([]),
  vessels = ref<AdminVesselsData["vessels"]>([]),
  stats = ref<AdminDashboardStatsData | null>(null);
const sailingOptions = ref<AdminSailingsData["sailings"]>([]);
const navigation = [
  {
    label: "OVERVIEW",
    icon: homeOutline,
    items: [{ key: "dashboard", label: "Dashboard", icon: gridOutline }],
  },
  {
    label: "WORKSPACE",
    icon: briefcaseOutline,
    items: [
      { key: "bookings", label: "Bookings", icon: ticketOutline },
      { key: "passengers", label: "Passengers", icon: peopleOutline },
    ],
  },
  {
    label: "FERRY OPERATIONS",
    icon: compassOutline,
    items: [
      { key: "trips", label: "Trips & schedules", icon: calendarOutline },
      {
        key: "trip-operations",
        label: "Trip operations",
        icon: optionsOutline,
      },
    ],
  },
  {
    label: "FLEET SETUP",
    icon: constructOutline,
    items: [
      { key: "fares", label: "Fares & discounts", icon: pricetagsOutline },
      { key: "vouchers", label: "Vouchers", icon: pricetagsOutline },
      { key: "ports", label: "Ports", icon: locationOutline },
      { key: "routes", label: "Routes", icon: navigateOutline },
      { key: "accommodation", label: "Accommodation", icon: bedOutline },
      { key: "vessels", label: "Vessels", icon: boatOutline },
    ],
  },
  {
    label: "PASSENGER OPERATIONS",
    icon: walkOutline,
    items: [
      { key: "check-in", label: "Check-in", icon: scanOutline },
      { key: "boarding", label: "Boarding", icon: enterOutline },
      { key: "manifest", label: "Passenger manifest", icon: clipboardOutline },
      { key: "no-shows", label: "No-shows", icon: personRemoveOutline },
    ],
  },
  {
    label: "COMMUNICATION",
    icon: chatbubblesOutline,
    items: [
      { key: "advisories", label: "Travel advisories", icon: megaphoneOutline },
      {
        key: "notifications",
        label: "Broadcasts",
        icon: notificationsOutline,
      },
    ],
  },
  {
    label: "MANAGEMENT",
    icon: businessOutline,
    items: [
      { key: "reports", label: "Reports", icon: documentTextOutline },
      { key: "users", label: "Users", icon: peopleCircleOutline },
      { key: "audit-logs", label: "Audit logs", icon: receiptOutline },
      {
        key: "operations",
        label: "Reservation settings",
        icon: settingsOutline,
      },
    ],
  },
];
const expandedNavigation = ref("");
watch(section, (value) => {
  expandedNavigation.value = navigation.find(group =>
    group.items.some(item => item.key === value) ||
    (value === "inbox" && group.label === "COMMUNICATION")
  )?.label || "OVERVIEW";
}, { immediate: true });
const recordPage = ref(0);
const recordTotal = ref(0);
const pageSize = 30;
const pages: Record<
  string,
  { group: string; title: string; description: string; table: string }
> = {
  accommodation: {
    group: "FERRY OPERATIONS",
    title: "Accommodation",
    description: "Manage vessel classes, capacity, and additional fares.",
    table: "",
  },
  routes: {
    group: "FERRY OPERATIONS",
    title: "Routes",
    description: "Manage ferry routes between active ports.",
    table: "",
  },
  "no-shows": {
    group: "PASSENGER OPERATIONS",
    title: "No-shows",
    description: "Review attendance after completed sailings.",
    table: "",
  },
  notifications: {
    group: "COMMUNICATION",
    title: "Broadcasts",
    description: "Send updates to passenger and staff inboxes.",
    table: "",
  },
  inbox: { group: "COMMUNICATION", title: "Notifications", description: "Read notifications addressed to your account.", table: "" },
  analytics: {
    group: "MANAGEMENT",
    title: "Analytics",
    description: "Passenger volume, booking status, and route activity.",
    table: "",
  },
  advisories: {
    group: "COMMUNICATION",
    title: "Travel advisories",
    description: "Publish timely updates for passengers.",
    table: "",
  },
  "trip-operations": {
    group: "FERRY OPERATIONS",
    title: "Sailing workspace",
    description:
      "Bookings, boarding, manifest and no-show reconciliation by trip.",
    table: "",
  },
  dashboard: {
    group: "OVERVIEW",
    title: "Dashboard",
    description: "Overview of today's ferry operations.",
    table: "",
  },
  bookings: {
    group: "WORKSPACE",
    title: "Booking management",
    description: "Review reservations and cancel eligible unpaid bookings.",
    table: "Recent bookings",
  },
  passengers: {
    group: "WORKSPACE",
    title: "Passenger management",
    description: "Passenger tickets and booking accounts.",
    table: "Passenger directory",
  },
  trips: {
    group: "FERRY OPERATIONS",
    title: "Trips & schedules",
    description: "Schedule sailings and update their departure status.",
    table: "Sailing schedule",
  },
  vouchers: { group: "WORKSPACE", title: "Vouchers", description: "Manage booking promo codes and usage limits.", table: "" },
  fares: {
    group: "FERRY OPERATIONS",
    title: "Fares & discounts",
    description:
      "Manage regular fares and automatic passenger discounts for each vessel.",
    table: "",
  },
  ports: {
    group: "FERRY OPERATIONS",
    title: "Ports",
    description: "Manage ports available for new sailings.",
    table: "Port directory",
  },
  vessels: {
    group: "FERRY OPERATIONS",
    title: "Vessels",
    description: "Manage fleet details and availability.",
    table: "Fleet directory",
  },
  "check-in": {
    group: "PASSENGER OPERATIONS",
    title: "Check-in",
    description: "Check in issued tickets for confirmed reservations.",
    table: "Ticket check-in",
  },
  boarding: {
    group: "PASSENGER OPERATIONS",
    title: "Boarding",
    description: "Board passengers after check-in.",
    table: "Boarding queue",
  },
  manifest: {
    group: "PASSENGER OPERATIONS",
    title: "Passenger manifest",
    description:
      "View and download paid passenger manifests by sailing.",
    table: "Passenger manifest",
  },
  reports: {
    group: "INSIGHTS",
    title: "Reports & analytics",
    description:
      "Explore collections, bookings, and sailing performance by date, route, and vessel.",
    table: "Sailing performance",
  },
  "audit-logs": {
    group: "MANAGEMENT",
    title: "Audit logs",
    description:
      "Find operational changes by person, action, and date across all records.",
    table: "",
  },
  operations: {
    group: "MANAGEMENT",
    title: "Reservation settings",
    description: "Set payment deadlines for new reservations.",
    table: "",
  },
  users: {
    group: "MANAGEMENT",
    title: "User management",
    description: "Create passenger and staff accounts.",
    table: "System users",
  },
};
const page = computed(() => pages[section.value] || pages.dashboard);
const primaryAction = computed(
  () =>
    (
      ({
        trips: "Create trip",
        ports: "Add port",
        vessels: "Add vessel",
        users: "Add user",
      }) as Record<string, string>
    )[section.value] || "",
);
const localDayBounds = () => {
  const day = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });
  const start = new Date(`${day}T00:00:00+08:00`);
  return {
    dayStart: start.toISOString(),
    dayEnd: new Date(start.getTime() + 86400000).toISOString(),
  };
};
const dateTime = (value: string) =>
  new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
const routeLabel = (s: AdminSailingsData["sailings"][number]) =>
  `${s.origin.name} → ${s.destination.name}`;
let loadRequest = 0;
let bookingSearchTimer: ReturnType<typeof setTimeout> | undefined;
function bookingStatusFilter() {
  return (
    (
      {
        "AWAITING PAYMENT": "UNPAID",
        "REFUND PENDING": "REFUND_PENDING",
      } as Record<string, string>
    )[statusFilter.value] || statusFilter.value
  );
}
watch([search, statusFilter, sailingFilter], () => {
  if (!["bookings", "trips", "users", "passengers", "check-in", "boarding", "manifest"].includes(section.value) || !isWorkspaceRoute.value) return;
  recordPage.value = 0;
  if (bookingSearchTimer) clearTimeout(bookingSearchTimer);
  bookingSearchTimer = setTimeout(() => {
    void loadData();
  }, 300);
});
onBeforeUnmount(() => {
  loadRequest++;
  if (bookingSearchTimer) clearTimeout(bookingSearchTimer);
});
async function loadData() {
  if (refreshDecision.value) return;
  if (childEditorRef.value?.hasUnsavedChanges?.()) {
    refreshDecision.value = true;
    try {
      if (!(await confirmAction({ title: "Refresh and discard changes?", message: "Refreshing will replace the unsaved changes in this editor.", confirmText: "Discard and refresh" }))) return;
    } finally { refreshDecision.value = false; }
  }
  const request = ++loadRequest;
  if (
    isWorkspaceRoute.value &&
    [
      "dashboard",
      "analytics",
      "accommodation",
      "routes",
      "no-shows",
      "notifications",
      "inbox",
      "reports",
      "operations",
      "audit-logs",
      "advisories",
      "trip-operations",
      "vouchers",
    ].includes(section.value)
  ) {
    error.value = "";
    notice.value = "";
    reportsRefresh.value++;
    return;
  }
  if (!isWorkspaceRoute.value) return;
  if (!staffDatabase) {
    error.value = "Supabase is not configured.";
    return;
  }
  loading.value = true;
  error.value = "";
  const dc = staffDatabase;
  fareSettingsLoaded.value = false;
  nextTripCode.value = "";
  const results = await Promise.allSettled([
    staffBookings(dc, {
      fetchPolicy: "SERVER_ONLY",
      page: recordPage.value,
      pageSize,
      ...(section.value === "bookings"
        ? { search: search.value, status: bookingStatusFilter() }
        : {}),
    }),
    adminSailings(dc, {
      fetchPolicy: "SERVER_ONLY",
      page: recordPage.value,
      pageSize,
      ...(section.value === "trips" ? { search: search.value, status: statusFilter.value } : {}),
    }),
    adminUsers(dc, {
      fetchPolicy: "SERVER_ONLY",
      page: recordPage.value,
      pageSize,
      ...(section.value === "users" ? { search: search.value, status: statusFilter.value } : {}),
    }),
    adminPorts(dc, { fetchPolicy: "SERVER_ONLY" }),
    adminVessels(dc, { fetchPolicy: "SERVER_ONLY" }),
    adminPassengerRecords(dc, {
      fetchPolicy: "SERVER_ONLY",
      page: recordPage.value,
      pageSize,
      search: ["passengers", "check-in", "boarding", "manifest"].includes(section.value) ? search.value : "",
      status: ["passengers", "check-in", "boarding"].includes(section.value) ? statusFilter.value : "ALL",
      sailingCode: sailingFilter.value,
      paidOnly: ["check-in", "boarding", "manifest"].includes(section.value),
    }),
    adminDashboardStats(dc, localDayBounds(), { fetchPolicy: "SERVER_ONLY" }),
    adminFareSettings(dc, { fetchPolicy: "SERVER_ONLY" }),
    adminNextTripCode(dc, { fetchPolicy: "SERVER_ONLY" }),
    section.value === "trips"
      ? savedRoutes(dc)
      : Promise.resolve({ data: { routes: [] as FerryRoute[] } }),
  ] as const);
  if (["check-in", "boarding", "manifest"].includes(section.value)) {
    try { sailingOptions.value = (await adminSailingOptions(dc)).data.sailings; }
    catch { error.value = "Could not load sailing choices. Refresh to retry."; }
  }
  if (request !== loadRequest || !isWorkspaceRoute.value) return;
  const failed: string[] = [];
  recordTotal.value = Number(
    (section.value === "bookings"
      ? results[0]
      : section.value === "trips"
        ? results[1]
        : section.value === "users"
          ? results[2]
          : results[5]
    ).status === "fulfilled"
      ? (
          (section.value === "bookings"
            ? results[0]
            : section.value === "trips"
              ? results[1]
              : section.value === "users"
                ? results[2]
                : results[5]) as any
        ).value.data.totalCount || 0
      : 0,
  );
  const names = [
    "Bookings",
    "Trips",
    "Users",
    "Ports",
    "Vessels",
    "Passengers",
    "Dashboard",
    "Fares & discounts",
    "Trip code",
    "Saved routes",
  ];
  results.forEach((result, index) => {
    if (result.status === "rejected") failed.push(names[index]);
  });
  const [b, s, u, p, v, a, d, f, c, routeResult] = results;
  if (section.value === 'ports') recordTotal.value = p.status === 'fulfilled' ? p.value.data.ports.length : 0;
  if (section.value === 'vessels') recordTotal.value = v.status === 'fulfilled' ? v.value.data.vessels.length : 0;
  if (routeResult.status === "fulfilled")
    routeOptions.value = routeResult.value.data.routes.filter(
      (r) => r.isActive,
    );
  if (c.status === "fulfilled") {
    const preview = c.value.data.nextTripCode;
    if (
      preview &&
      typeof preview === "object" &&
      "code" in preview &&
      typeof preview.code === "string" &&
      /^TRP\d{4}-\d{4}\d{3,}$/.test(preview.code)
    )
      nextTripCode.value = preview.code;
  }
  if (b.status === "fulfilled") bookings.value = b.value.data.bookings;
  if (s.status === "fulfilled") sailings.value = s.value.data.sailings;
  if (u.status === "fulfilled") users.value = u.value.data.users;
  if (p.status === "fulfilled") ports.value = p.value.data.ports;
  if (v.status === "fulfilled") vessels.value = v.value.data.vessels;
  if (a.status === "fulfilled")
    passengers.value = a.value.data.bookingPassengers;
  if (d.status === "fulfilled") stats.value = d.value.data;
  if (f.status === "fulfilled") {
    Object.assign(
      fareSettings,
      f.value.data.fareSettings || defaultFareSettings,
    );
    vesselFareSettings.value = Object.fromEntries(
      f.value.data.vesselFareSettings.map((item) => {
        const { code, ...settings } = item;
        return [code, settings];
      }),
    );
    fareDrafts.value = {};
    if (
      !vessels.value.some(
        (v) => v.id === selectedFareVesselId.value && v.isActive,
      )
    )
      selectedFareVesselId.value =
        vessels.value.find((v) => v.isActive)?.id || "";
    Object.assign(
      fareSettingsForm,
      copyFareSettings({
        ...defaultFareSettings,
        ...(vesselFareSettings.value[selectedFareVesselId.value] ||
          fareSettings),
      }),
    );
    fareSettingsLoaded.value = true;
  }
  if (failed.length)
    error.value = `Could not refresh ${failed.join(", ")}. Other admin records remain available. Try Refresh.`;
  loading.value = false;
}
onIonViewWillEnter(() => {
  if (isWorkspaceRoute.value) void loadData();
});
useQueueRefresh(
  loadData,
  () =>
    isWorkspaceRoute.value &&
    ![
      "dashboard",
      "analytics",
      "accommodation",
      "routes",
      "no-shows",
      "notifications",
      "inbox",
      "reports",
      "operations",
      "audit-logs",
      "fares",
      "vouchers",
      "advisories",
      "trip-operations",
    ].includes(section.value) &&
    !busy.value &&
    !loading.value &&
    !modal.value,
);
const activePorts = computed(() => ports.value.filter((p) => p.isActive)),
  activeVessels = computed(() => vessels.value.filter((v) => v.isActive));
const selectedFareVessel = computed(() =>
  activeVessels.value.find((v) => v.id === selectedFareVesselId.value),
);
const selectedVesselHasFares = computed(
  () => !!vesselFareSettings.value[selectedFareVesselId.value],
);
watch(
  selectedFareVesselId,
  (vesselId, previousId) => {
    if (previousId && fareSettingsLoaded.value)
      fareDrafts.value[previousId] = copyFareSettings(fareSettingsForm);
    Object.assign(
      fareSettingsForm,
      copyFareSettings({
        ...defaultFareSettings,
        ...(fareDrafts.value[vesselId] ||
          vesselFareSettings.value[vesselId] ||
          fareSettings),
      }),
    );
  },
  { flush: "sync" },
);
const portForm = reactive({
  code: "",
  name: "",
  city: "",
  region: "",
  isActive: true,
});
const vesselForm = reactive({
  code: "",
  name: "",
  capacity: 100,
  isActive: true,
});
const tripForm = reactive({
  code: "",
  originPortId: "",
  destinationPortId: "",
  vesselId: "",
  departureAt: "",
  arrivalAt: "",
  regularFare: 500,
  studentFare: 400,
  seniorFare: 400,
  childFare: 400,
  pwdFare: 400,
  pregnantFare: 500,
});
const tripVesselFares = computed(() =>
  fareSettingsLoaded.value
    ? vesselFareSettings.value[tripForm.vesselId]
    : undefined,
);
const selectedTripVessel = computed(() =>
  vessels.value.find((v) => v.id === tripForm.vesselId),
);
const tripDurationLabel = computed(() => {
  const minutes = Math.round(
    (new Date(tripForm.arrivalAt).getTime() -
      new Date(tripForm.departureAt).getTime()) /
      60000,
  );
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  const hours = Math.floor(minutes / 60),
    remainder = minutes % 60;
  return `Estimated travel time: ${hours ? `${hours}h` : ""}${hours && remainder ? " " : ""}${remainder ? `${remainder}m` : ""}`;
});
const tripBookings = ref<AdminSailingBookingsData["bookings"]>([]);
const tripEditLoading = ref(false);
const tripBookingsLoaded = ref(false);
const tripHasBookings = computed(() => tripBookings.value.length > 0);
const tripFieldsLocked = computed(
  () =>
    !!editingId.value &&
    (tripEditLoading.value ||
      !tripBookingsLoaded.value ||
      tripHasBookings.value),
);
const editingTrip = computed(() =>
  sailings.value.find((item) => item.code === editingId.value),
);
const dynamicTripDiscounts = computed(() => {
  if (editingId.value && editingTrip.value?.vessel.id === tripForm.vesselId)
    return editingTrip.value.passengerDiscounts ?? null;
  return (
    tripVesselFares.value?.passengerDiscounts
      ?.filter((d) => d.isActive)
      .map((d) => ({
        ...d,
        fare: discountFare(tripForm.regularFare, d.percentage),
      })) ?? null
  );
});
const tripScheduleChanged = computed(
  () =>
    !editingTrip.value ||
    tripForm.departureAt !== toLocalDateTime(editingTrip.value.departureAt) ||
    tripForm.arrivalAt !== toLocalDateTime(editingTrip.value.arrivalAt),
);
const fareTypes = [
  { key: "regularFare", label: "Regular" },
  { key: "studentFare", label: "Student" },
  { key: "seniorFare", label: "Senior" },
  { key: "childFare", label: "Child" },
  { key: "pwdFare", label: "PWD" },
  { key: "pregnantFare", label: "Pregnant" },
] as const;
watch(
  () => tripForm.regularFare,
  () => {
    if (
      modal.value === "trip" &&
      !tripFieldsLocked.value &&
      tripVesselFares.value
    )
      Object.assign(
        tripForm,
        calculateFares(tripForm.regularFare, tripVesselFares.value),
      );
  },
  { flush: "sync" },
);
watch(
  () => tripForm.vesselId,
  () => {
    if (modal.value !== "trip" || tripFieldsLocked.value) return;
    const settings = tripVesselFares.value;
    Object.assign(
      tripForm,
      settings
        ? calculateFares(settings.regularFare, settings)
        : {
            regularFare: 0,
            studentFare: 0,
            seniorFare: 0,
            childFare: 0,
            pwdFare: 0,
            pregnantFare: 0,
          },
    );
  },
  { flush: "sync" },
);
function addCustomDiscount() {
  const discounts = (fareSettingsForm.passengerDiscounts ||= []);
  if (discounts.length < 20)
    discounts.push({
      id: crypto.randomUUID(),
      name: "",
      percentage: 10,
      isActive: true,
    });
}
async function saveFareSettings() {
  const dc = staffDatabase;
  if (
    !dc ||
    busy.value ||
    !fareSettingsLoaded.value ||
    !selectedFareVessel.value
  )
    return;
  if (!validFareSettings(fareSettingsForm)) {
    error.value =
      passengerDiscountError(fareSettingsForm.passengerDiscounts) ||
      "Enter a positive whole-peso regular fare and whole-number discounts from 0 to 99%.";
    return;
  }
  busy.value = "fares";
  error.value = "";
  notice.value = "";
  try {
    const vesselId = selectedFareVesselId.value;
    const settings = copyFareSettings(fareSettingsForm);
    for (const type of discountTypes)
      settings[type.key] =
        settings.passengerDiscounts?.find(
          (d) =>
            d.isActive &&
            passengerTypeCode(d.name) ===
              passengerTypeCode(
                type.key === "pregnantDiscount" ? "Pregnant" : type.label,
              ),
        )?.percentage ?? 0;
    await adminSaveFareSettings(dc, { vesselId, ...settings });
    vesselFareSettings.value[vesselId] = settings;
    fareDrafts.value[vesselId] = settings;
    notice.value = `Fares & discounts saved for ${selectedFareVessel.value.name}. New trips for this vessel will use these rates.`;
  } catch (cause) {
    error.value = databaseRequestError(cause, "Could not save fare settings.");
  } finally {
    busy.value = "";
  }
}
const userRoleLabel = (value: string) => ({ PASSENGER: 'Passenger', TICKETING: 'Ticketing staff', BOARDING: 'Boarding staff', ADMIN: 'Administrator' }[value] || value);
const userInitials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() || 'U';
const userForm = reactive({
  fullName: "",
  email: "",
  role: "PASSENGER",
  password: "",
});
const editorSnapshot = () => JSON.stringify({ port: portForm, vessel: vesselForm, trip: tripForm, user: userForm });
let editorBaseline = editorSnapshot();
watch(modal, () => { editorBaseline = editorSnapshot(); }, { flush: "post" });
const editorDirty = () => !!modal.value && !createdAccount.value && editorSnapshot() !== editorBaseline;
useUnsavedChanges(() => editorDirty() || (section.value === "fares" && fareSettingsLoaded.value && !!selectedFareVesselId.value &&
  JSON.stringify(copyFareSettings(fareSettingsForm)) !== JSON.stringify(copyFareSettings({ ...defaultFareSettings, ...(vesselFareSettings.value[selectedFareVesselId.value] || fareSettings) }))));
const showTemporaryPassword = ref(false),
  accountPasswordCopied = ref(false);
const createdAccount = ref<{
  email: string;
  role: string;
  password: string;
} | null>(null);
const modalTitle = computed(
  () =>
    (
      ({
        trip: editingId.value ? "Edit sailing" : "Create a sailing",
        port: editingId.value ? "Edit port" : "Add port",
        vessel: editingId.value ? "Edit vessel" : "Add vessel",
        user: createdAccount.value ? "Account created" : "Create an account",
      }) as Record<string, string>
    )[modal.value] || "",
);
function openAction() {
  formError.value = "";
  editingId.value = "";
  modal.value =
    (
      {
        trips: "trip",
        ports: "port",
        vessels: "vessel",
        users: "user",
      } as Record<string, string>
    )[section.value] || "";
  if (modal.value === "port")
    Object.assign(portForm, {
      code: "",
      name: "",
      city: "",
      region: "",
      isActive: true,
    });
  if (modal.value === "vessel")
    Object.assign(vesselForm, {
      code: "",
      name: "",
      capacity: 100,
      isActive: true,
    });
  if (modal.value === "trip") {
    if (!fareSettingsLoaded.value) {
      modal.value = "";
      error.value = "Refresh fare settings before creating a trip.";
      return;
    }
    if (!nextTripCode.value) {
      modal.value = "";
      error.value = "Refresh the trip code before creating a trip.";
      return;
    }
    tripBookings.value = [];
    tripBookingsLoaded.value = true;
    Object.assign(tripForm, {
      code: nextTripCode.value,
      originPortId: "",
      destinationPortId: "",
      vesselId: "",
      departureAt: "",
      arrivalAt: "",
      regularFare: 0,
      studentFare: 0,
      seniorFare: 0,
      childFare: 0,
      pwdFare: 0,
      pregnantFare: 0,
    });
  }
  if (modal.value === "user") {
    showTemporaryPassword.value = false;
    accountPasswordCopied.value = false;
    Object.assign(userForm, {
      fullName: "",
      email: "",
      role: "PASSENGER",
      password: "",
    });
    createdAccount.value = null;
  }
}
async function closeModal() {
  if (busy.value) return;
  if (!(await canDismissEditor())) return;
  resetModal();
}
async function canDismissEditor() {
  if (!modal.value) return true;
  if (busy.value) return false;
  return !editorDirty() || await confirmAction({ title: "Discard changes?", message: "The changes in this editor have not been saved.", confirmText: "Discard changes" });
}
function resetModal() {
  modal.value = "";
  formError.value = "";
  createdAccount.value = null;
}
function editRecord(
  record: AdminPortsData["ports"][number] | AdminVesselsData["vessels"][number],
) {
  editingId.value = record.id;
  formError.value = "";
  if (section.value === "ports" && "city" in record) {
    Object.assign(portForm, {
      code: record.code,
      name: record.name,
      city: record.city,
      region: record.region || "",
      isActive: record.isActive,
    });
    modal.value = "port";
  }
  if (section.value === "vessels" && "passengerCapacity" in record) {
    Object.assign(vesselForm, {
      code: record.code,
      name: record.name,
      capacity: record.passengerCapacity,
      isActive: record.isActive,
    });
    modal.value = "vessel";
  }
}
async function mutate(label: string, work: () => Promise<unknown>) {
  busy.value = label;
  formError.value = "";
  error.value = "";
  try {
    await work();
    modal.value = "";
    notice.value = "Saved successfully.";
    await loadData();
  } catch (e) {
    const message = databaseRequestError(e, "Could not save changes.");
    if (modal.value) formError.value = message;
    else error.value = message;
  } finally {
    busy.value = "";
  }
}
async function cancelBooking(b: StaffBookingsData["bookings"][number]) {
  const dc = staffDatabase;
  if (
    !dc ||
    !["PENDING", "CONFIRMED"].includes(b.status) ||
    b.paymentStatus !== "UNPAID"
  )
    return;
  if (new Date(b.sailing.departureAt) <= new Date()) {
    error.value = "Departed sailings cannot be cancelled.";
    return;
  }
  if (
    !(await confirmAction({
      title: "Cancel reservation?",
      message: `Cancel unpaid reservation ${b.reference} and return ${b.passengerCount} seat(s)?`,
      confirmText: "Cancel reservation",
      danger: true,
    }))
  )
    return;
  await mutate(b.reference, () =>
    adminCancelBooking(dc, {
      bookingId: b.id,
      sailingCode: b.sailing.code,
      passengerCount: b.passengerCount,
    }),
  );
}
async function savePort() {
  const dc = staffDatabase;
  if (!dc) return;
  const code = portForm.code.trim().toUpperCase();
  if (!code || !portForm.name.trim() || !portForm.city.trim()) {
    formError.value = "Complete the port code, name, and city.";
    return;
  }
  await mutate("port", () =>
    editingId.value
      ? adminUpdatePort(dc, {
          id: editingId.value,
          name: portForm.name,
          city: portForm.city,
          region: portForm.region || null,
          isActive: portForm.isActive,
        })
      : adminCreatePort(dc, {
          code,
          name: portForm.name,
          city: portForm.city,
          region: portForm.region || null,
        }),
  );
}
async function saveVessel() {
  const dc = staffDatabase;
  if (!dc) return;
  const code = vesselForm.code.trim().toUpperCase();
  if (
    !code ||
    !vesselForm.name.trim() ||
    !Number.isInteger(vesselForm.capacity) ||
    vesselForm.capacity < 1
  ) {
    formError.value = "Enter a code, name, and valid capacity.";
    return;
  }
  const associated = sailings.value.filter(
    (s) => s.vessel.name === vesselForm.name,
  );
  if (
    editingId.value &&
    associated.some(
      (s) =>
        s.vessel.passengerCapacity - s.availableSeats > vesselForm.capacity,
    )
  ) {
    formError.value = "Capacity cannot be below seats already booked.";
    return;
  }
  await mutate("vessel", () =>
    editingId.value
      ? adminUpdateVessel(dc, {
          id: editingId.value,
          name: vesselForm.name,
          capacity: vesselForm.capacity,
          isActive: vesselForm.isActive,
        })
      : adminCreateVessel(dc, {
          code,
          name: vesselForm.name,
          capacity: vesselForm.capacity,
        }),
  );
}
function toLocalDateTime(value: string) {
  const date = new Date(value);
  const part = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
}
function canEditTrip(sailing: AdminSailingsData["sailings"][number]) {
  return sailing.status === "SCHEDULED" || sailing.status === "DELAYED";
}
function nextStatuses(sailing: AdminSailingsData["sailings"][number]) {
  const options: Record<string, string[]> = {
    SCHEDULED: ["BOARDING", "DELAYED", "CANCELLED"],
    DELAYED: ["SCHEDULED", "BOARDING", "CANCELLED"],
    BOARDING: ["COMPLETED", "CANCELLED"],
  };
  return [sailing.status, ...(options[sailing.status] || [])];
}
async function openTripEditor(sailing: AdminSailingsData["sailings"][number]) {
  if (!canEditTrip(sailing) || !staffDatabase) return;
  editingId.value = sailing.code;
  formError.value = "";
  tripBookings.value = [];
  tripBookingsLoaded.value = false;
  tripEditLoading.value = true;
  Object.assign(tripForm, {
    code: sailing.code,
    originPortId: sailing.origin.id,
    destinationPortId: sailing.destination.id,
    vesselId: sailing.vessel.id,
    departureAt: toLocalDateTime(sailing.departureAt),
    arrivalAt: toLocalDateTime(sailing.arrivalAt),
    regularFare: sailing.regularFare,
    studentFare: sailing.studentFare,
    seniorFare: sailing.seniorFare,
    childFare: sailing.childFare,
    pregnantFare: sailing.pregnantFare ?? sailing.regularFare,
    pwdFare: sailing.pwdFare,
  });
  modal.value = "trip";
  try {
    const result = await adminSailingBookings(
      staffDatabase,
      { code: sailing.code },
      { fetchPolicy: "SERVER_ONLY" },
    );
    if (editingId.value !== sailing.code || modal.value !== "trip") return;
    tripBookings.value = result.data.bookings;
    tripBookingsLoaded.value = true;
  } catch (cause) {
    formError.value = databaseRequestError(
      cause,
      "Could not check reservations. Close and try again.",
    );
  } finally {
    tripEditLoading.value = false;
  }
}
async function saveTrip() {
  const dc = staffDatabase;
  if (!dc || busy.value || (editingId.value && !tripBookingsLoaded.value))
    return;
  if (
    (!editingId.value ||
      (editingTrip.value &&
        tripForm.vesselId !== editingTrip.value.vessel.id)) &&
    !tripVesselFares.value
  ) {
    formError.value =
      "Save fare settings for the selected vessel before creating or switching a trip.";
    return;
  }
  const departure = new Date(tripForm.departureAt),
    arrival = new Date(tripForm.arrivalAt);
  const valid =
    tripForm.code.trim() &&
    tripForm.originPortId &&
    tripForm.destinationPortId &&
    tripForm.vesselId &&
    tripForm.originPortId !== tripForm.destinationPortId &&
    Number.isFinite(departure.getTime()) &&
    Number.isFinite(arrival.getTime()) &&
    departure > new Date() &&
    arrival > departure &&
    fareTypes.every(
      (type) =>
        Number.isSafeInteger(tripForm[type.key]) &&
        tripForm[type.key] > 0 &&
        tripForm[type.key] <= 2147483647,
    );
  if (!valid) {
    formError.value =
      "Choose different ports, an active vessel, future departure and later arrival, and positive fares.";
    return;
  }
  if (editingId.value && tripHasBookings.value && !tripScheduleChanged.value) {
    formError.value =
      "Change the departure or arrival time before rescheduling.";
    return;
  }
  const schedule = {
    code: tripForm.code.trim().toUpperCase(),
    departureAt: departure.toISOString(),
    arrivalAt: arrival.toISOString(),
    durationMinutes: Math.round(
      (arrival.getTime() - departure.getTime()) / 60000,
    ),
  };
  if (
    editingId.value &&
    tripHasBookings.value &&
    !(await confirmAction({
      title: "Update sailing schedule?",
      message: `Reschedule ${schedule.code}? Account holders will receive a notification. Contact walk-in passengers directly.`,
      confirmText: "Save schedule",
      danger: false,
    }))
  )
    return;
  busy.value = "trip";
  formError.value = "";
  error.value = "";
  notice.value = "";
  try {
    if (!editingId.value) {
      const result = await adminCreateSailing(dc, {
        ...schedule,
        originPortId: tripForm.originPortId,
        destinationPortId: tripForm.destinationPortId,
        vesselId: tripForm.vesselId,
        regularFare: tripForm.regularFare,
        studentFare: tripForm.studentFare,
        seniorFare: tripForm.seniorFare,
        childFare: tripForm.childFare,
        pwdFare: tripForm.pwdFare,
        pregnantFare: tripForm.pregnantFare,
      });
      notice.value = `${result.data.sailing_insert.code} created.`;
    } else if (tripHasBookings.value) {
      const result = await adminRescheduleSailing(dc, schedule);
      if (!result.data.sailing_update)
        throw new Error("The sailing was not updated.");
      notice.value = `${schedule.code} rescheduled. ${result.data.notified} account(s) notified.`;
    } else {
      const result = await adminUpdateUnbookedSailing(dc, {
        ...schedule,
        originPortId: tripForm.originPortId,
        destinationPortId: tripForm.destinationPortId,
        vesselId: tripForm.vesselId,
        regularFare: tripForm.regularFare,
        studentFare: tripForm.studentFare,
        seniorFare: tripForm.seniorFare,
        childFare: tripForm.childFare,
        pwdFare: tripForm.pwdFare,
        pregnantFare: tripForm.pregnantFare,
      });
      if (!result.data.sailing_update)
        throw new Error("The sailing was not updated.");
      notice.value = `${schedule.code} updated.`;
    }
    modal.value = "";
    await loadData();
  } catch (cause) {
    formError.value = databaseRequestError(cause, "Could not save this trip.");
  } finally {
    busy.value = "";
  }
}
const sailingStatuses = [
  "SCHEDULED",
  "BOARDING",
  "DELAYED",
  "COMPLETED",
  "CANCELLED",
];
async function changeSailingStatus(
  s: AdminSailingsData["sailings"][number],
  event: Event,
) {
  const dc = staffDatabase;
  if (!dc) return;
  const select = event.target as HTMLSelectElement;
  const status = select.value;
  let reason: string | undefined;
  if (status === "CANCELLED") {
    reason =
      (await requestReason({
        title: "Cancel sailing?",
        message:
          "Explain why this trip is being cancelled. Paid bookings will require a cash refund.",
      })) || undefined;
    if (!reason) {
      select.value = s.status;
      return;
    }
  }
  if (status === s.status) return;
  if (
    !(await confirmAction({
      title:
        status === "CANCELLED" ? "Cancel sailing?" : "Update sailing status?",
      message: `Set ${s.code} to ${status.toLowerCase().replaceAll("_", " ")}? Account holders with active bookings will receive a notification. Contact walk-in passengers directly.`,
      confirmText: status === "CANCELLED" ? "Cancel sailing" : "Update status",
      danger: status === "CANCELLED",
    }))
  ) {
    select.value = s.status;
    return;
  }
  busy.value = s.code;
  error.value = "";
  notice.value = "";
  try {
    const result = await adminUpdateSailingStatus(dc, {
      code: s.code,
      status,
      reason,
    });
    if (!result.data.sailing_update)
      throw new Error("The trip was not updated.");
    const refreshed = await adminSailings(dc, {
      fetchPolicy: "SERVER_ONLY",
      page: recordPage.value,
      pageSize,
    });
    sailings.value = refreshed.data.sailings;
    await loadData();
    notice.value = `${s.code} status changed to ${status}. ${result.data.notified ?? 0} account(s) notified.`;
  } catch (e) {
    select.value = s.status;
    error.value = databaseRequestError(e, "Could not update the trip.");
  } finally {
    busy.value = "";
  }
}
async function processTicket(
  p: AdminPassengerRecordsData["bookingPassengers"][number],
  action: "check-in" | "boarding",
) {
  const dc = staffDatabase;
  if (!dc || busy.value) return;
  const reason = ticketActionBlockReason(p, action);
  if (reason) {
    error.value = reason;
    return;
  }
  if (
    !(await confirmAction({
      title: action === "check-in" ? "Check in passenger?" : "Board passenger?",
      message: `${action === "check-in" ? "Check in" : "Board"} ${p.fullName} for ${p.booking.sailing.code}?`,
      confirmText:
        action === "check-in" ? "Check in passenger" : "Board passenger",
      danger: false,
    }))
  )
    return;
  busy.value = p.id;
  error.value = "";
  notice.value = "";
  try {
    if (action === "check-in") await checkInTicket(dc, { passengerId: p.id });
    else await boardTicket(dc, { passengerId: p.id });
    await loadData();
    notice.value = `${p.fullName} ${action === "check-in" ? "checked in" : "boarded"} for ${p.booking.sailing.code}.`;
  } catch (cause) {
    const message = ticketRequestError(
      cause,
      "The ticket or sailing has changed. Refresh and check the ticket, payment, and sailing status before trying again.",
    );
    await loadData();
    error.value = message;
  } finally {
    busy.value = "";
  }
}
async function generatePassword() {
  if (busy.value) return;
  if (!functions) {
    formError.value = "The account service is unavailable.";
    return;
  }
  busy.value = "password";
  formError.value = "";
  try {
    const result = await accountFunction<null, { password: string }>(
      functions,
      "generateTemporaryPassword",
    )(null);
    if (
      typeof result.data.password !== "string" ||
      result.data.password.length < 8
    )
      throw new Error("Could not generate a password. Try again.");
    userForm.password = result.data.password;
  } catch (e) {
    formError.value = accountRequestError(
      e,
      "Could not generate a password. Try again.",
    );
  } finally {
    busy.value = "";
  }
}
async function saveUser() {
  if (busy.value) return;
  if (!functions) {
    formError.value = "The account service is unavailable.";
    return;
  }
  busy.value = "user";
  formError.value = "";
  const account = { ...userForm };
  try {
    const result = await accountFunction<
      typeof userForm,
      { email: string; role: string }
    >(
      functions,
      "createManagedUser",
    )(account);
    createdAccount.value = {
      email: result.data.email,
      role: result.data.role,
      password: account.password,
    };
    await loadData();
  } catch (e) {
    formError.value = accountRequestError(
      e,
      "Could not create account. Try again.",
    );
  } finally {
    busy.value = "";
  }
}
async function copyPassword() {
  if (!createdAccount.value) return;
  try {
    if (!navigator.clipboard?.writeText)
      throw new Error(
        "Copy is unavailable. Select the password and copy it manually.",
      );
    await navigator.clipboard.writeText(createdAccount.value.password);
    accountPasswordCopied.value = true;
  } catch {
    formError.value =
      "Could not copy the password. Select it and copy it manually.";
  }
}

const filterOptions = computed(
  () =>
    (
      ({
        bookings: [
          "AWAITING PAYMENT",
          "PAID",
          "CANCELLED",
          "EXPIRED",
          "REFUND PENDING",
          "REFUNDED",
        ],
        passengers: [
          "PAYMENT PENDING",
          "ISSUED",
          "CHECKED_IN",
          "BOARDED",
          "CANCELLED",
        ],
        trips: sailingStatuses,
        ports: ['ACTIVE', 'INACTIVE'],
        vessels: ['ACTIVE', 'INACTIVE'],
        "check-in": ["ISSUED", "CHECKED_IN", "BOARDED"],
        boarding: ["ISSUED", "CHECKED_IN", "BOARDED"],
        users: ["PASSENGER", "TICKETING", "BOARDING", "ADMIN"],
      }) as Record<string, string[]>
    )[section.value] || [],
);
const columns = computed(
  () =>
    (
      ({
        bookings: [
          "Booking / Account",
          "Route / Departure",
          "Passengers",
          "Total",
          "Status / Payment",
        ],
        passengers: [
          "Passenger",
          "Passenger type",
          "Booking reference",
          "Trip code",
          "Booking account",
          "Ticket status",
        ],
        trips: ["Trip / Route", "Vessel", "Departure", "Booked / Capacity", "Status"],
        ports: ["Code", "Port", "Location", "Status"],
        vessels: ["Code", "Vessel", "Capacity", "Status"],
        "check-in": ["Passenger", "Booking", "Sailing", "Departure", "Ticket"],
        boarding: [
          "Passenger",
          "Booking",
          "Sailing",
          "Checked in",
          "Ticket",
          "Sailing status",
        ],
        manifest: [
          "Passenger",
          "Sex",
          "Type",
          "Booking",
          "Sailing",
          "Ticket",
          "Boarded at",
        ],
        users: ["Name", "Email", "Role", "Created"],
      }) as Record<string, string[]>
    )[section.value] || [],
);
const hasRowAction = computed(() =>
  ["bookings", "trips", "ports", "vessels", "check-in", "boarding"].includes(
    section.value,
  ),
);
type Row = RecordGridRow;
const rows = computed<Row[]>(() => {
  let output: Row[] = [];
  if (section.value === "bookings")
    output = bookings.value.map((b) => ({
      key: b.reference,
      source: b,
      statusIndex: 4,
      sortValues: [b.reference, new Date(b.sailing.departureAt).getTime(), b.passengerCount, b.total],
      cells: [
        `${b.reference} ${b.owner.fullName}`,
        `${b.sailing.origin.name} → ${b.sailing.destination.name} ${dateTime(b.sailing.departureAt)}`,
        b.passengerCount,
        `PHP ${b.total.toLocaleString()}`,
        awaitingPaymentVerification(b) ? 'AWAITING STAFF VERIFICATION' : b.paymentStatus === "REFUND_PENDING"
          ? "REFUND PENDING"
          : b.paymentStatus === "REFUNDED"
            ? "REFUNDED"
            : ["CANCELLED", "EXPIRED"].includes(b.status)
              ? b.status
              : b.paymentStatus === "PAID"
                ? "PAID"
                : "AWAITING PAYMENT",
      ],
    }));
  if (
    section.value === "passengers" ||
    ["check-in", "boarding", "manifest"].includes(section.value)
  )
    output = passengers.value
      .filter(
        (p) =>
          (p.booking.status === "CONFIRMED" &&
            p.booking.paymentStatus === "PAID") ||
          section.value === "passengers",
      )
      .filter(
        (p) =>
          sailingFilter.value === "ALL" ||
          p.booking.sailing.code === sailingFilter.value,
      )
      .map((p) => ({
        key: p.id,
        source: p,
        statusIndex:
          section.value === "manifest"
            ? 5
            : section.value === "passengers"
              ? 5
              : 4,
        cells:
          section.value === "manifest"
            ? [
                p.fullName,
                p.sex || "—",
                p.passengerType,
                p.booking.reference,
                p.booking.sailing.code,
                p.ticketStatus,
                p.boardedAt ? dateTime(p.boardedAt) : "—",
              ]
            : section.value === "passengers"
              ? [
                  p.fullName,
                  p.passengerType,
                  p.booking.reference,
                  p.booking.sailing.code,
                  p.booking.owner.fullName,
                  ["CANCELLED", "EXPIRED"].includes(p.booking.status)
                    ? p.booking.status
                    : p.booking.paymentStatus === "PAID"
                      ? p.ticketStatus
                      : "PAYMENT PENDING",
                ]
              : [
                  p.fullName,
                  p.booking.reference,
                  p.booking.sailing.code,
                  section.value === "check-in"
                    ? dateTime(p.booking.sailing.departureAt)
                    : p.checkedInAt
                      ? dateTime(p.checkedInAt)
                      : "—",
                  p.ticketStatus,
                ].concat(
                  section.value === "boarding"
                    ? [p.booking.sailing.status]
                    : [],
                ),
      }));
  if (section.value === "trips")
    output = sailings.value.map((s) => ({
      key: s.code,
      source: s,
      statusIndex: 4,
      cells: [
        `${s.code} ${routeLabel(s)}`,
        s.vessel.name,
        dateTime(s.departureAt),
        `${s.vessel.passengerCapacity - s.availableSeats} / ${s.vessel.passengerCapacity}`,
        s.status,
      ],
    }));
  if (section.value === "ports")
    output = ports.value.map((p) => ({
      key: p.id,
      source: p,
      statusIndex: 3,
      cells: [
        p.code,
        p.name,
        `${p.city}${p.region ? `, ${p.region}` : ""}`,
        p.isActive ? "ACTIVE" : "INACTIVE",
      ],
    }));
  if (section.value === "vessels")
    output = vessels.value.map((v) => ({
      key: v.id,
      source: v,
      statusIndex: 3,
      cells: [
        v.code,
        v.name,
        v.passengerCapacity,
        v.isActive ? "ACTIVE" : "INACTIVE",
      ],
    }));
  if (section.value === "users")
    output = users.value.map((u) => ({
      key: u.uid,
      source: u,
      sortValues: [u.fullName, u.email, u.role, Date.parse(u.createdAt)],
      cells: [u.fullName, u.email, u.role, dateTime(u.createdAt)],
    }));
  output = output.map((row) => {
    const sortValues = [...row.cells];
    if (section.value === "bookings") {
      sortValues[0] = row.source.reference;
      sortValues[1] = new Date(row.source.sailing.departureAt).getTime();
      sortValues[3] = Number(row.source.total);
    }
    if (section.value === "trips") {
      sortValues[0] = row.source.code;
      sortValues[2] = new Date(row.source.departureAt).getTime();
      sortValues[3] = row.source.vessel.passengerCapacity - row.source.availableSeats;
    }
    if (section.value === "users")
      sortValues[3] = new Date(row.source.createdAt).getTime();
    if (section.value === "check-in")
      sortValues[3] = new Date(
        row.source.booking.sailing.departureAt,
      ).getTime();
    if (section.value === "boarding")
      sortValues[3] = row.source.checkedInAt
        ? new Date(row.source.checkedInAt).getTime()
        : 0;
    if (section.value === "manifest")
      sortValues[6] = row.source.boardedAt
        ? new Date(row.source.boardedAt).getTime()
        : 0;
    return { ...row, sortValues };
  });
  if (["bookings", "trips", "users", "passengers", "check-in", "boarding", "manifest"].includes(section.value)) return output;
  const q = search.value.toLowerCase();
  return output.filter(
    (r) =>
      (statusFilter.value === "ALL" ||
        (section.value === "users"
          ? r.source.role
          : ["ports", "vessels"].includes(section.value)
            ? (r.source.isActive ? "ACTIVE" : "INACTIVE")
          : section.value === "bookings"
            ? r.cells[6]
            : section.value === "passengers"
              ? r.cells[5]
              : section.value === "trips"
                ? r.source.status
                : r.source.ticketStatus) === statusFilter.value) &&
      (!q || r.cells.join(" ").toLowerCase().includes(q)),
  );
});
</script>

<style scoped>
.admin-route-directory .content, .admin-accommodation-directory .content, .admin-noshows-directory .content, .admin-advisory-directory .content, .admin-broadcast-directory .content, .admin-reports-directory .content, .admin-audit-directory .content, .admin-settings-directory .content, .admin-inbox-directory .content { padding: 24px 28px; }
.admin-route-directory .heading, .admin-accommodation-directory .heading, .admin-noshows-directory .heading, .admin-advisory-directory .heading, .admin-broadcast-directory .heading, .admin-reports-directory .heading, .admin-audit-directory .heading, .admin-settings-directory .heading, .admin-inbox-directory .heading { margin-bottom: 16px; }
@media (max-width: 600px) {
  .admin-route-directory .content, .admin-accommodation-directory .content, .admin-noshows-directory .content, .admin-advisory-directory .content, .admin-broadcast-directory .content, .admin-reports-directory .content, .admin-audit-directory .content, .admin-settings-directory .content, .admin-inbox-directory .content { padding: 20px 16px; }
}
:is(.admin-port-directory, .admin-vessel-directory, .admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory, .admin-user-directory) .content { padding: 24px 28px; }
:is(.admin-port-directory, .admin-vessel-directory, .admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory, .admin-user-directory) .heading { margin-bottom: 16px; }
:is(.admin-port-directory, .admin-vessel-directory, .admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory, .admin-user-directory) .booking-filters { display: grid; grid-template-columns: minmax(0, 1fr) 170px auto; gap: 12px; padding: 12px 16px; margin-bottom: 16px; }
:is(.admin-port-directory, .admin-vessel-directory, .admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory, .admin-user-directory) .booking-filters input, :is(.admin-port-directory, .admin-vessel-directory, .admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory, .admin-user-directory) .booking-filters select { min-height: 40px; font: inherit; font-size: 12px; }
:is(.admin-port-directory, .admin-vessel-directory, .admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory, .admin-user-directory) .booking-filters select { width: 100%; min-width: 0; }
:is(.admin-port-directory, .admin-vessel-directory, .admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory, .admin-user-directory) .booking-records-panel { border-radius: 14px; overflow: hidden; }
:is(.admin-port-directory, .admin-vessel-directory, .admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory, .admin-user-directory) .booking-records-panel .panel-head { padding: 14px 16px; }
:is(.admin-port-directory, .admin-vessel-directory, .admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory, .admin-user-directory) .panel-head h2 { font-size: 17px; margin: 4px 0 0; }
:is(.admin-port-directory, .admin-vessel-directory, .admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory, .admin-user-directory) :deep(.grid-tools) { padding: 8px 16px; border-bottom: 1px solid var(--line); background: var(--surface); }
:is(.admin-port-directory, .admin-vessel-directory, .admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory, .admin-user-directory) :deep(.grid-tools button) { min-height: 34px; padding: 6px 8px; }
:is(.admin-port-directory, .admin-vessel-directory, .admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory, .admin-user-directory) :deep(.desktop-grid) { padding: 8px; }
:is(.admin-port-directory, .admin-vessel-directory, .admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory, .admin-user-directory) :deep(.grid-cell-content) { padding: 7px 0; font-size: 12px; line-height: 1.5; }
:is(.admin-port-directory, .admin-vessel-directory, .admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory, .admin-user-directory) :deep(.grid-row-actions) { display: flex; align-items: center; min-height: 44px; padding: 7px 0; }
:is(.admin-port-directory, .admin-vessel-directory, .admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory, .admin-user-directory) .port-code, :is(.admin-port-directory, .admin-vessel-directory, .admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory, .admin-user-directory) .port-name { font-size: 12px; }
:is(.admin-port-directory, .admin-vessel-directory, .admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory, .admin-user-directory) .text-action { min-height: 32px; padding: 5px 10px; font-size: 11px; }
:is(.admin-port-directory, .admin-vessel-directory, .admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory, .admin-user-directory) .table-foot { margin: 0; padding: 10px 16px; border-top: 1px solid var(--line); font-size: 11px; line-height: 1.5; }
:is(.admin-port-directory, .admin-vessel-directory, .admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory, .admin-user-directory) .admin-port-map { margin-top: 18px; }
.port-modal:is(.port-editor-modal, .vessel-editor-modal) { --width: min(640px, calc(100vw - 32px)); }
.port-dialog:is(.port-editor-dialog, .vessel-editor-dialog) .modal-head { padding: 18px 20px; }
.port-dialog:is(.port-editor-dialog, .vessel-editor-dialog) .port-fields { padding: 16px 20px 20px; }
.port-dialog:is(.port-editor-dialog, .vessel-editor-dialog) .port-field-heading { margin: 0 0 12px; font-size: 12px; color: var(--ink); font-weight: 650; }
.port-dialog:is(.port-editor-dialog, .vessel-editor-dialog) .port-field-grid + .port-field-heading { margin-top: 22px; padding-top: 16px; border-top: 1px solid var(--line); }
.port-dialog:is(.port-editor-dialog, .vessel-editor-dialog) .port-field-grid { gap: 16px; }
.port-dialog:is(.port-editor-dialog, .vessel-editor-dialog) input:not([type="checkbox"]) { min-height: 40px; font-family: inherit; font-size: 12px; }
.port-dialog:is(.port-editor-dialog, .vessel-editor-dialog) .port-form-footer { padding: 14px 20px; }
.port-dialog:is(.port-editor-dialog, .vessel-editor-dialog) .port-form-footer button { min-height: 40px; }
@media (max-width: 1000px) {
  :is(.admin-port-directory, .admin-vessel-directory, .admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory, .admin-user-directory) .booking-filters { grid-template-columns: minmax(0, 1fr) 170px; }
  :is(.admin-port-directory, .admin-vessel-directory, .admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory, .admin-user-directory) .booking-filters > button { grid-column: 1 / -1; justify-self: start; }
}
@media (max-width: 600px) {
  :is(.admin-port-directory, .admin-vessel-directory, .admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory, .admin-user-directory) .content { padding: 20px 16px; }
  :is(.admin-port-directory, .admin-vessel-directory, .admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory, .admin-user-directory) .booking-filters { grid-template-columns: minmax(0, 1fr); }
  :is(.admin-port-directory, .admin-vessel-directory, .admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory, .admin-user-directory) :deep(.grid-tools) { flex-wrap: wrap; }
  .port-dialog:is(.port-editor-dialog, .vessel-editor-dialog) .modal-head, .port-dialog:is(.port-editor-dialog, .vessel-editor-dialog) .port-fields, .port-dialog:is(.port-editor-dialog, .vessel-editor-dialog) .port-form-footer { padding-inline: 16px; }
}
.admin-trips-directory .content { padding: 24px 28px; }
.admin-trips-directory .heading { margin-bottom: 16px; }
.admin-trips-directory .booking-filters { display: grid; grid-template-columns: minmax(0, 1fr) 190px auto; gap: 12px; padding: 12px 16px; margin-bottom: 14px; }
.admin-trips-directory .booking-filters input, .admin-trips-directory .booking-filters select { min-height: 40px; font-size: 12px; font-family: inherit; }
.admin-trips-directory .booking-filters select { width: 100%; min-width: 0; }
.admin-trip-weather { margin-bottom: 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
.admin-trip-weather summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; cursor: pointer; color: var(--ocean); font-size: 12px; font-weight: 600; list-style: none; }
.admin-trip-weather summary::-webkit-details-marker { display: none; }
.admin-trip-weather summary > span:first-child { display: flex; gap: 8px; align-items: center; }
.admin-trip-weather summary > span:last-child { font-size: 11px; color: var(--muted); font-weight: 400; }
.admin-trip-weather summary::after { content: '+'; font-size: 18px; }.admin-trip-weather[open] summary::after { content: '−'; }
.admin-trip-weather :deep(.weather-trip-picker) { margin: 0; width: 100%; max-width: none; border: 0; padding: 12px 16px 16px; }
.admin-trip-weather :deep(.weather-trigger strong) { font-size: 12px; }.admin-trip-weather :deep(.weather-trigger small) { font-size: 11px; }
.admin-trips-directory .trip-records-panel { overflow: hidden; border-radius: 14px; }
.admin-trips-directory .trip-records-panel .panel-head { padding: 12px 16px; }
.admin-trips-directory .panel-head h2 { font-size: 17px; margin: 4px 0 0; }
.admin-trips-directory :deep(.grid-tools) { padding: 8px 16px; background: var(--surface); border-bottom: 1px solid var(--line); }
.admin-trips-directory :deep(.grid-tools button) { min-height: 34px; padding: 6px 8px; }
.admin-trips-directory :deep(.desktop-grid) { padding: 8px; }
.admin-trips-directory :deep(.grid-cell-content) { padding: 7px 0; font-size: 12px; line-height: 1.5; }
.admin-trips-directory :deep(.grid-row-actions) { display: flex; align-items: center; min-height: 48px; padding: 7px 0; }
.schedule-identity { display: grid; gap: 3px; line-height: 1.5; }
.schedule-identity strong { font-size: 12px; }.schedule-identity small { font-size: 11px; font-weight: 400; color: var(--muted); }
.admin-trips-directory .trip-row-actions { grid-template-columns: minmax(0, 1fr) auto; gap: 6px; }
.admin-trips-directory .trip-row-actions .text-action { min-height: 32px; padding: 5px 7px; font-size: 10px; }
.schedule-seat-track { height: 4px; background: var(--line); border-radius: 8px; overflow: hidden; margin-top: 5px; }.schedule-seat-track i { display: block; height: 100%; background: var(--ocean); border-radius: inherit; }
.schedule-status-select { width: 100%; min-height: 34px; padding: 5px 24px 5px 8px; border: 1px solid var(--line); border-radius: 7px; font-family: inherit; font-size: 11px; text-transform: capitalize; cursor: pointer; }
.schedule-status-badge { font-size: 11px; text-transform: capitalize; }
.schedule-status-select.scheduled { background: #eff6ff; color: #1d4ed8; }.schedule-status-select.boarding { background: #f5f3ff; color: #6d28d9; }.schedule-status-select.delayed { background: #fffbeb; color: #92400e; }
:global(:root[data-theme="dark"]) .schedule-status-select.scheduled { background: #172e4d; color: #93c5fd; }
:global(:root[data-theme="dark"]) .schedule-status-select.boarding { background: #30234e; color: #c4b5fd; }
:global(:root[data-theme="dark"]) .schedule-status-select.delayed { background: #3c2d17; color: #fcd34d; }
.admin-trip-weather summary:focus-visible, .schedule-status-select:focus-visible { outline: 2px solid var(--ocean); outline-offset: 2px; }
.admin-trips-directory .table-foot { margin: 0; padding: 8px 16px; font-size: 10px; line-height: 1.5; border-top: 1px solid var(--line); }
.admin-trips-directory :deep(.workspace-pagination) { padding: 10px 16px; font-size: 11px; }
@media (max-width: 1000px) { .admin-trips-directory .booking-filters { grid-template-columns: minmax(0, 1fr) 170px; }.admin-trips-directory .booking-filters > button { grid-column: 1 / -1; justify-self: start; } }
@media (max-width: 600px) { .admin-trips-directory .content { padding: 20px 16px; }.admin-trips-directory .booking-filters { grid-template-columns: minmax(0, 1fr); }.admin-trip-weather summary > span:last-child { display: none; }.admin-trips-directory :deep(.grid-tools) { flex-wrap: wrap; } }
</style>

<style scoped>
.admin-passenger-directory .content { padding: 24px 28px; }
.admin-passenger-directory .heading { margin-bottom: 16px; }
.admin-passenger-directory .booking-filters { display: grid; grid-template-columns: minmax(0, 1fr) 190px auto; gap: 12px; padding: 12px 16px; margin-bottom: 14px; }
.admin-passenger-directory .booking-filters label > span { font-size: 12px; }
.admin-passenger-directory .booking-filters input, .admin-passenger-directory .booking-filters select { font-family: inherit; font-size: 12px; min-height: 40px; }
.admin-passenger-directory .booking-filters select { min-width: 0; width: 100%; }
.admin-passenger-directory .passenger-records-panel { overflow: hidden; border-radius: 14px; }
.admin-passenger-directory .passenger-records-panel .panel-head { padding: 12px 16px; }
.admin-passenger-directory .panel-head h2 { font-size: 17px; margin: 4px 0 0; }
.admin-passenger-directory :deep(.grid-tools) { padding: 8px 16px; background: var(--surface); border-bottom: 1px solid var(--line); }
.admin-passenger-directory :deep(.grid-tools button) { min-height: 34px; padding: 6px 8px; }
.admin-passenger-directory :deep(.desktop-grid) { padding: 8px; }
.admin-passenger-directory :deep(.grid-cell-content) { padding: 7px 0; font-size: 12px; line-height: 1.5; }
.admin-passenger-directory .passenger-name { font-size: 13px; }
.admin-passenger-directory .passenger-reference { font-size: 11px; font-weight: 400; }
.admin-passenger-directory .passenger-type { font-size: 10px; padding: 3px 6px; }
.admin-passenger-directory .passenger-status-badge { font-size: 10px; border-radius: 6px; padding: 4px 7px; white-space: nowrap; }
.admin-passenger-directory .passenger-status-badge.issued { color: #1d4ed8; background: #eff6ff; }
.admin-passenger-directory .passenger-status-badge.checked-in { color: #6d28d9; background: #f5f3ff; }
.admin-passenger-directory .passenger-status-badge.expired { color: var(--muted); background: var(--surface-soft); border-color: var(--line); }
:global(:root[data-theme="dark"]) .admin-passenger-directory .passenger-status-badge.issued { color: #93c5fd; background: #172e4d; }
:global(:root[data-theme="dark"]) .admin-passenger-directory .passenger-status-badge.checked-in { color: #c4b5fd; background: #30234e; }
.admin-passenger-directory .table-foot { padding: 8px 16px; font-size: 10px; line-height: 1.5; margin: 0; border-top: 1px solid var(--line); }
.admin-passenger-directory :deep(.workspace-pagination) { padding: 10px 16px; font-size: 11px; }
.admin-passenger-directory :deep(.workspace-pagination button) { min-height: 36px; }
@media (max-width: 1000px) { .admin-passenger-directory .booking-filters { grid-template-columns: minmax(0, 1fr) 170px; }.admin-passenger-directory .booking-filters > button { grid-column: 1 / -1; justify-self: start; } }
@media (max-width: 600px) {
  .admin-passenger-directory .content { padding: 20px 16px; }
  .admin-passenger-directory .booking-filters { grid-template-columns: minmax(0, 1fr); padding: 16px; }
  .admin-passenger-directory :deep(.grid-tools) { flex-direction: column; align-items: stretch; padding: 12px 16px; }
  .admin-passenger-directory :deep(.grid-tools > div:last-child) { flex-wrap: wrap; }
}
</style>

<style scoped>
.admin-booking-directory .content { padding: 24px 28px; }
.admin-booking-directory .heading { margin-bottom: 16px; }
.admin-booking-directory .booking-filters { display: grid; grid-template-columns: minmax(0, 1fr) 210px auto; gap: 12px; padding: 12px 16px; margin-bottom: 14px; }
.admin-booking-directory .booking-filters label > span { font-size: 12px; }
.admin-booking-directory .booking-filters input, .admin-booking-directory .booking-filters select { font-family: inherit; font-size: 12px; min-height: 40px; }
.admin-booking-directory .booking-filters select { min-width: 0; width: 100%; }
.admin-booking-directory .booking-records-panel { overflow: hidden; border-radius: 14px; }
.admin-booking-directory .booking-records-panel .panel-head { padding: 12px 16px; }
.admin-booking-directory .panel-head h2 { font-size: 17px; margin: 4px 0 0; }
.admin-booking-directory :deep(.grid-tools) { background: var(--surface); border-bottom: 1px solid var(--line); padding: 8px 16px; }
.admin-booking-directory :deep(.grid-tools button) { min-height: 34px; padding: 6px 8px; }
.admin-booking-directory :deep(.grid-summary) { flex-wrap: wrap; align-items: center; }
.admin-booking-directory :deep(.desktop-grid) { padding: 8px; }
.admin-booking-directory :deep(.grid-cell-content) { padding: 5px 0; font-size: 12px; line-height: 1.4; }
.admin-booking-directory :deep(.grid-row-actions) { display: flex; align-items: center; min-height: 44px; padding: 4px 0; }
.booking-identity, .booking-sailing, .booking-payment { display: grid; gap: 2px; line-height: 1.4; }
.booking-identity > *, .booking-sailing > * { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.booking-identity strong { font-size: 12px; font-weight: 650; letter-spacing: .1px; }
.booking-identity small, .booking-sailing small, .booking-payment small { font-size: 11px; color: var(--muted); font-weight: 400; line-height: 1.4; }
.booking-sailing strong { font-size: 12px; font-weight: 500; }
.booking-sailing small { font-variant-numeric: tabular-nums; }
.booking-passengers { font-size: 13px; font-variant-numeric: tabular-nums; }
.booking-amount { font-size: 13px; white-space: nowrap; font-weight: 650; font-variant-numeric: tabular-nums; }
.booking-status-badge { justify-self: start; font-size: 10px; line-height: 1.3; border-radius: 5px; padding: 3px 6px; white-space: normal; }
.booking-payment .booking-voucher { color: var(--ocean); font-size: 10px; }
.booking-status-badge.expired, .booking-status-badge.refunded { color: var(--muted); background: var(--surface-soft); border-color: var(--line); }
.booking-no-action { display: inline-block; color: var(--muted); font-size: 18px; }
.admin-booking-directory .text-action.danger { min-height: 30px; padding: 5px 8px; font-size: 11px; }
.admin-booking-directory .table-foot { margin: 0; padding: 8px 16px; font-size: 10px; line-height: 1.5; color: var(--muted); border-top: 1px solid var(--line); }
.admin-booking-directory :deep(.workspace-pagination) { padding: 10px 16px; font-size: 11px; }
.admin-booking-directory :deep(.workspace-pagination button) { min-height: 36px; }
@media (max-width: 1000px) { .admin-booking-directory .booking-filters { grid-template-columns: minmax(0, 1fr) 190px; }.admin-booking-directory .booking-filters > button { grid-column: 1 / -1; justify-self: start; } }
@media (max-width: 600px) {
  .admin-booking-directory .content { padding: 20px 16px; }
  .booking-identity > *, .booking-sailing > * { white-space: normal; }
  .admin-booking-directory .booking-filters { grid-template-columns: minmax(0, 1fr); padding: 16px; gap: 12px; }
  .admin-booking-directory :deep(.grid-tools) { flex-direction: column; align-items: stretch; padding: 12px 16px; }
  .admin-booking-directory :deep(.grid-tools > div:last-child) { flex-wrap: wrap; }
  .admin-booking-directory :deep(.mobile-record) { padding: 16px; }
  .admin-booking-directory .table-foot { padding: 12px 16px; }
}
</style>

<style scoped>
.admin-port-map {
  margin-top: 24px;
}
.fare-settings-panel {
  width: 100%;
}
.fare-vessel-picker {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 340px);
  gap: 18px;
  align-items: center;
  padding: 16px 18px;
  margin-bottom: 16px;
}
.fare-vessel-heading { display: flex; align-items: center; gap: 14px; }
.fare-vessel-heading .fare-card-icon { flex: 0 0 38px; height: 38px; }
.fare-vessel-picker h2 {
  margin: 7px 0;
  font-size: 15px;
}
.fare-vessel-picker p:last-child {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}
.fare-vessel-picker select {
  width: 100%;
  min-height: 40px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  color: var(--ink);
  background: var(--surface-soft);
  font: inherit;
  font-size: 12px;
}
.fare-vessel-picker select:focus-visible {
  outline: 2px solid var(--ocean);
  outline-offset: 2px;
}
.fare-config-status {
  display: inline-block;
  margin-top: 6px;
  padding: 4px 8px;
  border-radius: 20px;
  color: var(--muted);
  background: var(--surface-soft);
  font-size: 10px;
  font-weight: 700;
}
.fare-config-status.configured {
  color: var(--ocean);
  background: var(--light-blue);
}
.fare-vessel-note {
  margin: -6px 0 20px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}
.fare-vessel-note a {
  color: var(--ocean);
}
@media (max-width: 600px) {
  .fare-vessel-picker {
    grid-template-columns: 1fr;
    gap: 16px;
    padding: 20px;
  }
}
.fare-settings-panel fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
.modal-body form > fieldset {
  display: grid;
  gap: 16px;
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
.workspace > .topbar {
  background: var(--surface);
}
.admin-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--muted);
  font-size: 12px;
}
.admin-breadcrumbs > ion-icon {
  flex: none;
  color: var(--ocean);
  font-size: 14px;
}
.admin-breadcrumbs > strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ink);
}
.admin-profile-chip {
  display: flex;
  align-items: center;
  gap: 9px;
  flex: none;
  max-width: 240px;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-soft);
  color: var(--ink);
  text-decoration: none;
}
.admin-profile-icon {
  display: grid;
  place-items: center;
  flex: none;
  color: var(--ocean);
}
.admin-profile-icon ion-icon {
  font-size: 23px;
}
.admin-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  flex: none;
}
.topbar .admin-global-search + .admin-header-actions {
  margin-left: 6px;
}
@media (max-width: 1000px) {
  .topbar .admin-global-search + .admin-header-actions { margin-left: auto; }
}
.topbar .admin-bell {
  position: relative;
  width: 44px;
  height: 44px;
  margin-left: 0;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-soft);
  color: var(--ink);
  text-decoration: none;
}
.admin-unread-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  display: grid;
  place-items: center;
  border: 2px solid var(--surface);
  border-radius: 20px;
  background: #c73646;
  color: white;
  font-size: 10px;
  font-weight: 700;
}
.topbar .admin-bell[aria-current="page"] { color:var(--ocean); border-color:var(--ocean); }
.admin-header-actions a:focus-visible,
.nav-group-toggle:focus-visible {
  outline: 2px solid #50a9eb;
  outline-offset: 3px;
}
.admin-profile-copy {
  display: grid;
  gap: 2px;
}
.topbar .admin-profile-copy strong {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
}
.admin-profile-copy small {
  color: var(--muted);
  font-size: 9px;
}
@media (max-width: 540px) {
  .admin-breadcrumbs > span,
  .admin-breadcrumbs > ion-icon {
    display: none;
  }
  .topbar {
    gap: 10px;
  }
  .topbar .admin-breadcrumbs > strong {
    font-size: 12px;
  }
  .topbar .admin-profile-copy strong {
    max-width: 95px;
    font-size: 10px;
  }
  .admin-profile-copy small {
    font-size: 8px;
  }
  .admin-profile-chip {
    padding-right: 9px;
    gap: 7px;
  }
}
@media (max-width: 480px) {
  .admin-header-actions { gap: 7px; }
  .admin-profile-chip { width: 44px; padding: 8px; justify-content: center; }
  .admin-profile-copy { display: none; }
}
.fare-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(250px, 1fr);
  gap: 16px;
  align-items: start;
}
.fare-editor {
  display: grid;
  gap: 16px;
  min-width: 0;
}
.fare-card {
  padding: 18px;
}
.fare-card-heading {
  display: flex;
  align-items: center;
  gap: 13px;
  margin-bottom: 16px;
}
.fare-card-icon {
  display: grid;
  place-items: center;
  flex: 0 0 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 19px;
}
.fare-card h2,
.fare-preview-heading h2 {
  margin: 0;
  font-size: 15px;
  letter-spacing: -0.02em;
}
.fare-card-heading p,
.fare-preview-heading > p:last-child {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}
.fare-settings-panel label {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
}
.fare-input {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-soft);
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.fare-input:focus-within {
  border-color: var(--ocean);
  box-shadow: 0 0 0 3px var(--light-blue);
}
.fare-input > span {
  padding-right: 14px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}
.fare-input input {
  width: 100%;
  min-width: 0;
  min-height: 46px;
  padding: 12px 14px;
  border: 0;
  border-radius: 10px;
  outline: none;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 15px;
  font-weight: 700;
}
.fare-input input:focus-visible {
  outline: 2px solid var(--ocean);
  outline-offset: -3px;
}
.fare-base-input > span {
  padding: 0 0 0 16px;
  color: var(--ocean);
}
.fare-base-input input {
  min-height: 60px;
  font-size: 25px;
}
.fare-hint {
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
}
.fare-discount-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 22px 18px;
}
.fare-discount-field small {
  display: block;
  margin-top: 8px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}
.fare-preview-card {
  padding: 18px;
  align-self: start;
}
@media (min-width: 1151px) {
  .fare-settings-panel .fare-preview-card { position: sticky; top: 20px; max-height: calc(100dvh - 40px); overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--muted) transparent; }
}
.fare-preview > .fare-preview-inactive { background: var(--surface-soft); padding-inline: 10px; border-radius: 8px; }
.fare-preview-inactive strong { color: var(--muted); }
.fare-preview-heading {
  margin-bottom: 14px;
}
.fare-preview-heading .eyebrow {
  margin-bottom: 8px;
}
.fare-preview {
  display: grid;
}
.fare-preview > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}
.fare-preview > div:last-child {
  border-bottom: 0;
}
.fare-preview span {
  font-size: 12px;
  font-weight: 700;
}
.fare-preview span small {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 400;
}
.fare-preview strong {
  flex-shrink: 0;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.fare-preview > .fare-preview-regular {
  margin: 0 0 3px;
  padding: 12px;
  border: 0;
  border-radius: 10px;
  background: var(--light-blue);
}
.fare-preview-regular strong {
  color: var(--ocean);
  font-size: 20px;
}
.fare-preview-note {
  display: flex;
  align-items: start;
  gap: 9px;
  margin: 18px 0 0;
  padding-top: 18px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
}
.fare-preview-note ion-icon {
  flex-shrink: 0;
  margin-top: 2px;
  font-size: 16px;
  color: var(--ocean);
}
.fare-save-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: 16px;
  padding: 14px 18px;
  position: static;
  box-shadow: none;
}
.fare-save-bar strong {
  font-size: 13px;
}
.fare-save-bar p {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}
.fare-save-bar .primary {
  flex-shrink: 0;
  min-height: 44px;
}
.fare-settings-panel fieldset:disabled .fare-input {
  opacity: 0.6;
}
@media (min-width: 951px) and (max-width: 1150px), (max-width: 760px) {
  .fare-layout {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 480px) {
  .fare-card,
  .fare-preview-card {
    padding: 20px;
  }
  .fare-card-heading {
    align-items: start;
  }
  .fare-discount-grid {
    gap: 18px 12px;
  }
  .fare-save-bar {
    align-items: stretch;
    flex-direction: column;
    padding: 20px;
    gap: 16px;
  }
  .fare-save-bar .primary {
    width: 100%;
  }
}
input[readonly] {
  opacity: 0.8;
}

.shell {
  min-height: 100vh;
  display: flex;
  background: var(--cloud, #f5f7fa);
  color: var(--ink, #172033);
}
.sidebar {
  position: sticky;
  top: 0;
  width: 238px;
  min-width: 238px;
  height: 100vh;
  padding: 24px 14px;
  display: flex;
  flex-direction: column;
  background: #0b2134;
  border-right: 1px solid #28445b;
}
.sidebar :deep(.brand-copy strong),
.sidebar :deep(.brand-copy b) {
  color: white;
}
.sidebar nav {
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #41617a transparent;
  flex: 1;
  margin-top: 24px;
  min-height: 0;
  padding-bottom: 12px;
}
.nav-group {
  display: grid;
  gap: 4px;
  margin: 0 0 6px;
}
.nav-group-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #85abc2;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
}
.nav-group-toggle:hover,
.nav-group-toggle[aria-expanded="true"] { background: #ffffff08; color: #d4e6f4; }
.nav-group-label { display: flex; align-items: center; gap: 10px; min-width: 0; }
.nav-group .nav-group-label ion-icon { font-size: 17px; flex: none; color: #79a9ce; }
.nav-group .nav-group-chevron { font-size: 13px; flex: none; transition: transform 160ms ease; }
.nav-group-toggle[aria-expanded="true"] .nav-group-chevron { transform: rotate(180deg); }
.nav-group-items { display: grid; gap: 3px; padding: 0 0 4px 8px; margin-left: 12px; border-left: 1px solid #28445b; }
.nav-group a {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #b8cfe0;
  font-size: 13px;
  text-decoration: none;
  text-align: left;
  cursor: pointer;
}
.nav-group a:hover,
.nav-group a.active {
  background: #174266;
  color: #fff;
}
.nav-group ion-icon {
  font-size: 18px;
}
.sidebar :deep(.staff-signout) { flex: none; margin-top: 12px; }
.workspace {
  flex: 1;
  min-width: 0;
}
.topbar {
  height: 72px;
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 0 32px;
  border-bottom: 1px solid var(--line, #26394d);
}
.topbar strong {
  font-size: 13px;
}
.topbar strong span {
  color: var(--muted, #9db2c5);
  font-weight: 500;
}
.menu-button {
  display: none;
}
.content {
  max-width: 1400px;
  margin: auto;
  padding: 34px 32px 70px;
}
.heading {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 20px;
  margin-bottom: 26px;
}
.heading h1 {
  margin: 5px 0;
  font-size: 30px;
}
.heading p:last-child {
  margin: 0;
  color: var(--muted, #9db2c5);
  font-size: 13px;
}
.eyebrow {
  margin: 0;
  color: var(--ocean, #1565c0);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.13em;
}
.heading-actions {
  display: flex;
  gap: 9px;
}
.primary,
.secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 38px;
  padding: 0 15px;
  border: 1px solid #4aaaf0;
  border-radius: 9px;
  background: #50a9eb;
  color: #071a29;
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}
.secondary {
  background: transparent;
  color: var(--ocean, #1565c0);
  border-color: var(--ocean, #1565c0);
}
.primary:disabled,
.secondary:disabled {
  opacity: 0.5;
  cursor: wait;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}
.metrics article,
.panel {
  border: 1px solid var(--line, #2c455c);
  border-radius: 15px;
  background: var(--surface, #142539);
}
.metrics article {
  display: grid;
  gap: 8px;
  padding: 22px;
}
.metrics small,
.metrics span,
.flow small {
  color: var(--muted, #9db2c5);
  font-size: 11px;
}
.metrics strong {
  font-size: 27px;
}
.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(270px, 1fr);
  gap: 18px;
}
.panel {
  min-width: 0;
  overflow: hidden;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  padding: 22px 22px 14px;
}
.panel-head h2,
.flow h2 {
  margin: 5px 0 0;
  font-size: 19px;
}
.panel-head a,
.count {
  color: var(--ocean, #1565c0);
  font-size: 12px;
  text-decoration: none;
}
.flow {
  padding: 22px;
}
.flow-row {
  display: flex;
  justify-content: space-between;
  margin-top: 22px;
  color: var(--muted, #9db2c5);
  font-size: 13px;
}
.flow-row strong {
  color: var(--ink, #fff);
}
.progress {
  height: 9px;
  margin: 25px 0 10px;
  border-radius: 9px;
  background: #274258;
  overflow: hidden;
}
.progress i {
  display: block;
  height: 100%;
  background: #51afe9;
}
.toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}
.booking-filters {
  display: flex;
  align-items: end;
  gap: 16px;
  padding: 18px 20px;
  margin-bottom: 20px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
}
.booking-filters label { display: grid; gap: 8px; min-width: 0; }
.booking-filters label > span { color: var(--muted); font-size: 11px; font-weight: 600; }
.booking-search-field { flex: 1; }
.booking-search-input {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-soft);
}
.booking-search-input ion-icon { flex: none; font-size: 17px; color: var(--muted); }
.booking-search-input:focus-within { border-color: var(--ocean); outline: 2px solid var(--light-blue); }
.booking-search-input input {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--ink);
  font-size: 12px;
}
.booking-filters select {
  min-height: 44px;
  min-width: 200px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-soft);
  color: var(--ink);
  font-size: 12px;
}
.booking-filters > button { min-height: 44px; flex: none; }
.check-in-filters { flex-wrap: wrap; }
.check-in-filters .booking-search-field { flex-basis: 100%; }
.check-in-filters .check-in-sailing-filter { flex: 1; }
.check-in-filters select { width: 100%; min-width: 0; }
.check-in-guidance { display: flex; align-items: flex-start; gap: 9px; margin: -6px 0 20px; color: var(--muted); font-size: 11px; line-height: 1.6; }
.check-in-guidance ion-icon { flex: none; margin-top: 1px; color: var(--ocean); font-size: 17px; }
.check-in-action { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 36px; background: var(--light-blue); border-color: var(--line); white-space: nowrap; }
.check-in-action ion-icon { font-size: 15px; }
.check-in-action:focus-visible { outline: 2px solid var(--ocean); outline-offset: 2px; }
:is(.admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory) .booking-filters { grid-template-columns: minmax(180px, 1fr) 150px minmax(220px, 1fr) auto; }
:is(.admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory) .check-in-guidance { margin: -4px 0 14px; font-size: 12px; }
:is(.admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory) .passenger-name { font-size: 12px; }
:is(.admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory) .passenger-reference { font-variant-numeric: tabular-nums; font-size: 12px; }
:is(.admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory) .check-in-action { min-height: 32px; padding: 5px 9px; font-size: 11px; }
:is(.admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory) .check-in-action:disabled { opacity: .75; color: var(--muted); background: var(--surface-soft); }
:is(.admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory) :deep(.workspace-pagination) { padding: 10px 16px; gap: 10px; }
:is(.admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory) :deep(.workspace-pagination button) { min-height: 34px; padding: 6px 12px; font-size: 11px; border-radius: 8px; }
@media (max-width: 1100px) {
  :is(.admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory) .booking-filters { grid-template-columns: 150px minmax(0, 1fr) auto; }
  :is(.admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory) .booking-search-field { grid-column: 1 / -1; }
  :is(.admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory) .booking-filters > button { grid-column: auto; }
}
@media (max-width: 600px) {
  :is(.admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory) .booking-filters { grid-template-columns: minmax(0, 1fr); }
  :is(.admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory) .booking-filters > button { grid-column: 1 / -1; justify-self: stretch; }
  :is(.admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory) .booking-filters input, :is(.admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory) .booking-filters select { min-height: 44px; font-size: 16px; }
  :is(.admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory) .check-in-action, :is(.admin-checkin-directory, .admin-boarding-directory, .admin-manifest-directory) :deep(.workspace-pagination button) { min-height: 44px; }
}

.boarding-records-panel :deep([data-slot="badge"]) { white-space: normal; line-height: 1.5; }
.boarding-records-panel :deep(.ag-cell[col-id="cell-5"]) { font-weight: 400; }
.manifest-download-card { margin-bottom: 20px; }
.admin-manifest-directory .manifest-download-card { margin-bottom: 16px; }
.admin-manifest-directory .booking-filters { grid-template-columns: minmax(180px, 1fr) minmax(240px, 1fr) auto; }
.admin-manifest-directory .manifest-not-boarded { font-size: 12px; white-space: nowrap; }
.admin-manifest-directory :deep(.manifest-export) { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 14px; }
.admin-manifest-directory :deep(.export-heading) { margin: 0; }
.admin-manifest-directory :deep(.manifest-export > p) { grid-column: 1 / -1; margin: 0; }
.admin-manifest-directory .booking-filters { grid-template-columns: minmax(180px, .7fr) minmax(280px, 1.3fr) auto; }
.admin-manifest-directory :deep(#check-in-sailing) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (min-width: 601px) and (max-width: 1100px) {
  .admin-manifest-directory .booking-filters { grid-template-columns: minmax(0, 1fr) auto; }
}
@media (max-width: 700px) {
  .admin-manifest-directory :deep(.manifest-export) { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 600px) {
  .admin-manifest-directory .booking-filters { grid-template-columns: minmax(0, 1fr); }
}
.manifest-sex { text-transform: capitalize; }
.manifest-not-boarded { color: var(--muted); font-size: 11px; }
.manifest-records-panel :deep([data-slot="badge"]) { white-space: normal; line-height: 1.5; }
.manifest-records-panel :deep(.ag-cell[col-id="cell-5"]) { font-weight: 400; }
.booking-records-panel .panel-head { padding: 20px 22px; border-bottom: 1px solid var(--line); }
.booking-record-count { padding: 6px 10px; border-radius: 20px; background: var(--light-blue); font-weight: 600; white-space: nowrap; }
.booking-records-panel :deep(.grid-tools) { padding: 14px 20px; background: var(--surface-soft); }
.booking-records-panel :deep(.desktop-grid) { padding-inline: 12px; padding-bottom: 12px; }
.booking-records-panel :deep(.ag-body-viewport),
.booking-records-panel :deep(.ag-body-vertical-scroll-viewport),
.booking-records-panel :deep(.ag-body-horizontal-scroll-viewport) { scrollbar-width: thin; scrollbar-color: var(--muted) var(--surface); }
.booking-records-panel :deep(.ag-cell[col-id="cell-0"]) { font-weight: 650; }
.booking-records-panel:not(.passenger-records-panel):not(.trip-records-panel) :deep(.ag-cell[col-id="cell-5"]) { font-weight: 650; font-variant-numeric: tabular-nums; }
.trip-reference { color: var(--ink); font-size: 12px; font-weight: 650; }
.trip-capacity { display: grid; gap: 3px; }
.trip-capacity strong { font-variant-numeric: tabular-nums; font-weight: 650; }
.trip-capacity small { color: var(--muted); font-size: 10px; }
.trip-records-panel :deep([data-slot="badge"]) { white-space: normal; line-height: 1.5; }
.passenger-name { color: var(--ink); font-size: 13px; font-weight: 650; }
.passenger-type { display: inline-flex; padding: 3px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface-soft); color: var(--ink); font-size: 11px; text-transform: capitalize; }
.passenger-reference { font-size: 11px; font-variant-numeric: tabular-nums; }
.passenger-records-panel :deep([data-slot="badge"]) { white-space: normal; line-height: 1.5; }
@media (max-width: 1100px) {
  .booking-filters { flex-wrap: wrap; gap: 12px; }
  .booking-search-field { flex-basis: 100%; }
  .booking-filters label:not(.booking-search-field) { flex: 1; }
}
@media (max-width: 600px) {
  .booking-filters { padding: 16px; }
  .booking-filters select { min-width: 0; width: 100%; }
  .booking-records-panel .panel-head { padding: 16px; }
  .booking-records-panel :deep(.grid-tools) { padding: 12px 16px; }
}
.toolbar input,
.toolbar select,
td select,
.modal-body input,
.modal-body select {
  min-height: 39px;
  padding: 0 12px;
  border: 1px solid var(--line, #35536a);
  border-radius: 8px;
  background: var(--surface, #142539);
  color: var(--ink, #fff);
  font: inherit;
  font-size: 12px;
}
.toolbar input {
  flex: 1;
  min-width: 180px;
}
.toolbar select {
  max-width: 300px;
}
.table-wrap {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  white-space: nowrap;
}
th,
td {
  padding: 13px 19px;
  border-bottom: 1px solid var(--line, #2a4155);
  font-size: 12px;
  text-align: left;
}
th {
  color: var(--muted, #9db2c5);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
tbody tr:last-child td {
  border-bottom: 0;
}
td {
  color: var(--ink, #fff);
}
td strong {
  color: var(--ink, #172033);
}
.status {
  display: inline-block;
  padding: 5px 8px;
  border-radius: 8px;
  background: #164262;
  color: #8dd1fb;
  font-size: 11px;
  font-weight: 750;
}
.empty {
  text-align: center;
  color: var(--muted, #9db2c5);
  padding: 28px;
}
.table-foot {
  margin: 0;
  padding: 14px 20px;
  border-top: 1px solid var(--line, #2a4155);
  color: var(--muted, #9db2c5);
  font-size: 11px;
}
.text-action {
  padding: 6px 10px;
  border: 1px solid #407399;
  border-radius: 7px;
  background: transparent;
  color: var(--ocean, #1565c0);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.text-action.danger {
  color: #ff9e9e;
  border-color: #7a4850;
}
.text-action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.alert,
.notice {
  margin: 0 0 18px;
  padding: 12px 14px;
  border-radius: 9px;
  background: #542e3a;
  color: #ffd5dc;
  font-size: 12px;
}
.notice {
  background: #164d44;
  color: #b9f4df;
}
.report-metrics {
  margin-bottom: 20px;
}
.scrim {
  display: none;
}
.modal-body {
  width: min(94vw, 580px);
  max-height: 86vh;
  overflow-y: auto;
  margin: 7vh auto;
  padding: 24px;
  border: 1px solid #35536a;
  border-radius: 16px;
  background: #142539;
  color: #fff;
}
.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.modal-head h2 {
  margin: 0;
  font-size: 21px;
}
.modal-head button {
  border: 0;
  background: transparent;
  color: #fff;
  font-size: 22px;
  cursor: pointer;
}
.modal-body form {
  display: grid;
  gap: 13px;
}
.modal-body label {
  display: grid;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
}
.modal-body input,
.modal-body select {
  width: 100%;
}
.modal-body .primary {
  margin-top: 5px;
}
.port-code { color: var(--ocean); font-size: 12px; font-weight: 650; }
.port-name { color: var(--ink); font-size: 13px; font-weight: 650; }
.port-modal { --width: min(680px, calc(100vw - 32px)); --height: auto; --max-height: calc(100dvh - 40px); --border-radius: 16px; --background: var(--surface); }
.modal-body.port-dialog { display: flex; flex-direction: column; width: 100%; max-height: calc(100dvh - 40px); margin: 0; padding: 0; overflow: hidden; border: 0; border-radius: 0; background: var(--surface); color: var(--ink); }
.port-dialog .modal-head { flex: none; gap: 16px; margin: 0; padding: 22px 24px; border-bottom: 1px solid var(--line); }
.port-title-icon { display: grid; place-items: center; width: 44px; height: 44px; flex: none; border-radius: 12px; background: var(--light-blue); color: var(--ocean); font-size: 24px; }
.port-subtitle { margin: 6px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
.port-dialog .modal-head > button { display: grid; place-items: center; width: 36px; height: 36px; flex: none; border-radius: 9px; background: var(--surface-soft); color: var(--muted); }
.port-dialog > .alert { flex: none; margin: 16px 24px 0; }
.port-dialog .port-form { display: flex; flex: 1 1 auto; flex-direction: column; gap: 0; min-height: 0; overflow: hidden; }
.catalog-modal-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-gutter: stable; scrollbar-color: var(--muted) var(--surface); }
.port-dialog .catalog-modal-scroll .port-fields { overflow: visible; }
.vessel-capacity { font-weight: 650; font-variant-numeric: tabular-nums; }
.vessel-editor-dialog .port-fields { border: 0; margin: 0; min-width: 0; }
.vessel-editor-dialog .port-form-note { margin-bottom: 12px; line-height: 1.5; }
.port-dialog.vessel-editor-dialog .port-availability { margin-top: 16px; padding: 12px; }
.port-dialog.vessel-editor-dialog .modal-head > button { width: 44px; height: 44px; }
@media (max-width: 600px) {
  .port-dialog.vessel-editor-dialog input:not([type="checkbox"]) { min-height: 44px; font-size: 16px; }
  .port-dialog.vessel-editor-dialog .port-form-footer button { min-height: 44px; }
  .admin-vessel-directory .text-action { min-height: 44px; }
}

.port-dialog .port-fields { display: block; min-height: 0; padding: 22px 24px; overflow-y: auto; scrollbar-width: thin; }
.port-form-note { margin: 0 0 18px; color: var(--muted); font-size: 11px; }
.port-field-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px 18px; align-items: start; }
.port-dialog label { min-width: 0; gap: 8px; font-size: 11px; color: var(--muted); font-weight: 600; }
.port-dialog input:not([type="checkbox"]) { min-height: 44px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-soft); color: var(--ink); font-size: 13px; }
.port-dialog input:disabled { opacity: 0.65; }
.port-dialog label small { color: var(--muted); font-size: 10px; line-height: 1.5; font-weight: 400; }
.port-dialog .port-availability { display: flex; align-items: center; gap: 12px; margin-top: 20px; padding: 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); }
.port-availability input { width: 17px; height: 17px; flex: none; accent-color: var(--ocean); }
.port-availability span { display: grid; gap: 4px; }
.port-availability strong { color: var(--ink); font-size: 12px; }
.port-form-footer { display: flex; justify-content: flex-end; gap: 10px; flex: none; padding: 16px 24px; border-top: 1px solid var(--line); background: var(--surface-soft); }
.port-dialog .port-form-footer button { min-height: 44px; margin: 0; }
.port-dialog input:focus-visible, .port-dialog button:focus-visible { outline: 2px solid var(--ocean); outline-offset: 2px; }
@media (max-width: 600px) {
  .port-modal { --width: calc(100vw - 24px); --max-height: calc(100dvh - 24px); }
  .modal-body.port-dialog { max-height: calc(100dvh - 24px); }
  .port-dialog .modal-head { padding: 18px; }
  .port-dialog .trip-modal-title { gap: 10px; align-items: flex-start; }
  .port-dialog .port-fields { padding: 18px; }
  .port-field-grid { grid-template-columns: 1fr; gap: 16px; }
  .port-form-footer { padding: 14px 18px; }
  .port-form-footer button { flex: 1; }
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.fares {
  grid-template-columns: repeat(3, 1fr);
}
.form-note {
  margin: 0;
  color: #aad0e8;
  font-size: 12px;
}
.checkbox {
  display: flex !important;
  align-items: center;
}
.checkbox input {
  width: auto;
}
.copy-row {
  display: flex;
  gap: 8px;
}
.copy-row > *:first-child {
  flex: 1;
  min-width: 0;
}
.copy-row button {
  border: 1px solid #4f82a8;
  border-radius: 7px;
  background: #234763;
  color: #d7f0ff;
  cursor: pointer;
}
.created {
  display: grid;
  gap: 12px;
}
.created p {
  margin: 0;
  color: #bed3e0;
}
.created code {
  padding: 10px;
  border: 1px solid #3c607d;
  border-radius: 8px;
  word-break: break-all;
}
@media (max-width: 950px) {
  .sidebar {
    position: fixed;
    z-index: 20;
    left: 0;
    transform: translateX(-100%);
    transition: transform 0.2s;
  }
  .sidebar.open {
    transform: none;
  }
  .scrim {
    display: block;
    position: fixed;
    z-index: 19;
    inset: 0;
    border: 0;
    background: #0009;
  }
  .menu-button {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border: 1px solid #35536a;
    border-radius: 8px;
    background: transparent;
    color: #fff;
    font-size: 20px;
  }
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .topbar {
    height: 62px;
    padding: 0 16px;
  }
  .account {
    display: none;
  }
  .content {
    padding: 24px 14px 60px;
  }
  .heading {
    align-items: start;
    flex-direction: column;
  }
  .heading h1 {
    font-size: 25px;
  }
  .heading-actions {
    width: 100%;
  }
  .heading-actions button {
    flex: 1;
  }
  .metrics {
    gap: 9px;
  }
  .metrics article {
    padding: 15px;
  }
  .metrics strong {
    font-size: 23px;
  }
  .toolbar {
    flex-wrap: wrap;
  }
  .toolbar input {
    flex-basis: 100%;
  }
  .toolbar select {
    flex: 1;
    min-width: 0;
  }
  .panel-head {
    padding: 18px 15px 12px;
  }
  .form-grid,
  .fares {
    grid-template-columns: 1fr 1fr;
  }
  .modal-body {
    margin: 3vh auto;
    max-height: 94vh;
    padding: 18px;
  }
}
.trip-row-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  width: 100%;
}
.trip-row-actions .text-action { display: inline-flex; align-items: center; justify-content: center; min-height: 32px; text-decoration: none; }
.trip-row-actions select {
  grid-column: 1 / -1;
  width: 100%;
  min-width: 0;
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-soft);
  color: var(--ink);
  font: inherit;
  font-size: 11px;
  text-transform: capitalize;
  text-align: center;
  text-align-last: center;
}
.trip-filters select { text-align: center; text-align-last: center; }
.trip-row-actions select:focus-visible { outline: 2px solid var(--ocean); outline-offset: 2px; }
.trip-row-actions select:disabled { opacity: 0.65; cursor: not-allowed; }
.trip-edit-note {
  margin: 0;
  padding: 11px 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-soft);
  color: var(--ink);
  font-size: 12px;
  line-height: 1.5;
}
.modal-body input[readonly] {
  opacity: 0.75;
  cursor: default;
}
.trip-modal {
  --width: min(940px, calc(100vw - 40px));
  --height: auto;
  --max-height: calc(100dvh - 48px);
  --border-radius: 20px;
  --background: var(--surface);
  --box-shadow: 0 24px 80px #0004;
}
.modal-body.trip-dialog {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: calc(100dvh - 48px);
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: var(--surface);
  color: var(--ink);
}
.trip-dialog .modal-head {
  flex-shrink: 0;
  margin: 0;
  padding: 24px 28px;
  border-bottom: 1px solid var(--line);
}
.trip-modal-title {
  display: flex;
  align-items: center;
  gap: 14px;
}
.trip-title-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  border-radius: 13px;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 25px;
}
.trip-modal-title .eyebrow {
  margin-bottom: 6px;
  font-size: 9px;
}
.trip-dialog .modal-head h2 {
  font-size: 22px;
  letter-spacing: -0.03em;
}
.trip-subtitle {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}
.trip-dialog .modal-head > button {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 9px;
  color: var(--muted);
  background: var(--surface-soft);
}
.trip-dialog .modal-head > button:hover {
  color: var(--ink);
  background: var(--light-blue);
}
.trip-dialog > .alert {
  flex-shrink: 0;
  margin: 16px 28px 0;
}
.trip-dialog .trip-form {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 0;
  overflow: hidden;
}
.trip-scroll {
  min-height: 0;
  padding: 24px 28px;
  overflow-y: auto;
  scrollbar-width: thin;
}
.trip-code-banner {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px 16px;
  margin-bottom: 22px;
  padding: 15px 18px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-soft);
}
.trip-dialog .trip-code-banner label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  color: var(--muted);
  font-size: 11px;
}
.trip-dialog .trip-code-banner input {
  width: 180px;
  min-height: 26px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  opacity: 1;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.025em;
}
.trip-code-badge {
  padding: 5px 8px;
  border-radius: 6px;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 10px;
  font-weight: 700;
}
.trip-code-banner > p {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}
.trip-callout {
  display: flex;
  align-items: start;
  gap: 12px;
  padding: 14px 16px;
  margin-bottom: 20px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--light-blue);
}
.trip-callout > ion-icon {
  flex-shrink: 0;
  color: var(--ocean);
  font-size: 19px;
  margin-top: 1px;
}
.trip-callout strong {
  font-size: 12px;
}
.trip-callout p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
}
.trip-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(240px, 1fr);
  gap: 20px;
  align-items: start;
}
.trip-details {
  display: grid;
  gap: 20px;
  min-width: 0;
}
.trip-section {
  display: grid;
  gap: 17px;
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 13px;
}
.trip-section-heading {
  display: flex;
  align-items: center;
  gap: 10px;
}
.trip-section-heading > span {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 9px;
  background: var(--light-blue);
  color: var(--ocean);
  font-size: 18px;
}
.trip-section-heading h3 {
  margin: 0;
  font-size: 14px;
  letter-spacing: -0.02em;
}
.trip-section-heading p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.5;
}
.trip-lock-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  color: var(--muted);
  font-size: 9px;
}
.trip-dialog label {
  color: var(--ink);
  font-size: 11px;
  gap: 8px;
}
.trip-dialog select,
.trip-dialog input {
  min-width: 0;
  min-height: 44px;
  padding: 10px 11px;
  border: 1px solid var(--line);
  background: var(--surface-soft);
  color: var(--ink);
  font-size: 12px;
  color-scheme: light;
}
.trip-dialog input:focus-visible,
.trip-dialog select:focus-visible,
.trip-dialog button:focus-visible {
  outline: 2px solid var(--ocean);
  outline-offset: 2px;
}
.trip-dialog input:disabled,
.trip-dialog select:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
.trip-dialog input[readonly] {
  opacity: 1;
}
.trip-field-hint {
  display: flex;
  align-items: start;
  gap: 6px;
  margin: 0;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.6;
}
.trip-field-hint ion-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--ocean);
  font-size: 14px;
}
.trip-fare-section {
  background: var(--surface-soft);
}
.trip-fare-values {
  display: grid;
  gap: 12px;
}
.trip-dialog .trip-regular-fare {
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--muted);
}
.trip-dialog .trip-regular-fare input {
  min-height: 36px;
  padding: 4px 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--ocean);
  font-size: 27px;
  font-weight: 800;
}
.trip-discount-fares {
  display: grid;
}
.trip-dialog .trip-discount-fares label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}
.trip-discount-fares label:last-child {
  border-bottom: 0;
}
.trip-discount-fares label > span {
  display: grid;
  gap: 4px;
}
.trip-discount-fares small {
  color: var(--muted);
  font-size: 9px;
  font-weight: 500;
}
.trip-dialog .trip-discount-fares input {
  width: 110px;
  min-height: 30px;
  padding: 4px 0;
  border: 0;
  background: transparent;
  text-align: right;
  font-size: 15px;
  font-weight: 700;
}
.trip-discount-fares input::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}
.trip-discount-fares input {
  -moz-appearance: textfield;
}
.trip-fares-empty {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 28px 10px;
  text-align: center;
}
.trip-fares-empty ion-icon {
  color: var(--ocean);
  font-size: 30px;
}
.trip-fares-empty strong {
  font-size: 12px;
}
.trip-fares-empty p {
  margin: 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
}
.trip-fare-warning {
  margin: 0;
  padding: 11px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
}
.trip-fare-warning a {
  color: var(--ocean);
}
.trip-form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
  padding: 18px 28px;
  border-top: 1px solid var(--line);
  background: var(--surface);
}
.trip-form-footer > span {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  font-size: 11px;
}
.trip-form-footer > span ion-icon {
  font-size: 16px;
  color: var(--ocean);
}
.trip-form-footer > div {
  display: flex;
  gap: 9px;
}
.trip-dialog .trip-form-footer button {
  min-height: 42px;
  margin: 0;
  padding: 0 18px;
}
:global(:root[data-theme="dark"] .trip-dialog input),
:global(:root[data-theme="dark"] .trip-dialog select) {
  color-scheme: dark;
}
@media (max-width: 740px) {
  .trip-grid {
    grid-template-columns: 1fr;
  }
  .trip-dialog .modal-head {
    padding: 20px;
  }
  .trip-scroll {
    padding: 20px;
  }
  .trip-form-footer {
    padding: 16px 20px;
  }
  .trip-form-footer > span {
    display: none;
  }
  .trip-form-footer > div {
    width: 100%;
  }
  .trip-form-footer button {
    flex: 1;
  }
}
@media (max-width: 480px) {
  .trip-modal {
    --width: calc(100vw - 16px);
    --max-height: calc(100dvh - 24px);
    --border-radius: 14px;
  }
  .modal-body.trip-dialog {
    max-height: calc(100dvh - 24px);
  }
  .trip-title-icon {
    display: none;
  }
  .trip-dialog .modal-head h2 {
    font-size: 20px;
  }
  .trip-code-banner {
    padding: 12px;
    gap: 8px;
  }
  .trip-code-badge {
    font-size: 9px;
  }
  .trip-dialog .trip-code-banner label {
    gap: 4px;
  }
  .trip-dialog .trip-code-banner input {
    width: 158px;
    font-size: 12px;
  }
  .trip-section {
    padding: 16px;
  }
  .trip-dialog .form-grid {
    grid-template-columns: 1fr;
  }
}
.boarding-help {
  display: flex;
  align-items: start;
  gap: 12px;
  margin: 0 0 20px;
  padding: 16px 18px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-soft);
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}
.boarding-help > ion-icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--ocean);
  font-size: 18px;
}
.boarding-help a {
  color: var(--ocean);
}
.boarding-help strong { color: var(--ink); font-weight: 650; }
.admin-boarding-directory .boarding-help { margin: 0 0 14px; padding: 10px 14px; border-radius: 10px; font-size: 12px; line-height: 1.5; }
.admin-boarding-directory .boarding-row-action { min-width: 0; }
.admin-boarding-directory .boarding-row-action .text-action { width: auto; min-height: 32px; padding: 5px 9px; font-size: 11px; }
.admin-boarding-directory :deep(.ag-cell[col-id="cell-5"] [data-slot="badge"]) { white-space: nowrap; }
@media (max-width: 600px) {
  .admin-boarding-directory .boarding-row-action .text-action { min-height: 44px; }
}

.boarding-row-action {
  display: flex;
  align-items: center;
}
.boarding-row-action .text-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 90px;
  min-height: 36px;
}
@media (max-width: 600px) {
  .table-wrap table,
  .table-wrap tbody,
  .table-wrap tr,
  .table-wrap td {
    display: block;
    white-space: normal;
  }
  .table-wrap thead {
    display: none;
  }
  .table-wrap tbody tr {
    padding: 14px 16px;
    border-bottom: 1px solid var(--line);
  }
  .table-wrap td {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
    padding: 8px 0;
    border: 0;
    text-align: right;
    overflow-wrap: anywhere;
  }
  .table-wrap td:before {
    content: attr(data-label);
    text-transform: uppercase;
    font-size: 9px;
    font-weight: 700;
    color: var(--muted);
    text-align: left;
    flex: none;
    max-width: 40%;
  }
  .table-wrap td[colspan] {
    display: block;
    text-align: center;
  }
  .table-wrap td[colspan]:before {
    display: none;
  }
  .table-wrap .trip-row-actions {
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .table-wrap .text-action {
    text-decoration: none;
  }
  .table-wrap td > span {
    min-width: 0;
  }
}
.user-modal {
  --width: min(620px, calc(100vw - 32px));
  --height: auto;
  --max-height: calc(100dvh - 32px);
  --border-radius: 16px;
  --background: var(--surface);
  --box-shadow: 0 24px 80px #0004;
}
.modal-body.user-dialog {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 100%;
  max-height: calc(100dvh - 32px);
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: var(--surface);
  color: var(--ink);
}
.user-dialog .modal-head {
  flex: none;
  margin: 0;
  padding: 14px 20px;
  border-bottom: 1px solid var(--line);
  align-items: start;
}
.account-title-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--light-blue);
  color: var(--ocean);
  display: grid;
  place-items: center;
  font-size: 22px;
  flex: none;
}
.user-dialog .eyebrow {
  font-size: 9px;
  margin: 0 0 7px;
  color: var(--ocean);
}
.user-dialog .modal-head h2 {
  font-size: 17px;
  letter-spacing: -0.03em;
}
.account-subtitle {
  margin: 7px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}
.user-dialog .modal-head > button {
  display: grid;
  place-items: center;
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--surface-soft);
  color: var(--muted);
}
.user-dialog > .alert {
  margin: 18px 24px 0;
  background: var(--surface-soft);
  color: #c33d4b;
  border: 1px solid #c33d4b30;
}
.account-content { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; padding: 0; }
.user-dialog .account-form { display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 0; overflow: hidden; }
.account-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 20px; overscroll-behavior: contain; }
.account-scroll fieldset { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 14px; min-width: 0; margin: 0; padding: 0; border: 0; }
.account-content .account-success { padding: 14px 20px; overflow-y: auto; }
.user-dialog > .alert { flex: none; }
.user-name-cell { display: flex; align-items: center; gap: 9px; min-width: 0; }
.user-initials { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--light-blue); color: var(--ocean); font-size: 12px; font-weight: 700; flex: none; }
.user-name-cell > div { min-width: 0; display: grid; gap: 4px; }
.user-name-cell strong { color: var(--ink); font-size: 12px; }
.user-name-cell small { color: var(--muted); font-size: 10px; }
.user-email { overflow-wrap: anywhere; }
.user-created-date { color: var(--muted); font-size: 11px; }
.account-section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 2px;
}
.account-section-heading strong {
  font-size: 13px;
}
.account-section-heading span {
  font-size: 10px;
  color: var(--muted);
}
.user-dialog label {
  gap: 8px;
  font-size: 12px;
}
.user-dialog input,
.user-dialog select {
  min-height: 40px;
  background: var(--surface-soft);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 9px;
  font-size: 13px;
  font-weight: 400;
}
.user-dialog input:focus,
.user-dialog select:focus {
  outline: 2px solid color-mix(in srgb, var(--ocean) 25%, transparent);
  outline-offset: 1px;
  border-color: var(--ocean);
}
.account-role-note {
  display: flex;
  align-items: start;
  gap: 9px;
  margin: 0;
  padding: 10px 12px;
  background: var(--surface-soft);
  border: 1px solid var(--line);
  border-radius: 9px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
}
.account-role-note ion-icon {
  color: var(--ocean);
  font-size: 17px;
  flex: none;
  margin-top: 1px;
}
.account-password-field {
  position: relative;
}
.account-password-field input {
  padding-right: 48px;
}
.account-password-visibility {
  position: absolute;
  inset: 2px 2px 2px auto;
  width: 40px;
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 19px;
  cursor: pointer;
}
.account-generate {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-top: 0;
}
.account-generate p {
  font-size: 11px;
  line-height: 1.6;
  color: var(--muted);
  margin: 0;
}
.account-generate > button,
.account-password-copy button {
  padding: 9px 13px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-soft);
  color: var(--ocean);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.account-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  border-top: 1px solid var(--line);
  padding: 12px 20px;
  margin: 0;
  flex: none;
  background: var(--surface);
}
.user-dialog .account-footer .primary {
  margin: 0;
  background: var(--action);
  border-color: var(--action);
  color: white;
  min-height: 40px;
  font-size: 12px;
}
.user-dialog .account-footer .secondary {
  min-height: 42px;
  color: var(--muted);
  border-color: var(--line);
  background: var(--surface);
}
.account-success {
  gap: 20px;
}
.account-success-heading {
  display: flex;
  align-items: center;
  gap: 13px;
}
.account-success-heading > span {
  display: grid;
  place-items: center;
  flex: none;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: #e8f7ef;
  color: #249c6f;
  font-size: 25px;
}
.account-success-heading strong {
  font-size: 15px;
}
.user-dialog .created p {
  color: var(--muted);
  margin: 6px 0 0;
  line-height: 1.6;
  font-size: 12px;
}
.account-created-details {
  margin: 0;
  padding: 14px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--surface-soft);
}
.account-created-details > div {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  font-size: 12px;
}
.account-created-details dt {
  color: var(--muted);
}
.account-created-details dd {
  margin: 0;
  font-weight: 650;
}
.account-password-copy {
  display: flex;
  align-items: center;
  gap: 10px;
}
.user-dialog .account-password-copy code {
  flex: 1;
  min-width: 0;
  background: var(--surface-soft);
  border-color: var(--line);
  color: var(--ink);
  padding: 13px;
  font-size: 13px;
  user-select: all;
}
.user-dialog .created .account-copy-notice {
  color: var(--ocean);
  font-size: 11px;
  margin: 0;
}
.account-success-heading p {
  overflow-wrap: anywhere;
}
.user-dialog button:disabled {
  opacity: 0.5;
  cursor: default;
}
@media (max-width: 600px) {
  .user-modal {
    --width: calc(100vw - 20px);
    --max-height: calc(100dvh - 24px);
    --border-radius: 16px;
  }
  .modal-body.user-dialog {
    max-height: calc(100dvh - 24px);
  }
  .user-dialog .modal-head {
    padding: 16px;
  }
  .account-scroll, .account-content .account-success {
    padding: 16px;
  }
  .account-title-icon {
    width: 36px;
    height: 36px;
    font-size: 23px;
  }
  .user-dialog .modal-head h2 {
    font-size: 17px;
  }
  .account-subtitle {
    font-size: 11px;
  }
  .account-section-heading {
    align-items: start;
    flex-direction: column;
    gap: 5px;
  }
  .account-footer > button {
    flex: 1;
  }
  .account-generate {
    gap: 10px;
  }
  .user-dialog > .alert {
    margin-inline: 20px;
  }
}

.account-section-heading, .account-role-note, .account-generate { grid-column: 1 / -1; }
.user-dialog { font-family: var(--ion-font-family); }
.user-dialog .modal-head > button { padding: 0; }
.user-dialog .account-scroll { scrollbar-width: thin; }
@media(max-width:600px) { .account-scroll fieldset { grid-template-columns: minmax(0, 1fr); } .user-dialog input, .user-dialog select { min-height:44px; font-size:16px; } .user-dialog .account-footer { padding:12px 16px; } .user-dialog .account-footer button { min-height:44px; } .account-section-heading { flex-direction:row; align-items:center; } }
.account-password-block {
  display: grid;
  gap: 8px;
}
.account-password-block > span {
  font-size: 12px;
  font-weight: 700;
}
.custom-discount-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 112px;
  gap: 12px 16px;
  align-items: end;
  padding: 16px;
  margin-top: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-soft);
}
.custom-discount-row label {
  display: grid;
  gap: 8px;
  margin-bottom: 0;
  min-width: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
}
.custom-discount-row input:not([type="checkbox"]) {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 12px;
}
.discount-percent-input { display: flex; align-items: center; gap: 6px; padding-right: 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
.custom-discount-row .discount-percent-input input { border: 0; background: transparent; text-align: center; }
.discount-percent-input > span { color: var(--muted); font-size: 12px; }
.discount-percent-input:focus-within { border-color: var(--ocean); outline: 2px solid var(--light-blue); }
.custom-discount-row input:focus-visible { outline: 2px solid var(--ocean); outline-offset: 2px; }
.custom-discount-row .custom-active {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  color: var(--ink);
}
.custom-active input {
  width: 16px;
  height: 16px;
  accent-color: var(--ocean);
}
.custom-discount-row .text-action { justify-self: end; min-height: 36px; padding: 7px 12px; color: var(--danger); border-color: var(--line); background: var(--danger-soft); font-size: 11px; }
.custom-discount-row .text-action:focus-visible { outline: 2px solid var(--danger); outline-offset: 2px; }
.custom-discounts > .secondary {
  margin-top: 16px;
}
@media (max-width: 700px) {
  .custom-discount-row {
    grid-template-columns: minmax(0, 1fr) 90px;
  }
  .custom-discount-row .text-action {
    justify-self: end;
  }
}
@media (max-width: 480px) {
  .custom-discount-row { padding: 12px; gap: 10px; }
  .fare-vessel-heading { align-items: flex-start; gap: 10px; }
  .fare-save-bar { bottom: 8px; gap: 12px; padding: 16px; }
  .fare-preview strong { font-size: 14px; }
  .fare-preview-regular strong { font-size: 18px; }
}
</style>

<style scoped>
.trip-modal { --width: min(940px, calc(100vw - 32px)); --max-height: calc(100dvh - 32px); --border-radius: 16px; }
.modal-body.trip-dialog { max-height: calc(100dvh - 32px); }
.trip-dialog .modal-head { padding: 16px 22px; }
.trip-dialog .modal-head h2 { font-size: 21px; }
.trip-dialog .trip-title-icon { width: 38px; height: 38px; border-radius: 10px; font-size: 22px; }
.trip-dialog .trip-scroll { padding: 16px 22px; }
.trip-dialog .trip-code-banner { padding: 10px 14px; margin-bottom: 14px; gap: 3px 12px; }
.trip-dialog .trip-code-banner > p { font-size: 10px; }
.trip-dialog .trip-grid { grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 14px; align-items: start; }
.trip-dialog .trip-details { display: contents; }
.trip-dialog .trip-section { padding: 16px; gap: 12px; border-radius: 11px; }
.trip-dialog .trip-section-heading { gap: 9px; }
.trip-dialog .trip-section-heading h3 { font-size: 14px; }
.trip-dialog .trip-section-heading p { font-size: 11px; }
.trip-dialog .trip-section-heading > span { width: 30px; height: 30px; font-size: 17px; }
.trip-dialog .trip-details > .trip-section:nth-child(2) .form-grid { grid-template-columns: minmax(0, 1fr); }
.trip-dialog .form-grid { gap: 12px; }
.trip-dialog label { font-size: 12px; gap: 6px; }
.trip-dialog input, .trip-dialog select { min-height: 40px; padding: 8px 10px; font-family: inherit; font-size: 12px; }
.trip-dialog .trip-code-banner input { min-height: 24px; padding: 0; }
.trip-dialog .trip-fare-section { grid-column: 1 / -1; }
.trip-dialog .trip-fare-values { grid-template-columns: 160px minmax(0, 1fr); gap: 16px; align-items: start; }
.trip-dialog .trip-regular-fare { padding: 12px; gap: 4px; }
.trip-dialog .trip-regular-fare input { font-size: 25px; min-height: 32px; }
.trip-dialog .trip-discount-fares { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 16px; }
.trip-dialog .trip-discount-fares label { padding: 7px 0; gap: 8px; font-size: 11px; }
.trip-dialog .trip-discount-fares input { width: 70px; min-height: 28px; font-size: 13px; padding: 2px 0; }
.trip-dialog .trip-fares-empty { grid-template-columns: 30px auto minmax(0, 1fr); align-items: center; justify-items: start; gap: 12px; padding: 10px 0; text-align: left; }
.trip-dialog .trip-fares-empty ion-icon { font-size: 26px; }.trip-dialog .trip-fares-empty p { font-size: 12px; }
.trip-dialog .trip-form-footer { padding: 12px 22px; }
.trip-dialog .trip-form-footer button { min-height: 40px; }
.fare-settings-panel .fare-base-card { display: grid; grid-template-columns: minmax(0, 1fr) minmax(170px, .85fr); align-items: center; gap: 16px; }
.fare-base-card .fare-card-heading { margin-bottom: 0; align-items: flex-start; }
.fare-settings-panel .regular-fare-control { min-width: 0; }
.fare-settings-panel .regular-fare-control > label { font-size: 10px; color: var(--muted); margin-bottom: 6px; }
.fare-settings-panel .fare-base-input input { min-height: 44px; font-size: 23px; padding: 8px 10px; }
.fare-settings-panel .fare-base-input > span { padding-left: 12px; font-size: 11px; }
.fare-settings-panel .fare-base-card .fare-hint { font-size: 10px; margin-top: 6px; }
.fare-settings-panel .discount-count { flex: none; margin-left: auto; padding: 4px 7px; border-radius: 6px; background: var(--light-blue); color: var(--ocean); font-size: 10px; font-weight: 600; white-space: nowrap; }
.fare-settings-panel .custom-discounts .fare-card-heading { align-items: flex-start; gap: 10px; }
.fare-settings-panel .custom-discounts .fare-card-heading p { font-size: 11px; }
.fare-settings-panel .custom-discount-row { grid-template-columns: minmax(0, 1fr) 76px 74px 52px; padding: 12px 0; gap: 10px; margin-top: 0; border: 0; border-top: 1px solid var(--line); border-radius: 0; background: transparent; }
.fare-settings-panel .custom-discount-row label { gap: 5px; font-size: 10px; }
.fare-settings-panel .custom-discount-row input:not([type="checkbox"]) { min-height: 38px; padding: 8px 10px; background: var(--surface-soft); }
.fare-settings-panel .custom-discount-row .discount-percent-input { background: var(--surface-soft); padding-right: 8px; gap: 3px; }
.fare-settings-panel .custom-discount-row .discount-percent-input input { background: transparent; padding-inline: 6px; }
.fare-settings-panel .custom-discount-row .custom-active { min-height: 38px; gap: 6px; font-size: 11px; }
.fare-settings-panel .custom-discount-row .text-action { min-height: 38px; padding: 8px; border: 0; background: transparent; font-size: 11px; }
.fare-settings-panel .custom-discount-row .text-action:hover { background: var(--danger-soft); }
.fare-settings-panel .discount-row-inactive { background: var(--surface-soft); }
.fare-settings-panel .discount-row-inactive .custom-active { color: var(--muted); }
.fare-settings-panel .custom-discounts > .secondary { margin-top: 8px; min-height: 36px; font-size: 11px; }
.fare-settings-panel .fare-save-bar { border-radius: 12px; }
.fare-settings-panel .fare-save-bar .primary { min-height: 40px; font-size: 12px; }
.fare-settings-panel .fare-save-bar strong { font-size: 12px; }
.fare-settings-panel .fare-save-bar p { font-size: 10px; }
@media (min-width: 1001px) { .fare-settings-panel .fare-layout { grid-template-columns: minmax(0, 1.8fr) minmax(250px, 1fr); } }
@media (max-width: 1000px) {
  .fare-settings-panel .fare-layout { grid-template-columns: 1fr; }
  .fare-settings-panel .fare-preview-card { position: static; max-height: none; }
  .fare-settings-panel .fare-preview { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 18px; }
  .fare-settings-panel .fare-preview-regular { grid-column: 1 / -1; }
}
@media (max-width: 600px) {
  .fare-settings-panel .fare-vessel-picker { padding: 16px; gap: 12px; }
  .fare-settings-panel .fare-base-card { grid-template-columns: 1fr; }
  .fare-settings-panel .fare-card, .fare-settings-panel .fare-preview-card { padding: 16px; }
  .fare-settings-panel .custom-discount-row { grid-template-columns: minmax(0, 1fr) 85px; gap: 8px 12px; }
  .fare-settings-panel .discount-count { font-size: 9px; }
  .fare-settings-panel .fare-save-bar { padding: 14px 16px; gap: 12px; }
}
@media (max-width: 380px) { .fare-settings-panel .fare-preview { grid-template-columns: 1fr; } }
@media (max-width: 740px) {
  .trip-dialog .trip-grid { grid-template-columns: minmax(0, 1fr); }
  .trip-dialog .trip-fare-values { grid-template-columns: minmax(0, 1fr); }
  .trip-dialog .trip-discount-fares { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .trip-dialog .trip-fares-empty { grid-template-columns: 30px minmax(0, 1fr); }.trip-dialog .trip-fares-empty p { grid-column: 2; }
  .trip-dialog .modal-head, .trip-dialog .trip-scroll, .trip-dialog .trip-form-footer { padding: 16px; }
}
</style>
