        <section className="mt-8" aria-labelledby="stage4-title">
          <div className="card p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-accent">
                  Stage 4
                </p>
                <h2
                  id="stage4-title"
                  className="mt-2 text-2xl font-bold tracking-tight text-ink"
                >
                  Offer Stage
                </h2>
              </div>
              <StatusBadge status={stageFourStatus} />
            </div>

            {stageFourStatus === 'Locked' ? (
              <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                Offer stage unlocks after screening approval.
              </p>
            ) : !offer || offer.status === 'Draft' ? (
              <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                Offer details will appear here when released by admin.
              </p>
            ) : offer.status === 'Accepted' ? (
              <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                Offer accepted. Employment agreement stage is now available.
              </p>
            ) : offer.status === 'Declined' ? (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
                Offer declined.
              </p>
            ) : offer.status === 'Withdrawn' || offerExpired || offer.status === 'Expired' ? (
              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                This offer is no longer open for decision.
              </p>
            ) : (
              <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                  <h3 className="text-lg font-bold text-ink">Offer details</h3>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                    <p>
                      <strong>Role offered:</strong> {offer.roleOffered}
                    </p>
                    <p>
                      <strong>Salary/compensation:</strong> {offer.salary}
                    </p>
                    <p>
                      <strong>Start date:</strong> {formatDate(offer.startDate)}
                    </p>
                    <p>
                      <strong>Work mode:</strong> {offer.workMode}
                    </p>
                    <p>
                      <strong>Reporting manager:</strong>{' '}
                      {offer.reportingManager ?? '—'}
                    </p>
                    <p>
                      <strong>Probation period:</strong>{' '}
                      {offer.probationPeriod ?? '—'}
                    </p>
                    <p>
                      <strong>Offer expiry:</strong>{' '}
                      {formatDate(offer.offerExpiryDate)}
                    </p>
                    {offer.specialConditions ? (
                      <p className="whitespace-pre-wrap rounded-xl bg-white p-3">
                        <strong>Special conditions:</strong>{' '}
                        {offer.specialConditions}
                      </p>
                    ) : null}
                  </div>
                </div>

                <form
                  action={submitOfferDecision}
                  className="space-y-4 rounded-2xl border border-slate-200 p-4 sm:p-5"
                >
                  <input type="hidden" name="session" value={session ?? ''} />
                  <h3 className="font-bold text-ink">Your decision</h3>

                  <label className="block text-sm font-semibold">
                    Optional decision note
                    <textarea
                      className="input mt-1 min-h-24"
                      name="candidateDecisionNote"
                    />
                  </label>

                  <label className="flex gap-2 text-sm font-semibold">
                    <input name="confirmation" type="checkbox" required />I
                    confirm my selected offer decision.
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <button
                      className="btn btn-primary"
                      name="decision"
                      value="accept"
                      type="submit"
                    >
                      Accept Offer
                    </button>
                    <button
                      className="rounded-full border border-red-300 px-5 py-2 font-semibold text-red-700"
                      name="decision"
                      value="decline"
                      type="submit"
                    >
                      Decline Offer
                    </button>
                  </div>

                  <p className="text-xs text-slate-500">Submitting...</p>
                </form>
              </div>
            )}

            <p className="mt-4 text-sm font-semibold text-slate-700">
              Stage 5 status:{' '}
              {stageFiveStatus === 'Available'
                ? 'Available — employment agreement stage is now available.'
                : stageFiveStatus}
            </p>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="portal-documents-title">
          <div className="card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-widest text-accent">
                  Documents
                </p>
                <h2
                  id="portal-documents-title"
                  className="mt-2 text-2xl font-bold tracking-tight text-ink"
                >
                  Application documents
                </h2>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-bold text-ink">Submitted documents</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Submitted documents are available for admin review. You can
                track your application status here.
              </p>
            </div>
          </div>
        </section>