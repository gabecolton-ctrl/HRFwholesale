"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { buyListAction, previewListAction, type PreviewState } from "../actions";

type Preset = { key: string; label: string; description: string };

const TOGGLES: [string, string][] = [
  ["vacant", "Vacant"],
  ["pre_foreclosure", "Pre-foreclosure"],
  ["absentee_owner", "Absentee owner"],
  ["high_equity", "High equity"],
  ["free_clear", "Free & clear"],
  ["out_of_state_owner", "Out-of-state owner"],
];

function Buttons({ preview, price }: { preview: PreviewState; price: number }) {
  const { pending } = useFormStatus();
  const cost = preview.maxCredits ? preview.maxCredits * price : null;
  return (
    <div className="col-span-full flex flex-wrap items-center gap-3">
      <button type="submit" className="btn btn-dark" disabled={pending}>{pending ? "Checking…" : "Preview (free)"}</button>
      {preview.capped ? (
        <button
          type="submit"
          formAction={buyListAction}
          className="btn btn-primary"
          disabled={pending}
          onClick={(e) => {
            if (!confirm(`Buy ${preview.capped?.toLocaleString()} properties for up to $${cost?.toFixed(2)}? This charges your Tracerfy credits.`)) e.preventDefault();
          }}
        >
          Buy {preview.capped.toLocaleString()} for up to ${cost?.toFixed(2)}
        </button>
      ) : null}
    </div>
  );
}

export function ListBuilder({ presets, states, price }: { presets: Preset[]; states: [string, string][]; price: number }) {
  const [preview, previewAction] = useActionState(previewListAction, {});
  const [strategy, setStrategy] = useState(presets.find((p) => /pre.?foreclos/i.test(p.key))?.key ?? presets[0]?.key ?? "custom");
  const chosen = presets.find((p) => p.key === strategy);

  return (
    <form action={previewAction} className="card grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
      <div className="col-span-full">
        <label className="label" htmlFor="strategy">What kind of owners?</label>
        <select id="strategy" name="strategy" className="input" value={strategy} onChange={(e) => setStrategy(e.target.value)}>
          {presets.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          {!presets.some((p) => p.key === "custom") && <option value="custom">Custom (just my checkboxes below)</option>}
        </select>
        <input type="hidden" name="strategy_label" value={chosen?.label ?? "Custom"} />
        {chosen?.description && <p className="hint mt-1">{chosen.description}</p>}
      </div>

      <div>
        <label className="label" htmlFor="state">State</label>
        <select id="state" name="state" className="input" defaultValue="TX">
          {states.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="counties">Counties (optional)</label>
        <input id="counties" name="counties" className="input" placeholder="Dallas, Tarrant" />
        <p className="hint">Leave blank for the whole state.</p>
      </div>
      <div className="col-span-full">
        <label className="label" htmlFor="zips">Or ZIP codes instead (optional)</label>
        <input id="zips" name="zips" className="input" placeholder="75216, 75217, 75227" inputMode="numeric" />
      </div>

      <fieldset className="col-span-full">
        <legend className="label">Only include (optional)</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TOGGLES.map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" name={k} className="check mt-0" /> {l}</label>
          ))}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="sfr_only" className="check mt-0" defaultChecked /> Single-family only</label>
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor="count">How many (max)</label>
        <input id="count" name="count" type="number" min={1} max={5000} defaultValue={100} className="input" />
        <p className="hint">About ${(price * 5).toFixed(2)} each, with owner phones and emails included.</p>
      </div>

      <div aria-live="polite" className="flex items-end">
        {preview.error ? (
          <p className="rounded-lg bg-danger/5 px-3 py-2 text-sm text-danger">{preview.error}</p>
        ) : preview.at ? (
          <p className="text-sm">
            <b>{(preview.total ?? 0).toLocaleString()}</b> properties match.{" "}
            {preview.total ? <>You&apos;d get <b>{(preview.capped ?? 0).toLocaleString()}</b>.</> : "Try a bigger area or fewer filters."}
          </p>
        ) : (
          <p className="text-sm text-ink-soft">Preview shows how many match. It&apos;s free.</p>
        )}
      </div>

      <Buttons preview={preview} price={price} />
    </form>
  );
}
