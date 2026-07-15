"use client";

import { useActionState, useState } from "react";
import { createVenture, type CreateVentureResult } from "@/lib/venture/actions";
import { STAGES, type StageId } from "@/lib/stages";

type Field = "name" | "problem" | "industry" | "region";

type Step =
  | { field: Field; question: string; sub: string; placeholder: string; multiline?: boolean }
  | { field: "stage"; question: string; sub: string };

const STEPS: Step[] = [
  {
    field: "name",
    question: "What's the name of your venture?",
    sub: "Don't have one yet? A working title is fine.",
    placeholder: "e.g. Sherbro Digital Bank",
  },
  {
    field: "problem",
    question: "What problem are you solving?",
    sub: "One or two sentences — who has the pain, and what is it?",
    placeholder: "e.g. 80% of Sierra Leoneans lack access to formal banking",
    multiline: true,
  },
  {
    field: "industry",
    question: "What industry are you in?",
    sub: "This drives which benchmarks, regulations, and competitors your agents reach for.",
    placeholder: "e.g. Fintech, SaaS, Biotech, E-commerce",
  },
  {
    field: "region",
    question: "Where's your target market?",
    sub: "Region, country, or city. The more specific, the less generic the advice.",
    placeholder: "e.g. West Africa, United Kingdom, US East Coast",
  },
  {
    field: "stage",
    question: "Where are you in the journey?",
    sub: "This determines which agents and actions get prioritised for you.",
  },
];

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({ stage: "ideation" });
  const [state, formAction, pending] = useActionState<CreateVentureResult | null, FormData>(
    createVenture,
    null,
  );

  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;
  // Only the name is genuinely required — the rest sharpen the advice but
  // shouldn't block someone who wants to look around first.
  const canAdvance = current.field === "name" ? Boolean(values.name?.trim()) : true;

  function set(field: string, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <form action={formAction} style={{ width: "100%", maxWidth: 460 }}>
        {/* Every answer rides along on every submit, not just the visible step. */}
        {Object.entries(values).map(([field, value]) => (
          <input key={field} type="hidden" name={field} value={value} />
        ))}

        <div style={{ display: "flex", gap: 4, marginBottom: 32 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                background: i <= step ? "var(--accent)" : "var(--border)",
                transition: "background 0.3s",
              }}
            />
          ))}
        </div>

        <div
          style={{
            fontSize: 11,
            color: "var(--accent)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 8,
          }}
        >
          Step {step + 1} of {STEPS.length}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, lineHeight: 1.3 }}>
          {current.question}
        </h2>
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>{current.sub}</p>

        {current.field === "stage" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {STAGES.map((stage) => {
              const selected = values.stage === stage.id;
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => set("stage", stage.id satisfies StageId)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: selected ? `2px solid ${stage.color}` : "1px solid var(--border)",
                    background: selected
                      ? `color-mix(in srgb, ${stage.color} 12%, transparent)`
                      : "var(--card)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                    textAlign: "left",
                    color: "var(--text)",
                  }}
                >
                  <span style={{ fontSize: 20 }}>{stage.icon}</span>
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: selected ? stage.color : "var(--text)",
                      }}
                    >
                      {stage.label}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--dim)" }}>{stage.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : current.multiline ? (
          <textarea
            key={current.field}
            autoFocus
            rows={3}
            value={values[current.field] ?? ""}
            onChange={(e) => set(current.field, e.target.value)}
            placeholder={current.placeholder}
            style={inputStyle}
          />
        ) : (
          <input
            key={current.field}
            autoFocus
            value={values[current.field] ?? ""}
            onChange={(e) => set(current.field, e.target.value)}
            placeholder={current.placeholder}
            onKeyDown={(e) => {
              // Enter advances rather than submitting — otherwise step 1 creates
              // the venture before we've asked anything else.
              if (e.key === "Enter" && !isLast) {
                e.preventDefault();
                if (canAdvance) setStep(step + 1);
              }
            }}
            style={inputStyle}
          />
        )}

        {state?.error && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              borderRadius: 8,
              background: "color-mix(in srgb, var(--red) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)",
              fontSize: 12,
            }}
          >
            {state.error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              style={{
                padding: "12px 20px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "none",
                color: "var(--muted)",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Back
            </button>
          )}

          {isLast ? (
            <button
              type="submit"
              disabled={pending}
              style={{ ...primaryButtonStyle, opacity: pending ? 0.6 : 1 }}
            >
              {pending ? "Creating…" : "Launch dashboard →"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canAdvance}
              style={{
                ...primaryButtonStyle,
                background: canAdvance ? "var(--accent)" : "var(--border)",
                color: canAdvance ? "#fff" : "var(--dim)",
                cursor: canAdvance ? "pointer" : "not-allowed",
              }}
            >
              Continue
            </button>
          )}
        </div>

        <p
          style={{
            fontSize: 11,
            color: "var(--dim)",
            marginTop: 18,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          Everything here becomes context your agents share. You can change any of it later.
        </p>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--input)",
  color: "var(--text)",
  fontSize: 15,
  outline: "none",
  resize: "vertical",
};

const primaryButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: 12,
  borderRadius: 10,
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};
