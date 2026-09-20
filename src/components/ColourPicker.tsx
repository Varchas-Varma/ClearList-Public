import { useEffect, useId, useState, type PointerEvent } from 'react';
import { fromHSV, hexColour, toHSV, type HSV } from '../settings/colours';
export function ColourPicker({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange(value: string): void;
}) {
  const id = useId();
  const [hsv, setHSV] = useState(() => toHSV(value)),
    [draft, setDraft] = useState(value),
    [error, setError] = useState('');
  useEffect(() => {
    setHSV(toHSV(value));
    setDraft(value);
    setError('');
  }, [value]);
  function change(next: HSV) {
    setHSV(next);
    const colour = fromHSV(next);
    setDraft(colour);
    setError('');
    onChange(colour);
  }
  function wheel(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect(),
      radius = rect.width / 2,
      x = e.clientX - rect.left - radius,
      y = e.clientY - rect.top - rect.height / 2;
    change({
      ...hsv,
      h: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360,
      s: Math.min(1, Math.hypot(x, y) / radius),
    });
  }
  function commit() {
    const colour = hexColour(draft);
    if (colour) {
      setDraft(colour);
      setError('');
      onChange(colour);
    } else setError('Use 3 or 6 hexadecimal digits, for example #215ABD.');
  }
  return (
    <section className="colour-card" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{label}</h3>
      <p className="muted colour-description">{description}</p>
      <div
        className="colour-wheel"
        aria-label={`${label} colour wheel`}
        role="img"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          wheel(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) wheel(e);
        }}
        onPointerUp={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        style={{
          backgroundImage: `linear-gradient(rgb(0 0 0 / ${1 - hsv.v}), rgb(0 0 0 / ${1 - hsv.v})), radial-gradient(circle closest-side, white, transparent), conic-gradient(from 90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)`,
        }}
      >
        <span
          className="wheel-cursor"
          style={{
            left: `${50 + Math.cos((hsv.h * Math.PI) / 180) * hsv.s * 50}%`,
            top: `${50 + Math.sin((hsv.h * Math.PI) / 180) * hsv.s * 50}%`,
            background: value,
          }}
        />
      </div>
      <div className="colour-sliders">
        <label>
          Hue
          <input
            type="range"
            min="0"
            max="359"
            step="1"
            aria-label={`${label} hue`}
            value={Math.round(hsv.h)}
            onChange={(e) => change({ ...hsv, h: Number(e.target.value) })}
          />
        </label>
        <label>
          Saturation
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            aria-label={`${label} saturation`}
            value={Math.round(hsv.s * 100)}
            onChange={(e) => change({ ...hsv, s: Number(e.target.value) / 100 })}
          />
        </label>
        <label>
          Brightness
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            aria-label={`${label} brightness`}
            value={Math.round(hsv.v * 100)}
            onChange={(e) => change({ ...hsv, v: Number(e.target.value) / 100 })}
          />
        </label>
      </div>
      <label className="hex-label" htmlFor={`${id}-hex`}>
        Hex colour
      </label>
      <div className="hex-control">
        <span className="colour-swatch" style={{ background: value }} aria-hidden="true" />
        <input
          id={`${id}-hex`}
          aria-label={`${label} hex colour`}
          autoComplete="off"
          spellCheck={false}
          maxLength={7}
          value={draft}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            setError('');
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setDraft(value);
              setError('');
            }
          }}
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
