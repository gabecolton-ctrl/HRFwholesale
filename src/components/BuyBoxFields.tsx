import { PROPERTY_TYPES, REHAB_LEVELS, STRATEGIES } from "@/lib/constants";

type Defaults = {
  areas?: string[] | string;
  price_min?: number | string | null;
  price_max?: number | string | null;
  property_types?: string[];
  rehab_levels?: string[];
  strategies?: string[];
};

function CheckGroup({ name, legend, options, checked }: { name: string; legend: string; options: readonly string[]; checked?: string[] }) {
  return (
    <fieldset>
      <legend className="label">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm has-[:checked]:border-clay has-[:checked]:bg-clay/5">
            <input type="checkbox" name={name} value={o} defaultChecked={checked?.includes(o)} className="check mt-0" />
            {o}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function BuyBoxFields({ d = {} }: { d?: Defaults }) {
  const areas = Array.isArray(d.areas) ? d.areas.join(", ") : d.areas ?? "";
  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="areas" className="label">ZIP codes or areas you buy in</label>
        <textarea id="areas" name="areas" rows={2} className="input" placeholder="75217, 75216, Oak Cliff, Garland" defaultValue={areas} />
        <p className="hint">Separate with commas.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="price_min" className="label">Min price</label>
          <input id="price_min" name="price_min" inputMode="numeric" className="input" placeholder="$75,000" defaultValue={d.price_min ?? ""} />
        </div>
        <div>
          <label htmlFor="price_max" className="label">Max price</label>
          <input id="price_max" name="price_max" inputMode="numeric" className="input" placeholder="$250,000" defaultValue={d.price_max ?? ""} />
        </div>
      </div>
      <CheckGroup name="property_types" legend="Property types" options={PROPERTY_TYPES} checked={d.property_types} />
      <CheckGroup name="rehab_levels" legend="Rehab you'll take on" options={REHAB_LEVELS} checked={d.rehab_levels} />
      <CheckGroup name="strategies" legend="Strategy" options={STRATEGIES} checked={d.strategies} />
    </div>
  );
}
