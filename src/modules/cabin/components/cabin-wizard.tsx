"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form-controls";
import { Spinner } from "@/components/ui/spinner";
import {
  feeRateLabel,
  formatXof,
  normalizeCiPhone,
  prefixNetwork,
  SERVICE_FAMILIES,
  SERVICE_SHAPES,
  STATUS_META,
  type CabinService,
} from "../domain/cabin";
import { confirmCabinAction, followCabinAction, quoteCabinAction, type ConfirmState, type OperationView, type QuoteState } from "../server/actions";
import type { CabinCatalog } from "../server/queries";

const STEPS = ["Service", "Réseau", "Destinataire", "Montant", "Récapitulatif", "Confirmation"] as const;

const PREFIX_NAMES = { orange: "Orange", mtn: "MTN", moov: "Moov" } as const;

const CHOICE = "flex min-h-11 w-full items-center justify-between gap-2 rounded-control border px-3 py-2 text-left text-sm font-semibold transition-colors";
const choiceClass = (selected: boolean, disabled = false) =>
  cn(CHOICE, disabled ? "cursor-not-allowed border-border bg-sand-50 text-ink-subtle" : selected ? "border-brand-600 bg-brand-50" : "border-border bg-surface hover:border-border-strong");

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex gap-1" aria-label={`Étape ${step + 1} sur ${STEPS.length} : ${STEPS[step]}`}>
      {STEPS.map((label, index) => (
        <li key={label} className="flex flex-1 flex-col gap-1" aria-current={index === step ? "step" : undefined}>
          <span className={cn("h-1.5 rounded-pill", index <= step ? "bg-brand-600" : "bg-border")} />
          <span className={cn("hidden text-xs sm:block", index === step ? "font-bold text-ink" : "text-ink-muted")}>
            {index + 1}. {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function OperationStatus({ operation }: { operation: OperationView }) {
  const meta = STATUS_META[operation.status];
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        {operation.mode === "demo" && <Badge tone="warning">Démonstration</Badge>}
        <span className="text-sm text-ink-muted">Référence {operation.reference}</span>
      </div>
      <p className="text-sm">{operation.statusReason ?? meta.explanation}</p>
      {operation.status === "succeeded" && operation.deliveryCode && (
        <div className="rounded-card border border-success bg-success-soft p-3">
          <p className="text-sm font-semibold">Code de recharge fourni par le prestataire</p>
          <p className="font-mono text-xl tracking-wider">{operation.deliveryCode}</p>
        </div>
      )}
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
        <dt className="text-ink-muted">Destinataire</dt>
        <dd>{operation.recipientMasked}</dd>
        <dt className="text-ink-muted">Total</dt>
        <dd className="font-bold">{formatXof(operation.total)}</dd>
      </dl>
      {!meta.final && <p className="text-xs text-ink-muted">Cette page se met à jour toute seule. Ne relancez pas l’opération.</p>}
    </div>
  );
}

/**
 * Cabine en ligne : six étapes sur un seul écran. Les frais et le total sont
 * calculés par le serveur (récapitulatif signé) ; la confirmation porte une clé
 * d'idempotence qui empêche toute double opération.
 */
export function CabinWizard({ catalog }: { catalog: CabinCatalog }) {
  const [step, setStep] = useState(0);
  const [service, setService] = useState<CabinService | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [sender, setSender] = useState("");
  const [amount, setAmount] = useState("");
  const [offerId, setOfferId] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteState>({ status: "idle" });
  const [result, setResult] = useState<ConfirmState>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  // Une clé par récapitulatif : un double clic ou un renvoi réseau ne crée pas de seconde opération.
  const idempotencyKey = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const settings = catalog.services.find((item) => item.service === service);
  const shape = service ? SERVICE_SHAPES[service] : null;
  const networks = catalog.networks.filter((item) => shape && item.kind === shape.networkKind);
  const route = service === "money_transfer" ? catalog.routes.find((item) => item.source_code === network && item.target_code === target) : undefined;
  const offers = catalog.offers.filter((item) => item.network_code === network);

  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  // Suivi : rafraîchi tant que l'opération n'est pas dans un état final.
  const operation = result.status === "success" ? result.operation : null;
  useEffect(() => {
    if (!operation || STATUS_META[operation.status].final) return;
    const timer = window.setInterval(() => {
      void followCabinAction(operation.reference).then((next) => {
        if (next) setResult((current) => (current.status === "success" ? { ...current, operation: next } : current));
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [operation]);

  function go(next: number) {
    if (next < 4) {
      setQuote({ status: "idle" });
      idempotencyKey.current = null;
    }
    setStep(next);
  }

  function requestQuote() {
    if (!service || !network) return;
    setStep(4);
    setQuote({ status: "idle" });
    setResult({ status: "idle" });
    startTransition(async () => {
      const next = await quoteCabinAction({
        service,
        network,
        targetNetwork: service === "money_transfer" ? target : null,
        offerId: shape?.usesOffers ? offerId : null,
        recipient,
        sender: shape?.sender ? sender : null,
        amount: shape?.usesOffers ? null : Number(amount.replace(/\s/g, "")) || null,
      });
      idempotencyKey.current = next.status === "success" ? crypto.randomUUID() : null;
      setQuote(next);
    });
  }

  function confirm() {
    if (quote.status !== "success" || !idempotencyKey.current) return;
    const key = idempotencyKey.current;
    setStep(5);
    startTransition(async () => {
      const next = await confirmCabinAction({ token: quote.token, idempotencyKey: key, recipient, sender: shape?.sender ? sender : null });
      setResult(next);
      if (next.status === "success" && next.redirectUrl) window.location.assign(next.redirectUrl);
    });
  }

  function restart() {
    setService(null);
    setNetwork(null);
    setTarget(null);
    setRecipient("");
    setSender("");
    setAmount("");
    setOfferId(null);
    setQuote({ status: "idle" });
    setResult({ status: "idle" });
    idempotencyKey.current = null;
    setStep(0);
  }

  const phone = shape?.recipient === "phone" ? normalizeCiPhone(recipient) : null;
  const prefix = phone ? prefixNetwork(phone) : null;
  const recipientOk = shape?.recipient === "meter" ? /^\d{8,20}$/.test(recipient.replace(/[\s.-]/g, "")) : Boolean(phone);
  const senderOk = !shape?.sender || Boolean(normalizeCiPhone(sender));
  const amountValue = Number(amount.replace(/\s/g, ""));
  const amountOk = shape?.usesOffers ? Boolean(offerId) : Boolean(settings && amountValue >= settings.min_amount_xof && amountValue <= settings.max_amount_xof);

  return (
    <div className="flex flex-col gap-5">
      <Stepper step={step} />
      <h2 ref={heading} tabIndex={-1} className="text-xl font-bold focus:outline-none">
        {step + 1}. {STEPS[step]}
      </h2>

      {step > 0 && step < 5 && (
        <button type="button" onClick={() => go(step - 1)} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-brand-700 hover:underline">
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Étape précédente
        </button>
      )}

      {step === 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {SERVICE_FAMILIES.map((family) => (
            <fieldset key={family.title} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
              <legend className="px-1 font-bold">{family.title}</legend>
              {family.services.map((code) => {
                const item = catalog.services.find((entry) => entry.service === code);
                if (!item) return null;
                return (
                  <button
                    key={code}
                    type="button"
                    disabled={!item.is_enabled}
                    onClick={() => {
                      setService(code);
                      setNetwork(null);
                      setTarget(null);
                      setOfferId(null);
                      setAmount("");
                      go(1);
                    }}
                    className={choiceClass(service === code, !item.is_enabled)}
                  >
                    <span className="flex flex-col">
                      <span>{item.label}</span>
                      <span className="text-xs font-normal text-ink-muted">{item.is_enabled ? item.description : "Service suspendu par l’équipe."}</span>
                    </span>
                    <Badge tone={!item.is_enabled ? "neutral" : item.mode === "live" ? "success" : "warning"}>
                      {!item.is_enabled ? "Suspendu" : item.mode === "live" ? "Disponible" : "Démonstration"}
                    </Badge>
                  </button>
                );
              })}
            </fieldset>
          ))}
        </div>
      )}

      {step === 1 && shape && (
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">{service === "money_transfer" ? "Réseau de départ (votre portefeuille)" : service === "electricity" ? "Fournisseur" : "Réseau"}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {networks.map((item) => (
                <button key={item.code} type="button" disabled={!item.is_active} onClick={() => setNetwork(item.code)} className={choiceClass(network === item.code, !item.is_active)} aria-pressed={network === item.code}>
                  {item.name}
                  {network === item.code ? <Check aria-hidden className="h-4 w-4 text-brand-700" /> : !item.is_active ? <Badge>Suspendu</Badge> : null}
                </button>
              ))}
            </div>
          </fieldset>
          {service === "money_transfer" && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold">Réseau d’arrivée (destinataire)</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {networks
                  .filter((item) => item.code !== network)
                  .map((item) => {
                    const combination = catalog.routes.find((entry) => entry.source_code === network && entry.target_code === item.code);
                    return (
                      <button key={item.code} type="button" disabled={!item.is_active || !network} onClick={() => setTarget(item.code)} className={choiceClass(target === item.code, !item.is_active || !network)} aria-pressed={target === item.code}>
                        {item.name}
                        <Badge tone={combination?.live ? "success" : "warning"}>{combination?.live ? "Pris en charge" : "Non pris en charge"}</Badge>
                      </button>
                    );
                  })}
              </div>
              {route && !route.live && (
                <Alert tone="warning" title="Combinaison non prise en charge">
                  {route.note ?? "Aucun prestataire connecté ne prend en charge cette combinaison."} Vous pouvez parcourir la démonstration, aucun transfert ne sera
                  effectué.
                </Alert>
              )}
            </fieldset>
          )}
          <Button variant="primary" disabled={!network || (service === "money_transfer" && !target)} onClick={() => go(2)} className="self-start">
            Continuer
          </Button>
        </div>
      )}

      {step === 2 && shape && (
        <div className="flex max-w-md flex-col gap-4">
          {shape.sender && (
            <Field label={service === "money_transfer" ? "Numéro du portefeuille débité" : "Numéro qui transfère les unités"} hint="Vous autoriserez l’opération dans le parcours sécurisé de votre opérateur. Ne communiquez jamais votre code secret.">
              {(props) => <Input {...props} value={sender} onChange={(event) => setSender(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="07 00 00 00 00" />}
            </Field>
          )}
          <Field
            label={shape.recipient === "meter" ? "Numéro du compteur CIE" : service === "money_transfer" ? "Numéro du destinataire" : "Numéro à recharger"}
            hint={shape.recipient === "meter" ? "Chiffres inscrits sur le compteur ou la carte (le format exact est vérifié par le fournisseur)." : "10 chiffres, avec ou sans +225."}
          >
            {(props) => (
              <Input {...props} value={recipient} onChange={(event) => setRecipient(event.target.value)} inputMode="numeric" autoComplete={shape.recipient === "phone" ? "tel" : "off"} />
            )}
          </Field>
          {prefix && networks.some((item) => item.code === prefix) && network && network !== prefix && (
            <Alert tone="info">
              Ce numéro commence par un préfixe {PREFIX_NAMES[prefix]}. Vérifiez le réseau choisi (sauf numéro porté vers un autre opérateur).
            </Alert>
          )}
          <Button variant="primary" disabled={!recipientOk || !senderOk} onClick={() => go(3)} className="self-start">
            Continuer
          </Button>
        </div>
      )}

      {step === 3 && shape && settings && (
        <div className="flex max-w-xl flex-col gap-4">
          {shape.usesOffers ? (
            offers.length === 0 ? (
              <Alert tone="warning" title="Aucune offre disponible pour ce réseau">
                Les offres Internet, leurs prix et leurs volumes proviennent du catalogue réel de l’opérateur ou de l’administration. Aucun catalogue n’est
                encore configuré : rien n’est proposé plutôt que des tarifs inventés.
              </Alert>
            ) : (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-semibold">Offre</legend>
                {offers.map((offer) => (
                  <button key={offer.id} type="button" onClick={() => setOfferId(offer.id)} className={choiceClass(offerId === offer.id)} aria-pressed={offerId === offer.id}>
                    <span className="flex flex-col">
                      <span>{offer.name}</span>
                      <span className="text-xs font-normal text-ink-muted">
                        {[offer.data_volume, offer.validity].filter(Boolean).join(" · ")} — tarif relevé le {new Date(offer.checked_on).toLocaleDateString("fr-FR")}
                      </span>
                    </span>
                    <span>{formatXof(offer.price_xof)}</span>
                  </button>
                ))}
              </fieldset>
            )
          ) : (
            <>
              {shape.quickAmounts.length > 0 && (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Montants courants">
                  {shape.quickAmounts.map((value) => (
                    <button key={value} type="button" onClick={() => setAmount(String(value))} className={cn(choiceClass(amountValue === value), "w-auto")} aria-pressed={amountValue === value}>
                      {formatXof(value)}
                    </button>
                  ))}
                </div>
              )}
              <Field label="Montant (F CFA)" hint={`Entre ${formatXof(settings.min_amount_xof)} et ${formatXof(settings.max_amount_xof)}. Frais de service : ${feeRateLabel(settings.fee_bps)}, affichés avant confirmation.`}>
                {(props) => <Input {...props} value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" pattern="[0-9 ]*" />}
              </Field>
            </>
          )}
          <Button variant="primary" disabled={!amountOk} onClick={requestQuote} className="self-start">
            Voir le récapitulatif
          </Button>
        </div>
      )}

      {step === 4 && (
        <div className="flex max-w-xl flex-col gap-4">
          {(pending || quote.status === "idle") && <Spinner label="Calcul du récapitulatif et des frais" />}
          {quote.status === "error" && (
            <Alert tone="danger" title="Vérification impossible">
              {quote.message}
            </Alert>
          )}
          {quote.status === "success" && (
            <>
              {quote.quote.mode === "demo" && (
                <Alert tone="warning" title="Démonstration : aucun paiement ne sera effectué">
                  {quote.modeReason} {quote.routeNote} Les montants ci-dessous sont calculés comme pour une vraie opération.
                </Alert>
              )}
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 rounded-card border border-border bg-surface p-4 text-sm">
                <dt>{settings?.label}</dt>
                <dd className="text-right">{quote.recipientMasked}</dd>
                <dt>Montant du service</dt>
                <dd className="text-right">{formatXof(quote.quote.amount)}</dd>
                <dt>Frais de service ({feeRateLabel(quote.quote.feeBps)})</dt>
                <dd className="text-right">{formatXof(quote.quote.serviceFee)}</dd>
                <dt>Frais du fournisseur</dt>
                <dd className="text-right">{quote.quote.mode === "live" ? formatXof(quote.quote.providerFee) : "Aucun (pas de fournisseur connecté)"}</dd>
                <dt className="border-t border-border pt-2 text-base font-bold">Total à payer</dt>
                <dd className="border-t border-border pt-2 text-right text-base font-bold">{formatXof(quote.quote.total)}</dd>
              </dl>
              <p className="text-xs text-ink-muted">
                Frais arrondis au franc CFA le plus proche. Ce récapitulatif est valable jusqu’à{" "}
                {new Date(quote.quote.expiresAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} ; aucun frais ne s’ajoute après
                confirmation. La plateforme ne vous demandera jamais votre code secret.
              </p>
              <Button variant={quote.quote.mode === "demo" ? "secondary" : "accent"} size="lg" onClick={confirm} disabled={pending}>
                {quote.quote.mode === "demo" ? "Terminer la démonstration (aucun paiement)" : `Confirmer et payer ${formatXof(quote.quote.total)}`}
              </Button>
            </>
          )}
        </div>
      )}

      {step === 5 && (
        <div className="flex max-w-xl flex-col gap-4">
          {pending && <Spinner label="Enregistrement de l’opération" />}
          {result.status === "error" && (
            <>
              <Alert tone="danger" title="Opération non lancée">
                {result.message}
              </Alert>
              {result.requote && (
                <Button variant="primary" onClick={requestQuote} className="self-start">
                  Revoir le récapitulatif
                </Button>
              )}
            </>
          )}
          {result.status === "success" && <OperationStatus operation={result.operation} />}
          {!pending && (
            <Button variant="secondary" onClick={restart} className="self-start">
              Nouvelle opération
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
